const { dueDateFor, checkTransition, isOverdue, allowedTransitions } = require('../src/modules/tickets/ticket.rules');

describe('ticket rules', () => {
  test('SLA deadline depends on priority', () => {
    const created = new Date('2030-01-01T10:00:00Z');
    expect(dueDateFor('urgent', created).toISOString()).toBe('2030-01-01T14:00:00.000Z');
    expect(dueDateFor('low', created).toISOString()).toBe('2030-01-04T10:00:00.000Z');
  });

  test('closed is a final status', () => {
    expect(allowedTransitions('closed')).toEqual([]);
    expect(checkTransition({ status: 'closed', assigneeId: 1 }, 'open')).toMatchObject({ code: 'INVALID_STATUS_CHANGE' });
  });

  test('work cannot start on an unassigned ticket', () => {
    expect(checkTransition({ status: 'open', assigneeId: null }, 'in_progress')).toMatchObject({
      code: 'ASSIGNEE_REQUIRED',
    });
    expect(checkTransition({ status: 'open', assigneeId: 3 }, 'in_progress')).toBeNull();
  });

  test('a resolved ticket can be reopened, a closed one cannot', () => {
    expect(checkTransition({ status: 'resolved', assigneeId: 1 }, 'open')).toBeNull();
    expect(checkTransition({ status: 'closed', assigneeId: 1 }, 'open')).not.toBeNull();
  });

  test('only active tickets can be overdue', () => {
    const past = '2000-01-01T00:00:00Z';
    expect(isOverdue({ status: 'open', dueAt: past })).toBe(true);
    expect(isOverdue({ status: 'resolved', dueAt: past })).toBe(false);
  });
});
