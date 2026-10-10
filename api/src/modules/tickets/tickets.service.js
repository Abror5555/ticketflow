const { pool, withTransaction } = require('../../db/pool');
const { notFound, unprocessable } = require('../../lib/errors');
const { SLA_HOURS, ACTIVE_STATUSES, allowedTransitions, checkTransition } = require('./ticket.rules');

const TICKET_SELECT = `
  SELECT t.id, t.subject, t.description, t.priority, t.status,
         t.due_at AS "dueAt", t.resolved_at AS "resolvedAt",
         t.created_at AS "createdAt", t.updated_at AS "updatedAt",
         json_build_object('name', t.requester_name, 'email', t.requester_email) AS requester,
         CASE WHEN a.id IS NULL THEN NULL
              ELSE json_build_object('id', a.id, 'name', a.name) END AS assignee,
         (t.status IN ('open', 'in_progress', 'waiting_on_customer') AND t.due_at < now()) AS "isOverdue",
         (SELECT COUNT(*)::int FROM ticket_comments c WHERE c.ticket_id = t.id) AS "commentsCount"
  FROM tickets t
  LEFT JOIN agents a ON a.id = t.assignee_id`;

const SORTS = {
  newest: 't.created_at DESC, t.id DESC',
  due: 't.due_at ASC, t.id ASC',
  // urgent first, then the most urgent deadline
  priority: `CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_at ASC`,
};

const withTransitions = (ticket) => ({ ...ticket, allowedTransitions: allowedTransitions(ticket.status) });

async function listTickets(q) {
  const where = [];
  const params = [];
  const param = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (q.status === 'active') where.push(`t.status = ANY(${param(ACTIVE_STATUSES)})`);
  else if (q.status) where.push(`t.status = ${param(q.status)}`);
  if (q.priority) where.push(`t.priority = ${param(q.priority)}`);
  if (q.assigneeId === 'unassigned') where.push('t.assignee_id IS NULL');
  else if (q.assigneeId) where.push(`t.assignee_id = ${param(q.assigneeId)}`);
  if (q.overdue === true) {
    where.push(`t.status = ANY(${param(ACTIVE_STATUSES)}) AND t.due_at < now()`);
  }
  if (q.search) {
    const p = param(`%${q.search}%`);
    // The parentheses matter: without them "status = x AND subject ILIKE y OR email ILIKE y"
    // would return tickets of any status whose email matches (see tests: "combined filters").
    where.push(`(t.subject ILIKE ${p} OR t.requester_email ILIKE ${p} OR t.requester_name ILIKE ${p})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM tickets t ${whereSql}`, params)).rows[0].n;
  const { rows } = await pool.query(
    `${TICKET_SELECT} ${whereSql} ORDER BY ${SORTS[q.sort]}
     LIMIT ${param(q.pageSize)} OFFSET ${param((q.page - 1) * q.pageSize)}`,
    params,
  );

  return {
    items: rows.map(withTransitions),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

async function getTicket(id, client = pool) {
  const { rows } = await client.query(`${TICKET_SELECT} WHERE t.id = $1`, [id]);
  if (!rows[0]) throw notFound('Ticket');
  return withTransitions(rows[0]);
}

async function getTicketDetails(id) {
  const ticket = await getTicket(id);
  const [comments, events] = await Promise.all([
    pool.query(
      `SELECT id, author_name AS "authorName", body, is_internal AS "isInternal", created_at AS "createdAt"
       FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at, id`,
      [id],
    ),
    pool.query(
      `SELECT id, type, from_value AS "from", to_value AS "to", actor, created_at AS "createdAt"
       FROM ticket_events WHERE ticket_id = $1 ORDER BY created_at, id`,
      [id],
    ),
  ]);
  return { ...ticket, comments: comments.rows, events: events.rows };
}

function logEvent(client, ticketId, type, from, to, actor) {
  return client.query(
    'INSERT INTO ticket_events (ticket_id, type, from_value, to_value, actor) VALUES ($1, $2, $3, $4, $5)',
    [ticketId, type, from, to, actor],
  );
}

async function createTicket(input) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO tickets (subject, description, requester_name, requester_email, priority, due_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6))
       RETURNING id`,
      [input.subject, input.description, input.requesterName, input.requesterEmail, input.priority, SLA_HOURS[input.priority]],
    );
    const id = rows[0].id;
    await logEvent(client, id, 'created', null, input.priority, input.actor);
    return getTicket(id, client);
  });
}

async function lockTicket(client, id) {
  const { rows } = await client.query(
    `SELECT id, status, priority, assignee_id AS "assigneeId" FROM tickets WHERE id = $1 FOR UPDATE`,
    [id],
  );
  if (!rows[0]) throw notFound('Ticket');
  return rows[0];
}

async function updateTicket(id, { priority, assigneeId, actor }) {
  return withTransaction(async (client) => {
    const ticket = await lockTicket(client, id);
    if (ticket.status === 'closed') {
      throw unprocessable('TICKET_CLOSED', 'Closed tickets cannot be changed. Reopen is not possible after closing.');
    }

    if (priority && priority !== ticket.priority) {
      // The SLA deadline is always measured from when the customer opened the ticket.
      await client.query(
        `UPDATE tickets SET priority = $1, due_at = created_at + make_interval(hours => $2), updated_at = now()
         WHERE id = $3`,
        [priority, SLA_HOURS[priority], id],
      );
      await logEvent(client, id, 'priority_changed', ticket.priority, priority, actor);
    }

    if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
      let newName = null;
      if (assigneeId !== null) {
        const agent = await client.query('SELECT name, is_active AS "isActive" FROM agents WHERE id = $1', [assigneeId]);
        if (!agent.rows[0] || !agent.rows[0].isActive) {
          throw unprocessable('INVALID_ASSIGNEE', 'Choose an active agent', { assigneeId: 'Unknown or inactive agent' });
        }
        newName = agent.rows[0].name;
      }
      const oldName = ticket.assigneeId
        ? (await client.query('SELECT name FROM agents WHERE id = $1', [ticket.assigneeId])).rows[0].name
        : null;
      await client.query('UPDATE tickets SET assignee_id = $1, updated_at = now() WHERE id = $2', [assigneeId, id]);
      await logEvent(client, id, 'assigned', oldName, newName, actor);
    }

    return getTicket(id, client);
  });
}

async function changeStatus(id, { status, actor }) {
  return withTransaction(async (client) => {
    const ticket = await lockTicket(client, id);
    if (ticket.status === status) return getTicket(id, client);

    const problem = checkTransition(ticket, status);
    if (problem) throw unprocessable(problem.code, problem.message);

    // resolved_at: set when the work is done, kept when closing, cleared when reopened.
    let resolvedAtSql = 'resolved_at';
    if (status === 'resolved') resolvedAtSql = 'now()';
    else if (status !== 'closed') resolvedAtSql = 'NULL';

    await client.query(
      `UPDATE tickets SET status = $1, resolved_at = ${resolvedAtSql}, updated_at = now() WHERE id = $2`,
      [status, id],
    );
    await logEvent(client, id, 'status_changed', ticket.status, status, actor);
    return getTicket(id, client);
  });
}

async function addComment(id, { authorName, body, isInternal }) {
  return withTransaction(async (client) => {
    const ticket = await lockTicket(client, id);
    if (ticket.status === 'closed') {
      throw unprocessable('TICKET_CLOSED', 'Closed tickets cannot receive new comments');
    }
    const { rows } = await client.query(
      `INSERT INTO ticket_comments (ticket_id, author_name, body, is_internal)
       VALUES ($1, $2, $3, $4)
       RETURNING id, author_name AS "authorName", body, is_internal AS "isInternal", created_at AS "createdAt"`,
      [id, authorName, body, isInternal],
    );
    await client.query('UPDATE tickets SET updated_at = now() WHERE id = $1', [id]);
    return rows[0];
  });
}

module.exports = { listTickets, getTicket, getTicketDetails, createTicket, updateTicket, changeStatus, addComment };
