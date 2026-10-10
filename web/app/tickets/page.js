'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toQuery } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useNow } from '@/lib/useNow';
import { PRIORITY_LABELS, STATUS_LABELS, timeAgo } from '@/lib/format';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from '@/components/ui';

const FILTER_KEYS = ['status', 'priority', 'assigneeId', 'overdue', 'search', 'sort', 'page'];

/**
 * The URL is the single source of truth for filters: links from the dashboard
 * open a pre-filtered list, and the browser back button restores the previous view.
 */
function TicketsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = useNow();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const page = Number(filters.page) || 1;

  const [searchInput, setSearchInput] = useState(filters.search);
  const { data: agents } = useApi('/agents');
  const { data, error, loading, reload } = useApi(
    `/tickets${toQuery({ ...filters, sort: filters.sort || 'newest', page, pageSize: 10 })}`,
  );

  function setFilters(changes, { resetPage = true } = {}) {
    const next = { ...filters, ...changes };
    if (resetPage) next.page = '';
    router.replace(`${pathname}${toQuery(next)}`, { scroll: false });
  }

  // Debounce typing in the search box before it updates the URL.
  useEffect(() => {
    if (searchInput === filters.search) return undefined;
    const t = setTimeout(() => setFilters({ search: searchInput.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasFilters = FILTER_KEYS.some((k) => k !== 'sort' && k !== 'page' && filters[k]);

  return (
    <>
      <PageHeader
        title="Tickets"
        description="Filter the queue, check SLA deadlines and open a ticket to work on it"
        action={
          <Link href="/tickets/new" className="btn-primary">
            New ticket
          </Link>
        }
      />

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <input
            className="input max-w-xs"
            placeholder="Search subject, name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search tickets"
          />
          <select
            className="input w-auto"
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            <option value="active">Active (not resolved)</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filters.priority}
            onChange={(e) => setFilters({ priority: e.target.value })}
            aria-label="Priority"
          >
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filters.assigneeId}
            onChange={(e) => setFilters({ assigneeId: e.target.value })}
            aria-label="Assignee"
          >
            <option value="">Any assignee</option>
            <option value="unassigned">Unassigned</option>
            {(agents || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={filters.overdue === 'true'}
              onChange={(e) => setFilters({ overdue: e.target.checked ? 'true' : '' })}
            />
            Overdue only
          </label>
          <select
            className="input ml-auto w-auto"
            value={filters.sort || 'newest'}
            onChange={(e) => setFilters({ sort: e.target.value })}
            aria-label="Sort"
          >
            <option value="newest">Newest first</option>
            <option value="due">Deadline first</option>
            <option value="priority">Priority first</option>
          </select>
        </div>

        {loading && !data && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            title="No tickets found"
            description={hasFilters ? 'Try removing some filters.' : 'New tickets will appear here.'}
            action={
              hasFilters && (
                <button
                  type="button"
                  className="btn-secondary mt-2"
                  onClick={() => {
                    setSearchInput('');
                    router.replace(pathname);
                  }}
                >
                  Clear filters
                </button>
              )
            }
          />
        )}

        {data && data.items.length > 0 && (
          <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[860px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">#</th>
                  <th className="th">Subject</th>
                  <th className="th">Priority</th>
                  <th className="th">Status</th>
                  <th className="th">Assignee</th>
                  <th className="th">SLA</th>
                  <th className="th">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((t) => (
                  <tr key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/tickets/${t.id}`)}>
                    <td className="td text-slate-400">{t.id}</td>
                    <td className="td max-w-xs">
                      <Link href={`/tickets/${t.id}`} className="block truncate font-medium text-slate-900 hover:underline">
                        {t.subject}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {t.requester.name} · {t.requester.email}
                        {t.commentsCount > 0 && ` · ${t.commentsCount} comment(s)`}
                      </p>
                    </td>
                    <td className="td">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="td">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="td">{t.assignee ? t.assignee.name : <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="td">
                      <SlaBadge ticket={t} now={now} />
                    </td>
                    <td className="td whitespace-nowrap text-xs text-slate-500">{now ? timeAgo(t.updatedAt, now) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-500">
              Page {data.page} of {data.totalPages} · {data.total} tickets
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5"
                disabled={page <= 1}
                onClick={() => setFilters({ page: String(page - 1) }, { resetPage: false })}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5"
                disabled={page >= data.totalPages}
                onClick={() => setFilters({ page: String(page + 1) }, { resetPage: false })}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TicketsView />
    </Suspense>
  );
}
