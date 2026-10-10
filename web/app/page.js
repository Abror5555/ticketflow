'use client';

import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import { useNow } from '@/lib/useNow';
import { ErrorState, LoadingState, PageHeader, PriorityBadge, SlaBadge, StatusBadge } from '@/components/ui';

function StatCard({ label, value, href, tone }) {
  const color = tone === 'danger' && value > 0 ? 'text-red-600' : 'text-slate-900';
  return (
    <Link href={href} className="card block p-5 transition hover:border-brand-500">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useApi('/dashboard');
  const now = useNow();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Queue health and SLA performance"
        action={
          <Link href="/tickets/new" className="btn-primary">
            New ticket
          </Link>
        }
      />

      {loading && !data && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Open" value={data.open} href="/tickets?status=open" />
            <StatCard label="In progress" value={data.inProgress} href="/tickets?status=in_progress" />
            <StatCard label="Waiting on customer" value={data.waiting} href="/tickets?status=waiting_on_customer" />
            <StatCard label="Overdue" value={data.overdue} href="/tickets?overdue=true" tone="danger" />
            <StatCard label="Unassigned" value={data.unassigned} href="/tickets?assigneeId=unassigned" tone="danger" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="card lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold text-slate-900">Next deadlines</h2>
                <Link href="/tickets?status=active&sort=due" className="text-sm font-medium text-brand-600 hover:underline">
                  View queue
                </Link>
              </div>
              <ul className="divide-y divide-slate-100">
                {data.nextDeadlines.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">No active tickets 🎉</li>}
                {data.nextDeadlines.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tickets/${t.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50">
                      <span className="text-sm text-slate-400">#{t.id}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{t.subject}</span>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                      <SlaBadge ticket={t} now={now} />
                      <span className="w-28 truncate text-right text-xs text-slate-500">{t.assigneeName || 'Unassigned'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <div className="space-y-6">
              <section className="card p-5">
                <h2 className="font-semibold text-slate-900">Last 30 days</h2>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <dt className="text-xs text-slate-500">Resolved</dt>
                    <dd className="text-xl font-semibold">{data.last30Days.resolved}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Avg. time</dt>
                    <dd className="text-xl font-semibold">
                      {data.last30Days.avgResolutionHours === null ? '—' : `${data.last30Days.avgResolutionHours}h`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Within SLA</dt>
                    <dd className="text-xl font-semibold">
                      {data.last30Days.withinSlaPercent === null ? '—' : `${data.last30Days.withinSlaPercent}%`}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="card p-5">
                <h2 className="mb-3 font-semibold text-slate-900">Team workload</h2>
                <ul className="space-y-3">
                  {data.workload.map((agent) => {
                    const max = Math.max(1, ...data.workload.map((a) => a.active));
                    return (
                      <li key={agent.id}>
                        <div className="flex justify-between text-sm">
                          <Link href={`/tickets?assigneeId=${agent.id}&status=active`} className="hover:underline">
                            {agent.name}
                          </Link>
                          <span className="text-slate-500">
                            {agent.active} active{agent.overdue > 0 && <span className="text-red-600"> · {agent.overdue} overdue</span>}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(agent.active / max) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
