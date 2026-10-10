import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError, apiRequest, toQuery } from '../lib/api';
import { describeEvent, formatDuration, initials, slaState } from '../lib/format';

afterEach(() => vi.unstubAllGlobals());

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2030-05-01T12:00:00Z');

describe('toQuery', () => {
  test('skips empty values', () => {
    expect(toQuery({ status: 'open', search: '', page: 2, overdue: undefined })).toBe('?status=open&page=2');
    expect(toQuery({})).toBe('');
  });
});

describe('apiRequest', () => {
  test('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 7 }) }));
    await expect(apiRequest('/tickets/7')).resolves.toEqual({ id: 7 });
  });

  test('turns the API error format into ApiError with field errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            error: { code: 'ASSIGNEE_REQUIRED', message: 'Assign the ticket first', details: {} },
          }),
      }),
    );
    const error = await apiRequest('/tickets/1/status', { method: 'POST', body: { status: 'in_progress' } }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'ASSIGNEE_REQUIRED', message: 'Assign the ticket first' });
  });

  test('reports a readable message when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = await apiRequest('/tickets').catch((e) => e);
    expect(error.code).toBe('NETWORK_ERROR');
  });
});

describe('formatDuration', () => {
  test('uses minutes, hours or days depending on size', () => {
    expect(formatDuration(45 * 60000)).toBe('45m');
    expect(formatDuration(95 * 60000)).toBe('1h 35m');
    expect(formatDuration(50 * HOUR)).toBe('2d 2h');
    expect(formatDuration(-95 * 60000)).toBe('1h 35m');
  });
});

describe('slaState', () => {
  const ticket = (status, dueInHours) => ({ status, dueAt: new Date(NOW + dueInHours * HOUR).toISOString() });

  test('shows time left, a warning near the deadline and overdue after it', () => {
    expect(slaState(ticket('open', 5), NOW)).toEqual({ tone: 'ok', label: 'Due in 5h 0m' });
    expect(slaState(ticket('in_progress', 1.5), NOW)).toEqual({ tone: 'warning', label: 'Due in 1h 30m' });
    expect(slaState(ticket('waiting_on_customer', -3), NOW)).toEqual({ tone: 'danger', label: 'Overdue 3h 0m' });
  });

  test('done tickets have no SLA badge', () => {
    expect(slaState(ticket('resolved', -3), NOW)).toBeNull();
    expect(slaState(ticket('closed', -3), NOW)).toBeNull();
  });
});

describe('activity text', () => {
  test('describes each event type', () => {
    expect(describeEvent({ type: 'status_changed', from: 'open', to: 'in_progress' })).toBe(
      'changed status from Open to In progress',
    );
    expect(describeEvent({ type: 'assigned', from: null, to: 'Sarah Chen' })).toBe('assigned the ticket to Sarah Chen');
    expect(describeEvent({ type: 'assigned', from: 'Sarah Chen', to: null })).toBe('unassigned Sarah Chen');
    expect(initials('Sarah Chen')).toBe('SC');
    expect(initials('')).toBe('?');
  });
});
