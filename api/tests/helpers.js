const request = require('supertest');
const { createApp } = require('../src/app');
const { pool } = require('../src/db/pool');

const app = createApp();
const api = () => request(app);

async function resetDb() {
  await pool.query('TRUNCATE ticket_events, ticket_comments, tickets, agents RESTART IDENTITY CASCADE');
}

async function createAgent(name = 'Sarah Chen', email = 'sarah@example.com', isActive = true) {
  const { rows } = await pool.query(
    'INSERT INTO agents (name, email, is_active) VALUES ($1, $2, $3) RETURNING id, name',
    [name, email, isActive],
  );
  return rows[0];
}

async function createTicket(overrides = {}) {
  const res = await api()
    .post('/api/tickets')
    .send({
      subject: 'Payment failed at checkout',
      description: 'The payment page shows an error after I enter my card.',
      requesterName: 'Emily Carter',
      requesterEmail: 'emily@example.com',
      priority: 'medium',
      actor: 'Test',
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`createTicket failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Move a ticket's creation time into the past (and its SLA deadline with it). */
async function ageTicket(id, hours) {
  await pool.query(
    `UPDATE tickets SET created_at = created_at - make_interval(hours => $2),
                        due_at = due_at - make_interval(hours => $2)
     WHERE id = $1`,
    [id, hours],
  );
}

module.exports = { api, pool, resetDb, createAgent, createTicket, ageTicket };
