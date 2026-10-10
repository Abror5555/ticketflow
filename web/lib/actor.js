'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * "Acting as" agent name, remembered in localStorage.
 * useSyncExternalStore keeps server and client rendering consistent
 * (the server always renders the default, the browser then shows the saved value).
 * If storage is blocked (private mode), the value is kept in memory instead.
 */
const KEY = 'ticketflow.actor';
const DEFAULT_ACTOR = 'Support agent';
const listeners = new Set();
let memoryValue = null;

function read() {
  try {
    return window.localStorage.getItem(KEY) || memoryValue || DEFAULT_ACTOR;
  } catch {
    return memoryValue || DEFAULT_ACTOR;
  }
}

function subscribe(callback) {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

export function useActor() {
  const actor = useSyncExternalStore(subscribe, read, () => DEFAULT_ACTOR);
  const setActor = useCallback((value) => {
    memoryValue = value;
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      // storage unavailable: memoryValue is enough for this session
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [actor, setActor];
}
