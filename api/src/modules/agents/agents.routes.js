const express = require('express');
const { pool } = require('../../db/pool');
const { asyncHandler } = require('../../lib/validate');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.email,
              COUNT(t.id) FILTER (WHERE t.status IN ('open', 'in_progress', 'waiting_on_customer'))::int AS "activeTickets"
       FROM agents a
       LEFT JOIN tickets t ON t.assignee_id = a.id
       WHERE a.is_active
       GROUP BY a.id
       ORDER BY a.name`,
    );
    res.json(rows);
  }),
);

module.exports = router;
