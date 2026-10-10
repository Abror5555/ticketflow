export const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_customer: 'Waiting on customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

/** SLA target per priority (mirrors the API), shown as a hint in the form. */
export const SLA_HOURS = { urgent: 4, high: 8, medium: 24, low: 72 };

/** Button labels for each target status in the ticket workflow. */
export const TRANSITION_LABELS = {
  open: 'Reopen',
  in_progress: 'Start work',
  waiting_on_customer: 'Wait for customer',
  resolved: 'Mark resolved',
  closed: 'Close ticket',
};

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDateTime(value) {
  return value ? dateTime.format(new Date(value)) : '';
}

/** Human duration: 95 minutes -> "1h 35m", 3000 minutes -> "2d 2h". */
export function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(Math.abs(ms) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function timeAgo(value, now = Date.now()) {
  const diff = now - new Date(value).getTime();
  if (diff < 60000) return 'just now';
  return `${formatDuration(diff)} ago`;
}

/**
 * SLA state for a ticket: { tone, label }.
 * Done tickets show nothing; active tickets show time left or how late they are.
 */
export function slaState(ticket, now = Date.now()) {
  if (['resolved', 'closed'].includes(ticket.status)) return null;
  const left = new Date(ticket.dueAt).getTime() - now;
  if (left < 0) return { tone: 'danger', label: `Overdue ${formatDuration(left)}` };
  if (left < 2 * 60 * 60 * 1000) return { tone: 'warning', label: `Due in ${formatDuration(left)}` };
  return { tone: 'ok', label: `Due in ${formatDuration(left)}` };
}

/** One line of the activity timeline, e.g. "changed status from Open to Resolved". */
export function describeEvent(event) {
  const status = (v) => STATUS_LABELS[v] || v;
  const priority = (v) => PRIORITY_LABELS[v] || v;
  switch (event.type) {
    case 'created':
      return `created the ticket with ${priority(event.to)} priority`;
    case 'status_changed':
      return `changed status from ${status(event.from)} to ${status(event.to)}`;
    case 'priority_changed':
      return `changed priority from ${priority(event.from)} to ${priority(event.to)}`;
    case 'assigned':
      if (!event.to) return `unassigned ${event.from}`;
      if (!event.from) return `assigned the ticket to ${event.to}`;
      return `reassigned the ticket from ${event.from} to ${event.to}`;
    default:
      return event.type;
  }
}

export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  );
}
