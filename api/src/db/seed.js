const { pool } = require('./pool');
const { SLA_HOURS } = require('../modules/tickets/ticket.rules');

const HOUR = 60 * 60 * 1000;
const hoursAgo = (h) => new Date(Date.now() - h * HOUR);

const agents = [
  ['Sarah Chen', 'sarah.chen@ticketflow.dev'],
  ['Marcus Reed', 'marcus.reed@ticketflow.dev'],
  ['Priya Patel', 'priya.patel@ticketflow.dev'],
  ['Tom Becker', 'tom.becker@ticketflow.dev'],
];

// [subject, requesterName, email, priority, status, assignee index | null, created hours ago, resolved hours after creation]
const tickets = [
  ['Payment failed but card was charged', 'Emily Carter', 'emily.carter@example.com', 'urgent', 'in_progress', 0, 2, null],
  ['Cannot log in after password reset', 'James Miller', 'james.miller@example.com', 'high', 'open', null, 10, null],
  ['Booking confirmation email not received', 'Sofia Garcia', 'sofia.garcia@example.com', 'medium', 'waiting_on_customer', 1, 20, null],
  ['Request to change reservation dates', 'Daniel Kim', 'daniel.kim@example.com', 'medium', 'open', 2, 5, null],
  ['Invoice shows wrong company name', 'Olivia Turner', 'olivia.turner@example.com', 'low', 'open', null, 30, null],
  ['App crashes when uploading a photo', 'Noah Wright', 'noah.wright@example.com', 'high', 'in_progress', 1, 12, null],
  ['Refund for cancelled trip', 'Mia Lopez', 'mia.lopez@example.com', 'high', 'resolved', 0, 40, 6],
  ['How do I add a second traveler?', 'Ethan Hall', 'ethan.hall@example.com', 'low', 'closed', 3, 90, 20],
  ['Promo code not applied at checkout', 'Ava Young', 'ava.young@example.com', 'medium', 'resolved', 2, 70, 30],
  ['Account locked after too many attempts', 'Liam Scott', 'liam.scott@example.com', 'urgent', 'resolved', 0, 26, 3],
  ['Wrong currency displayed on prices', 'Chloe Adams', 'chloe.adams@example.com', 'medium', 'open', 3, 1, null],
  ['Export of past bookings to CSV', 'Lucas Baker', 'lucas.baker@example.com', 'low', 'waiting_on_customer', 2, 50, null],
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE ticket_events, ticket_comments, tickets, agents RESTART IDENTITY CASCADE');

    const agentIds = [];
    for (const [name, email] of agents) {
      const { rows } = await client.query('INSERT INTO agents (name, email) VALUES ($1, $2) RETURNING id', [name, email]);
      agentIds.push(rows[0].id);
    }

    for (const [subject, name, email, priority, status, agentIdx, createdHoursAgo, resolvedAfter] of tickets) {
      const createdAt = hoursAgo(createdHoursAgo);
      const dueAt = new Date(createdAt.getTime() + SLA_HOURS[priority] * HOUR);
      const resolvedAt = resolvedAfter === null ? null : new Date(createdAt.getTime() + resolvedAfter * HOUR);
      const assigneeId = agentIdx === null ? null : agentIds[agentIdx];
      const agentName = agentIdx === null ? null : agents[agentIdx][0];

      const { rows } = await client.query(
        `INSERT INTO tickets (subject, description, requester_name, requester_email, priority, status,
                              assignee_id, due_at, resolved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id`,
        [
          subject,
          `Hello, ${subject.toLowerCase()}. Could you please help me with this? Thank you.`,
          name,
          email,
          priority,
          status,
          assigneeId,
          dueAt,
          resolvedAt,
          createdAt,
        ],
      );
      const id = rows[0].id;
      const event = (type, from, to, actor, at) =>
        client.query(
          'INSERT INTO ticket_events (ticket_id, type, from_value, to_value, actor, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, type, from, to, actor, at],
        );

      await event('created', null, priority, name, createdAt);
      if (agentName) await event('assigned', null, agentName, 'Sarah Chen', new Date(createdAt.getTime() + 0.2 * HOUR));
      if (status !== 'open') {
        await event('status_changed', 'open', status === 'closed' ? 'resolved' : status, agentName || 'Support agent',
          resolvedAt || new Date(createdAt.getTime() + 0.5 * HOUR));
      }
      if (status === 'closed') await event('status_changed', 'resolved', 'closed', agentName, new Date(resolvedAt.getTime() + HOUR));

      if (agentName) {
        await client.query(
          `INSERT INTO ticket_comments (ticket_id, author_name, body, is_internal, created_at) VALUES
             ($1, $2, $3, false, $4),
             ($1, $2, $5, true, $6)`,
          [
            id,
            agentName,
            `Hi ${name.split(' ')[0]}, thanks for reaching out. I'm looking into this now and will update you shortly.`,
            new Date(createdAt.getTime() + 0.3 * HOUR),
            'Internal note: checked the logs, details added to the engineering board.',
            new Date(createdAt.getTime() + 0.4 * HOUR),
          ],
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded ${agents.length} agents and ${tickets.length} tickets.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
