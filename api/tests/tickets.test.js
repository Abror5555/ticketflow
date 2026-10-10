const { api, pool, resetDb, createAgent, createTicket, ageTicket } = require('./helpers');

beforeEach(resetDb);
afterAll(() => pool.end());

const HOUR = 60 * 60 * 1000;

describe('POST /api/tickets', () => {
  test('creates an open ticket with an SLA deadline based on priority', async () => {
    const before = Date.now();
    const ticket = await createTicket({ priority: 'urgent' });

    expect(ticket).toMatchObject({
      status: 'open',
      priority: 'urgent',
      assignee: null,
      requester: { name: 'Emily Carter', email: 'emily@example.com' },
      isOverdue: false,
      allowedTransitions: ['in_progress', 'waiting_on_customer', 'resolved'],
    });
    const dueInHours = (new Date(ticket.dueAt).getTime() - before) / HOUR;
    expect(dueInHours).toBeGreaterThan(3.9);
    expect(dueInHours).toBeLessThan(4.1);
  });

  test('returns field errors for invalid input', async () => {
    const res = await api()
      .post('/api/tickets')
      .send({ subject: 'Hi', description: 'short', requesterName: 'E', requesterEmail: 'nope', priority: 'asap' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining(['subject', 'description', 'requesterName', 'requesterEmail', 'priority']),
    );
  });

  test('records a "created" event', async () => {
    const ticket = await createTicket();
    const res = await api().get(`/api/tickets/${ticket.id}`);
    expect(res.body.events).toEqual([expect.objectContaining({ type: 'created', to: 'medium', actor: 'Test' })]);
  });
});

describe('PATCH /api/tickets/:id', () => {
  test('assigns a ticket and logs who did it', async () => {
    const agent = await createAgent();
    const ticket = await createTicket();

    const res = await api().patch(`/api/tickets/${ticket.id}`).send({ assigneeId: agent.id, actor: 'Team lead' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toEqual({ id: agent.id, name: 'Sarah Chen' });

    const details = await api().get(`/api/tickets/${ticket.id}`);
    expect(details.body.events.at(-1)).toMatchObject({ type: 'assigned', from: null, to: 'Sarah Chen', actor: 'Team lead' });
  });

  test('can unassign with null', async () => {
    const agent = await createAgent();
    const ticket = await createTicket();
    await api().patch(`/api/tickets/${ticket.id}`).send({ assigneeId: agent.id });
    const res = await api().patch(`/api/tickets/${ticket.id}`).send({ assigneeId: null });
    expect(res.body.assignee).toBeNull();
  });

  test('rejects an inactive agent', async () => {
    const agent = await createAgent('Old Agent', 'old@example.com', false);
    const ticket = await createTicket();
    const res = await api().patch(`/api/tickets/${ticket.id}`).send({ assigneeId: agent.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
  });

  test('changing priority recalculates the deadline from the creation time', async () => {
    const ticket = await createTicket({ priority: 'low' });
    const res = await api().patch(`/api/tickets/${ticket.id}`).send({ priority: 'urgent' });

    const hours = (new Date(res.body.dueAt) - new Date(res.body.createdAt)) / HOUR;
    expect(Math.round(hours)).toBe(4);
  });

  test('rejects an empty update', async () => {
    const ticket = await createTicket();
    const res = await api().patch(`/api/tickets/${ticket.id}`).send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tickets/:id/status', () => {
  test('requires an assignee before work starts', async () => {
    const ticket = await createTicket();
    const res = await api().post(`/api/tickets/${ticket.id}/status`).send({ status: 'in_progress' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ASSIGNEE_REQUIRED');
  });

  test('full workflow: in progress -> resolved -> reopened -> resolved -> closed', async () => {
    const agent = await createAgent();
    const ticket = await createTicket();
    await api().patch(`/api/tickets/${ticket.id}`).send({ assigneeId: agent.id });

    const progress = await api().post(`/api/tickets/${ticket.id}/status`).send({ status: 'in_progress' });
    expect(progress.body.status).toBe('in_progress');

    const resolved = await api().post(`/api/tickets/${ticket.id}/status`).send({ status: 'resolved' });
    expect(resolved.body.resolvedAt).not.toBeNull();
    expect(resolved.body.allowedTransitions).toEqual(['closed', 'open']);

    const reopened = await api().post(`/api/tickets/${ticket.id}/status`).send({ status: 'open' });
    expect(reopened.body.resolvedAt).toBeNull();

    await api().post(`/api/tickets/${ticket.id}/status`).send({ status: 'resolved' });
    const closed = await api().post(`/api/tickets/${ticket.id}/status`).send({ status: 'closed' });
    expect(closed.body.status).toBe('closed');
    expect(closed.body.resolvedAt).not.toBeNull();
    expect(closed.body.allowedTransitions).toEqual([]);

    const reopenClosed = await api().post(`/api/tickets/${ticket.id}/status`).send({ status: 'open' });
    expect(reopenClosed.status).toBe(422);
    expect(reopenClosed.body.error.code).toBe('INVALID_STATUS_CHANGE');
  });

  test('a closed ticket cannot be edited or commented on', async () => {
    const ticket = await createTicket();
    await api().post(`/api/tickets/${ticket.id}/status`).send({ status: 'resolved' });
    await api().post(`/api/tickets/${ticket.id}/status`).send({ status: 'closed' });

    const edit = await api().patch(`/api/tickets/${ticket.id}`).send({ priority: 'high' });
    expect(edit.body.error.code).toBe('TICKET_CLOSED');
    const comment = await api().post(`/api/tickets/${ticket.id}/comments`).send({ authorName: 'A', body: 'Hello' });
    expect(comment.body.error.code).toBe('TICKET_CLOSED');
  });

  test('returns 404 for an unknown ticket', async () => {
    const res = await api().post('/api/tickets/999/status').send({ status: 'resolved' });
    expect(res.status).toBe(404);
  });
});

describe('comments', () => {
  test('adds public replies and internal notes in order', async () => {
    const ticket = await createTicket();
    await api().post(`/api/tickets/${ticket.id}/comments`).send({ authorName: 'Sarah', body: 'On it!' });
    await api()
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ authorName: 'Sarah', body: 'Checked logs', isInternal: true });

    const res = await api().get(`/api/tickets/${ticket.id}`);
    expect(res.body.commentsCount).toBe(2);
    expect(res.body.comments.map((c) => [c.body, c.isInternal])).toEqual([
      ['On it!', false],
      ['Checked logs', true],
    ]);
  });

  test('rejects an empty comment', async () => {
    const ticket = await createTicket();
    const res = await api().post(`/api/tickets/${ticket.id}/comments`).send({ authorName: 'Sarah', body: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tickets (filters, sorting, pagination)', () => {
  async function seedList() {
    const sarah = await createAgent('Sarah Chen', 'sarah@example.com');
    const a = await createTicket({ subject: 'Refund not received', priority: 'high', requesterEmail: 'anna@example.com' });
    const b = await createTicket({ subject: 'Cannot log in to account', priority: 'urgent', requesterEmail: 'bob@example.com' });
    const c = await createTicket({ subject: 'Question about refund policy', priority: 'low', requesterEmail: 'carl@example.com' });
    await api().patch(`/api/tickets/${a.id}`).send({ assigneeId: sarah.id });
    await api().post(`/api/tickets/${c.id}/status`).send({ status: 'resolved' });
    await ageTicket(a.id, 10); // high = 8h SLA -> overdue
    return { sarah, a, b, c };
  }

  test('filters by status, priority, assignee and overdue', async () => {
    const { sarah, a, b, c } = await seedList();
    const ids = async (qs) => (await api().get(`/api/tickets${qs}`)).body.items.map((t) => t.id).sort();

    expect(await ids('?status=active')).toEqual([a.id, b.id].sort());
    expect(await ids('?status=resolved')).toEqual([c.id]);
    expect(await ids('?priority=urgent')).toEqual([b.id]);
    expect(await ids(`?assigneeId=${sarah.id}`)).toEqual([a.id]);
    expect(await ids('?assigneeId=unassigned')).toEqual([b.id, c.id].sort());
    expect(await ids('?overdue=true')).toEqual([a.id]);
  });

  test('marks overdue tickets in the response', async () => {
    const { a } = await seedList();
    const res = await api().get(`/api/tickets/${a.id}`);
    expect(res.body.isOverdue).toBe(true);
  });

  // Regression guard for a classic SQL bug: "status = $1 AND subject ILIKE $2 OR email ILIKE $2"
  // (missing parentheses) would also return the resolved "refund" ticket here.
  test('combined filters: search never leaks tickets from other statuses', async () => {
    const { a } = await seedList();
    const res = await api().get('/api/tickets?status=active&search=refund');
    expect(res.body.items.map((t) => t.id)).toEqual([a.id]);

    const byEmail = await api().get('/api/tickets?status=active&search=carl@example.com');
    expect(byEmail.body.items).toEqual([]);
  });

  test('sorts by priority (urgent first) and paginates', async () => {
    await seedList();
    const sorted = await api().get('/api/tickets?sort=priority');
    expect(sorted.body.items.map((t) => t.priority)).toEqual(['urgent', 'high', 'low']);

    const page2 = await api().get('/api/tickets?sort=priority&pageSize=2&page=2');
    expect(page2.body).toMatchObject({ total: 3, totalPages: 2, page: 2 });
    expect(page2.body.items.map((t) => t.priority)).toEqual(['low']);
  });

  test('validates query parameters', async () => {
    const res = await api().get('/api/tickets?status=deleted&pageSize=1000');
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['status', 'pageSize']));
  });
});

describe('GET /api/dashboard', () => {
  test('summarises queue health and SLA performance', async () => {
    const sarah = await createAgent('Sarah Chen', 'sarah@example.com');
    const t1 = await createTicket({ priority: 'high' });
    const t2 = await createTicket({ priority: 'low' });
    const t3 = await createTicket({ priority: 'urgent' });
    await api().patch(`/api/tickets/${t1.id}`).send({ assigneeId: sarah.id });
    await ageTicket(t1.id, 9); // overdue
    await api().post(`/api/tickets/${t3.id}/status`).send({ status: 'resolved' }); // resolved within SLA

    const res = await api().get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ open: 2, inProgress: 0, waiting: 0, overdue: 1, unassigned: 1 });
    expect(res.body.last30Days).toMatchObject({ resolved: 1, withinSlaPercent: 100 });
    expect(res.body.workload).toEqual([expect.objectContaining({ name: 'Sarah Chen', active: 1, overdue: 1 })]);
    expect(res.body.nextDeadlines[0].id).toBe(t1.id);
    expect(res.body.nextDeadlines.map((t) => t.id)).not.toContain(t3.id);
    expect(res.body.nextDeadlines.map((t) => t.id)).toContain(t2.id);
  });
});
