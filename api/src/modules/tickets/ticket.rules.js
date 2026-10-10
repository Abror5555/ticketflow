/**
 * Pure business rules for tickets (no database access, easy to unit test).
 */

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];

/** First-response/resolution target per priority, in hours. */
const SLA_HOURS = { urgent: 4, high: 8, medium: 24, low: 72 };

/** Allowed status changes. The UI renders its buttons from this list via the API. */
const STATUS_TRANSITIONS = {
  open: ['in_progress', 'waiting_on_customer', 'resolved'],
  in_progress: ['waiting_on_customer', 'resolved', 'open'],
  waiting_on_customer: ['in_progress', 'resolved'],
  resolved: ['closed', 'open'],
  closed: [],
};

const ACTIVE_STATUSES = ['open', 'in_progress', 'waiting_on_customer'];
const DONE_STATUSES = ['resolved', 'closed'];

function dueDateFor(priority, createdAt) {
  return new Date(new Date(createdAt).getTime() + SLA_HOURS[priority] * 60 * 60 * 1000);
}

function allowedTransitions(status) {
  return STATUS_TRANSITIONS[status] || [];
}

/**
 * Validate a status change. Returns null when allowed, otherwise
 * { code, message } describing why not.
 */
function checkTransition(ticket, nextStatus) {
  if (!allowedTransitions(ticket.status).includes(nextStatus)) {
    return {
      code: 'INVALID_STATUS_CHANGE',
      message: `Cannot change status from "${ticket.status}" to "${nextStatus}"`,
    };
  }
  if (nextStatus === 'in_progress' && !ticket.assigneeId) {
    return { code: 'ASSIGNEE_REQUIRED', message: 'Assign the ticket to an agent before starting work on it' };
  }
  return null;
}

function isOverdue(ticket, now = new Date()) {
  return ACTIVE_STATUSES.includes(ticket.status) && new Date(ticket.dueAt) < now;
}

module.exports = {
  PRIORITIES,
  STATUSES,
  SLA_HOURS,
  STATUS_TRANSITIONS,
  ACTIVE_STATUSES,
  DONE_STATUSES,
  dueDateFor,
  allowedTransitions,
  checkTransition,
  isOverdue,
};
