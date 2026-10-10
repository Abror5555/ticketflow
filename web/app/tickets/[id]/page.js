'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useActor } from '@/lib/actor';
import { useApi } from '@/lib/useApi';
import { useNow } from '@/lib/useNow';
import {
  describeEvent,
  formatDateTime,
  initials,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TRANSITION_LABELS,
  timeAgo,
} from '@/lib/format';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from '@/components/ui';

function Section({ title, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Comment({ comment, now }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
        {initials(comment.authorName)}
      </span>
      <div
        className={`min-w-0 flex-1 rounded-lg border px-4 py-3 ${
          comment.isInternal ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-900">{comment.authorName}</span>
          {comment.isInternal && <span className="font-medium text-amber-700">Internal note</span>}
          <span title={formatDateTime(comment.createdAt)}>{now ? timeAgo(comment.createdAt, now) : ''}</span>
        </div>
        <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-800">{comment.body}</p>
      </div>
    </li>
  );
}

function ReplyForm({ ticketId, actor, disabled, onSaved }) {
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: { authorName: actor, body, isInternal },
      });
      setBody('');
      setIsInternal(false);
      onSaved(isInternal ? 'Internal note added' : 'Reply added');
    } catch (err) {
      setError(err.fields?.body || err.message);
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">This ticket is closed. New comments are disabled.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <label className="sr-only" htmlFor="reply">
        Reply
      </label>
      <textarea
        id="reply"
        rows={4}
        className={`input ${isInternal ? 'bg-amber-50' : ''} ${error ? 'input-error' : ''}`}
        placeholder={isInternal ? 'Write a note for the team (customer will not see it)...' : 'Write a reply to the customer...'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error && <p className="field-error">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-amber-500"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
          />
          Internal note
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">as {actor}</span>
          <button type="submit" className="btn-primary" disabled={saving || !body.trim()}>
            {saving ? 'Saving...' : isInternal ? 'Add note' : 'Send reply'}
          </button>
        </div>
      </div>
    </form>
  );
}

function TicketView() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const now = useNow();
  const [actor] = useActor();
  const { data: ticket, error, loading, reload } = useApi(`/tickets/${id}`);
  const { data: agents } = useApi('/agents');

  const [createdNotice, setCreatedNotice] = useState(searchParams.get('created') === '1');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  /** Run a change, then reload the ticket so badges, SLA and the timeline stay in sync with the server. */
  async function run(request, successText) {
    setBusy(true);
    setMessage(null);
    try {
      await request();
      setMessage({ type: 'success', text: successText });
      reload();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const changeStatus = (status) =>
    run(
      () => apiRequest(`/tickets/${id}/status`, { method: 'POST', body: { status, actor } }),
      `Status changed to ${STATUS_LABELS[status]}`,
    );

  const update = (changes, successText) =>
    run(() => apiRequest(`/tickets/${id}`, { method: 'PATCH', body: { ...changes, actor } }), successText);

  if (error?.status === 404) {
    return (
      <div className="card">
        <EmptyState
          title="Ticket not found"
          description="It may have been removed, or the link is wrong."
          action={
            <Link href="/tickets" className="btn-secondary mt-2">
              Back to tickets
            </Link>
          }
        />
      </div>
    );
  }
  if (error && !ticket) return <ErrorState error={error} onRetry={reload} />;
  if (!ticket) return <LoadingState />;

  const isClosed = ticket.status === 'closed';
  // While a change is saving or the fresh ticket is loading, block further clicks.
  const pending = busy || loading;
  const me = (agents || []).find((a) => a.name === actor);
  const activeAgents = agents || [];

  return (
    <>
      <Link href="/tickets" className="text-sm font-medium text-brand-600 hover:underline">
        ← All tickets
      </Link>

      <div className="mb-6 mt-3">
        <p className="text-sm text-slate-400">#{ticket.id}</p>
        <h1 className="text-2xl font-semibold text-slate-900">{ticket.subject}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <SlaBadge ticket={ticket} now={now} />
          <span className="text-xs text-slate-500">Opened {formatDateTime(ticket.createdAt)}</span>
        </div>
      </div>

      {createdNotice && (
        <Notice onClose={() => setCreatedNotice(false)}>
          Ticket created. SLA deadline: {formatDateTime(ticket.dueAt)}.
        </Notice>
      )}
      {/* Shown once the reloaded ticket has arrived, so the message never appears next to stale badges. */}
      {message && !loading && (
        <Notice type={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Notice>
      )}

      <div className={`grid gap-6 lg:grid-cols-3 ${loading ? 'opacity-80' : ''}`}>
        <div className="space-y-6 lg:col-span-2">
          <Section title="Description">
            <p className="whitespace-pre-line break-words text-sm text-slate-800">{ticket.description}</p>
          </Section>

          <Section title={`Conversation (${ticket.comments.length})`}>
            {ticket.comments.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">No replies yet.</p>
            ) : (
              <ul className="mb-5 space-y-4">
                {ticket.comments.map((c) => (
                  <Comment key={c.id} comment={c} now={now} />
                ))}
              </ul>
            )}
            <ReplyForm
              ticketId={ticket.id}
              actor={actor}
              disabled={isClosed}
              onSaved={(text) => {
                setMessage({ type: 'success', text });
                reload();
              }}
            />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Actions">
            {ticket.allowedTransitions.length === 0 ? (
              <p className="text-sm text-slate-500">Closed tickets cannot change status.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ticket.allowedTransitions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={status === 'resolved' ? 'btn-primary' : 'btn-secondary'}
                    disabled={pending}
                    onClick={() => changeStatus(status)}
                  >
                    {TRANSITION_LABELS[status]}
                  </button>
                ))}
              </div>
            )}
            {!ticket.assignee && ticket.allowedTransitions.includes('in_progress') && (
              <p className="mt-3 text-xs text-slate-500">Assign the ticket before starting work.</p>
            )}
          </Section>

          <Section title="Details">
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="assignee">
                  Assignee
                </label>
                <select
                  id="assignee"
                  className="input"
                  value={ticket.assignee?.id ?? ''}
                  disabled={pending || isClosed}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null;
                    const name = activeAgents.find((a) => a.id === value)?.name;
                    update({ assigneeId: value }, value ? `Assigned to ${name}` : 'Ticket unassigned');
                  }}
                >
                  <option value="">Unassigned</option>
                  {activeAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.activeTickets} active)
                    </option>
                  ))}
                </select>
                {me && ticket.assignee?.id !== me.id && !isClosed && (
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
                    disabled={pending}
                    onClick={() => update({ assigneeId: me.id }, `Assigned to ${me.name}`)}
                  >
                    Assign to me
                  </button>
                )}
              </div>

              <div>
                <label className="label" htmlFor="priority">
                  Priority
                </label>
                <select
                  id="priority"
                  className="input"
                  value={ticket.priority}
                  disabled={pending || isClosed}
                  onChange={(e) =>
                    update(
                      { priority: e.target.value },
                      `Priority changed to ${PRIORITY_LABELS[e.target.value]}. SLA deadline recalculated.`,
                    )
                  }
                >
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <dl className="space-y-3 border-t border-slate-100 pt-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Customer</dt>
                  <dd className="font-medium text-slate-900">{ticket.requester.name}</dd>
                  <dd>
                    <a href={`mailto:${ticket.requester.email}`} className="break-all text-brand-600 hover:underline">
                      {ticket.requester.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">SLA deadline</dt>
                  <dd>{formatDateTime(ticket.dueAt)}</dd>
                </div>
                {ticket.resolvedAt && (
                  <div>
                    <dt className="text-xs text-slate-500">Resolved</dt>
                    <dd>
                      {formatDateTime(ticket.resolvedAt)}
                      {new Date(ticket.resolvedAt) > new Date(ticket.dueAt) ? (
                        <span className="ml-2 text-xs text-red-600">after deadline</span>
                      ) : (
                        <span className="ml-2 text-xs text-emerald-600">within SLA</span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </Section>

          <Section title="Activity">
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {[...ticket.events].reverse().map((event) => (
                <li key={event.id} className="relative text-sm">
                  <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-4 ring-white" />
                  <p className="text-slate-700">
                    <span className="font-medium text-slate-900">{event.actor}</span> {describeEvent(event)}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </>
  );
}

export default function TicketPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TicketView />
    </Suspense>
  );
}
