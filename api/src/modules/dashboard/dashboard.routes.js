const express = require('express');
const { pool } = require('../../db/pool');
const { asyncHandler } = require('../../lib/validate');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const counts = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')::int                AS open,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int         AS "inProgress",
         COUNT(*) FILTER (WHERE status = 'waiting_on_customer')::int AS waiting,
         COUNT(*) FILTER (WHERE status IN ('open', 'in_progress', 'waiting_on_customer')
                            AND due_at < now())::int                 AS overdue,
         COUNT(*) FILTER (WHERE status IN ('open', 'in_progress', 'waiting_on_customer')
                            AND assignee_id IS NULL)::int            AS unassigned
       FROM tickets`,
    );

    // Quality of service for tickets resolved in the last 30 days.
    const sla = await pool.query(
      `SELECT COUNT(*)::int AS resolved,
              ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 1) AS "avgResolutionHours",
              ROUND(100.0 * COUNT(*) FILTER (WHERE resolved_at <= due_at) / NULLIF(COUNT(*), 0)) AS "withinSlaPercent"
       FROM tickets
       WHERE resolved_at IS NOT NULL AND resolved_at > now() - interval '30 days'`,
    );

    const workload = await pool.query(
      `SELECT a.id, a.name,
              COUNT(t.id) FILTER (WHERE t.status IN ('open', 'in_progress', 'waiting_on_customer'))::int AS active,
              COUNT(t.id) FILTER (WHERE t.status IN ('open', 'in_progress', 'waiting_on_customer')
                                    AND t.due_at < now())::int AS overdue
       FROM agents a LEFT JOIN tickets t ON t.assignee_id = a.id
       WHERE a.is_active
       GROUP BY a.id ORDER BY active DESC, a.name`,
    );

    const urgent = await pool.query(
      `SELECT t.id, t.subject, t.priority, t.status, t.due_at AS "dueAt", a.name AS "assigneeName"
       FROM tickets t LEFT JOIN agents a ON a.id = t.assignee_id
       WHERE t.status IN ('open', 'in_progress', 'waiting_on_customer')
       ORDER BY t.due_at ASC LIMIT 5`,
    );

    const s = sla.rows[0];
    res.json({
      ...counts.rows[0],
      last30Days: {
        resolved: s.resolved,
        avgResolutionHours: s.avgResolutionHours === null ? null : Number(s.avgResolutionHours),
        withinSlaPercent: s.withinSlaPercent === null ? null : Number(s.withinSlaPercent),
      },
      workload: workload.rows,
      nextDeadlines: urgent.rows,
    });
  }),
);

module.exports = router;
