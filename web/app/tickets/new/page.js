'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useActor } from '@/lib/actor';
import { PRIORITY_LABELS, SLA_HOURS } from '@/lib/format';
import { Notice, PageHeader } from '@/components/ui';

const EMPTY = { subject: '', description: '', requesterName: '', requesterEmail: '', priority: 'medium' };

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? <p className="field-error">{error}</p> : hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}

export default function NewTicketPage() {
  const router = useRouter();
  const [actor] = useActor();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const ticket = await apiRequest('/tickets', { method: 'POST', body: { ...form, actor } });
      router.push(`/tickets/${ticket.id}?created=1`);
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="New ticket" description="Log a customer request. The SLA deadline is set from the priority." />
      {formError && (
        <Notice type="error" onClose={() => setFormError(null)}>
          {formError}
        </Notice>
      )}
      <form onSubmit={submit} className="card max-w-2xl space-y-4 p-6" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" error={errors.requesterName}>
            <input className={`input ${errors.requesterName ? 'input-error' : ''}`} value={form.requesterName} onChange={set('requesterName')} />
          </Field>
          <Field label="Customer email" error={errors.requesterEmail}>
            <input
              type="email"
              className={`input ${errors.requesterEmail ? 'input-error' : ''}`}
              value={form.requesterEmail}
              onChange={set('requesterEmail')}
            />
          </Field>
        </div>
        <Field label="Subject" error={errors.subject}>
          <input className={`input ${errors.subject ? 'input-error' : ''}`} value={form.subject} onChange={set('subject')} />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea
            rows={6}
            className={`input ${errors.description ? 'input-error' : ''}`}
            value={form.description}
            onChange={set('description')}
          />
        </Field>
        <Field label="Priority" error={errors.priority} hint={`Response deadline: ${SLA_HOURS[form.priority]} hours`}>
          <select className="input sm:w-60" value={form.priority} onChange={set('priority')}>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create ticket'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
