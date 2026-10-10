import { PRIORITY_LABELS, slaState, STATUS_LABELS } from '@/lib/format';

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const badge = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset';

const statusStyles = {
  open: 'bg-sky-50 text-sky-700 ring-sky-200',
  in_progress: 'bg-violet-50 text-violet-700 ring-violet-200',
  waiting_on_customer: 'bg-amber-50 text-amber-700 ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatusBadge({ status }) {
  return <span className={`${badge} ${statusStyles[status]}`}>{STATUS_LABELS[status] || status}</span>;
}

const priorityStyles = {
  urgent: 'bg-red-50 text-red-700 ring-red-200',
  high: 'bg-orange-50 text-orange-700 ring-orange-200',
  medium: 'bg-slate-50 text-slate-700 ring-slate-200',
  low: 'bg-white text-slate-500 ring-slate-200',
};

export function PriorityBadge({ priority }) {
  return <span className={`${badge} ${priorityStyles[priority]}`}>{PRIORITY_LABELS[priority] || priority}</span>;
}

const slaStyles = {
  danger: 'bg-red-600 text-white ring-red-600',
  warning: 'bg-amber-50 text-amber-800 ring-amber-300',
  ok: 'bg-white text-slate-600 ring-slate-200',
};

export function SlaBadge({ ticket, now }) {
  const sla = slaState(ticket, now);
  if (!sla) return <span className="text-xs text-slate-400">—</span>;
  return <span className={`${badge} ${slaStyles[sla.tone]}`}>{sla.label}</span>;
}

export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
      <p className="font-medium text-slate-900">Could not load data</p>
      <p className="text-sm text-slate-500">{error?.message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}

export function Notice({ type = 'success', children, onClose }) {
  const styles =
    type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700';
  return (
    <div className={`mb-4 flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${styles}`} role="status">
      <span>{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="font-medium opacity-70 hover:opacity-100" aria-label="Close">
          ×
        </button>
      )}
    </div>
  );
}
