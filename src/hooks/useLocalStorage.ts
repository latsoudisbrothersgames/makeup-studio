import { useCallback, useState } from 'react';

/**
 * Ασφαλής πρόσβαση στο localStorage: κατεστραμμένα ή ελλιπή δεδομένα
 * δεν πρέπει ποτέ να ρίχνουν την εφαρμογή. (Από τον Γύρο του Κόσμου.)
 */
export function readStorage<T>(key: string, fallback: T, validate?: (v: unknown) => v is T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // γεμάτος χώρος ή private mode — αγνοείται σιωπηλά
  }
}

export type WriteOutcome = 'ok' | 'quota' | 'unavailable';

/** Όπως writeStorage, αλλά αναφέρει ΓΙΑΤΙ απέτυχε (για την αποθήκευση έργων). */
export function writeStorageStrict<T>(key: string, value: T): WriteOutcome {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return 'ok';
  } catch (e) {
    const name = (e as { name?: string })?.name ?? '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || (e as { code?: number })?.code === 22) return 'quota';
    return 'unavailable';
  }
}

export function useLocalStorage<T>(
  key: string,
  fallback: T,
  validate?: (v: unknown) => v is T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => readStorage(key, fallback, validate));

  const set = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        writeStorage(key, next);
        return next;
      });
    },
    [key],
  );

  return [state, set];
}
