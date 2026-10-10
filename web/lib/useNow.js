'use client';

import { useSyncExternalStore } from 'react';

/**
 * Current time, refreshed every minute, so "Due in 1h 20m" labels stay correct
 * while the page is open. The snapshot is rounded to the minute so React sees a
 * stable value between ticks.
 */
const MINUTE = 60 * 1000;

function subscribe(callback) {
  const id = setInterval(callback, MINUTE / 2);
  return () => clearInterval(id);
}

const getSnapshot = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const getServerSnapshot = () => 0;

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
