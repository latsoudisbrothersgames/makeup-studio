import { readStorage, writeStorage } from './session';

/**
 * Πίνακας αστεριών: αστέρια ανά όνομα παιδιού (localStorage της συσκευής του κλαμπ).
 * Τα αστέρια κερδίζονται στο παιχνίδι «Αντίγραψε το στυλ» και ξεκλειδώνουν περιεχόμενο (βλ. data/unlocks.ts).
 */
export const PLAYERS_KEY = 'makeupStudio:players:v1';
export const ANONYMOUS = 'Παίκτης';
const MAX_PLAYERS = 60;

export interface PlayerStats {
  name: string;
  stars: number;
  games: number;
  /** Καλύτερο αποτέλεσμα ανά επίπεδο (αστέρια 0–3). */
  best: Record<string, number>;
  updatedAt: string;
}

type Table = Record<string, PlayerStats>;

const isTable = (v: unknown): v is Table =>
  !!v && typeof v === 'object' && Object.values(v as object).every((p) => p && typeof (p as PlayerStats).stars === 'number');

function key(name: string): string {
  return (name || ANONYMOUS).trim().toLowerCase();
}

export function loadPlayers(): Table {
  return readStorage<Table>(PLAYERS_KEY, {}, isTable);
}

export function playerStars(name: string): number {
  return loadPlayers()[key(name)]?.stars ?? 0;
}

/** Προσθέτει αστέρια και επιστρέφει το νέο σύνολο του παίκτη. */
export function addStars(name: string, stars: number, level: number): number {
  const table = loadPlayers();
  const k = key(name);
  const cur = table[k] ?? { name: name || ANONYMOUS, stars: 0, games: 0, best: {}, updatedAt: '' };
  cur.name = name || ANONYMOUS;
  cur.stars += stars;
  cur.games += 1;
  cur.best[level] = Math.max(cur.best[level] ?? 0, stars);
  cur.updatedAt = new Date().toISOString();
  table[k] = cur;
  // Ο πίνακας μένει μικρός: πετάμε τους λιγότερο πρόσφατους αν ξεπεραστεί το όριο.
  const keys = Object.keys(table);
  if (keys.length > MAX_PLAYERS) {
    keys.sort((a, b) => table[a].updatedAt.localeCompare(table[b].updatedAt));
    for (const k2 of keys.slice(0, keys.length - MAX_PLAYERS)) delete table[k2];
  }
  writeStorage(PLAYERS_KEY, table);
  window.dispatchEvent(new CustomEvent('makeup:players-changed'));
  return cur.stars;
}

/** Κατάταξη: περισσότερα αστέρια πρώτα, μετά πιο πρόσφατος. */
export function topPlayers(n = 8): PlayerStats[] {
  return Object.values(loadPlayers())
    .sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, n);
}
