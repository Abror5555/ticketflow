'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActor } from '@/lib/actor';
import { useApi } from '@/lib/useApi';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/tickets', label: 'Tickets' },
  { href: '/tickets/new', label: 'New ticket' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [actor, setActor] = useActor();
  const { data: agents } = useApi('/agents');

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    if (href === '/tickets') return pathname === '/tickets' || /^\/tickets\/\d+/.test(pathname);
    return pathname === href;
  };

  return (
    <aside className="flex w-full flex-col border-b border-slate-200 bg-white md:h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="px-6 py-5">
        <p className="text-lg font-bold text-slate-900">
          Ticket<span className="text-brand-600">Flow</span>
        </p>
        <p className="text-xs text-slate-500">Customer support desk</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              isActive(link.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="hidden border-t border-slate-200 px-5 py-4 md:mt-auto md:block">
        <label className="label text-xs uppercase tracking-wide text-slate-500" htmlFor="actor">
          Acting as
        </label>
        <select id="actor" className="input" value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="Support agent">Support agent</option>
          {(agents || []).map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
