import { COSMETICS } from '../data/cosmetics';
import { isFaceId } from '../data/faces';
import { readStorage, writeStorage, writeStorageStrict } from '../hooks/useLocalStorage';
import type { AppliedLayer } from '../types/cosmetic';
import type { Project, SaveResult } from '../types/project';

/** Κλειδιά με έκδοση για μελλοντικές μεταφορές δεδομένων. */
export const GALLERY_KEY = 'makeupStudio:gallery:v1';
export const LAST_NAME_KEY = 'makeupStudio:lastModelName:v1';
export const SETTINGS_KEY = 'makeupStudio:settings:v1';
export const DRAFT_KEY = 'makeupStudio:draft:v1';

export const MAX_PROJECTS = 60;
export const MAX_NAME_LENGTH = 20;

/** Σε περίπτωση που το localStorage δεν λειτουργεί, κρατάμε τη γκαλερί στη μνήμη της συνεδρίας. */
let memoryGallery: Project[] | null = null;

export function sanitizeName(raw: string): string {
  return raw.replace(/[<>\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isAppliedLayer(v: unknown): v is AppliedLayer {
  if (!v || typeof v !== 'object') return false;
  const l = v as AppliedLayer;
  return (
    typeof l.id === 'string' &&
    typeof l.category === 'string' &&
    l.category in COSMETICS &&
    typeof l.color === 'string' &&
    (HEX.test(l.color) || l.color === '') &&
    Array.isArray(l.regionIds) &&
    l.regionIds.every((r) => typeof r === 'string') &&
    (l.at === undefined || (Array.isArray(l.at) && l.at.length === 2)) &&
    typeof l.seed === 'number'
  );
}

export function isProject(v: unknown): v is Project {
  if (!v || typeof v !== 'object') return false;
  const p = v as Project;
  return (
    p.v === 1 &&
    typeof p.id === 'string' &&
    isFaceId(p.faceId) &&
    typeof p.projectName === 'string' &&
    typeof p.modelName === 'string' &&
    Array.isArray(p.layers) &&
    p.layers.every(isAppliedLayer) &&
    typeof p.createdAt === 'string' &&
    typeof p.updatedAt === 'string' &&
    typeof p.thumb === 'string'
  );
}

export function loadGallery(): Project[] {
  if (memoryGallery) return memoryGallery;
  const raw = readStorage<unknown[]>(GALLERY_KEY, [], Array.isArray);
  return raw.filter(isProject);
}

export function newProjectId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function persist(list: Project[]): SaveResult {
  const r = writeStorageStrict(GALLERY_KEY, list);
  if (r === 'ok') {
    memoryGallery = null;
    return 'ok';
  }
  if (r === 'unavailable') {
    memoryGallery = list;
    return 'unavailable';
  }
  return 'full';
}

/** Αποθηκεύει (νέο ή αντικατάσταση). Σε γεμάτο χώρο ξαναπροσπαθεί χωρίς thumbnail. */
export function saveProject(p: Project): SaveResult {
  const list = loadGallery();
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx < 0 && list.length >= MAX_PROJECTS) return 'full';
  const next = idx < 0 ? [p, ...list] : list.map((x) => (x.id === p.id ? p : x));
  next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  let r = persist(next);
  if (r === 'full') {
    const slim = next.map((x) => (x.id === p.id ? { ...x, thumb: '' } : x));
    r = persist(slim);
    if (r === 'ok') return 'ok-no-thumb';
    if (r === 'full') return 'full';
  }
  return r;
}

export function deleteProject(id: string): void {
  const next = loadGallery().filter((x) => x.id !== id);
  persist(next);
}

export function loadLastName(): string {
  return readStorage<string>(LAST_NAME_KEY, '', (v): v is string => typeof v === 'string');
}

export function saveLastName(name: string): void {
  writeStorage(LAST_NAME_KEY, name);
}

export interface Draft {
  faceId: string;
  modelName: string;
  projectId: string | null;
  layers: AppliedLayer[];
}

export function loadDraft(): Draft | null {
  const d = readStorage<Draft | null>(DRAFT_KEY, null, (v): v is Draft => {
    const x = v as Draft;
    return !!x && typeof x === 'object' && isFaceId(x.faceId) && Array.isArray(x.layers) && x.layers.every(isAppliedLayer);
  });
  return d;
}

export function saveDraft(d: Draft | null): void {
  if (!d) {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* αγνοείται */ }
    return;
  }
  writeStorage(DRAFT_KEY, d);
}
