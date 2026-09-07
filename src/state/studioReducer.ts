import { COSMETICS } from '../data/cosmetics';
import type { AppliedLayer } from '../types/cosmetic';

export interface StudioState {
  layers: AppliedLayer[];
  history: AppliedLayer[][];
  /** Έχει αλλάξει από την τελευταία αποθήκευση/φόρτωση; */
  dirty: boolean;
}

export type StudioAction =
  | { type: 'apply'; layer: AppliedLayer }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'load'; layers: AppliedLayer[] }
  | { type: 'markSaved' };

export const MAX_HISTORY = 50;

export const initialStudioState: StudioState = { layers: [], history: [], dirty: false };

function sameRegions(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'apply': {
      const history = [...state.history.slice(-(MAX_HISTORY - 1)), state.layers];
      const def = COSMETICS[action.layer.category];
      let layers = state.layers;
      if (def.singleton) {
        layers = layers.filter((l) => !(l.category === action.layer.category && sameRegions(l.regionIds, action.layer.regionIds)));
      }
      return { layers: [...layers, action.layer], history, dirty: true };
    }
    case 'undo': {
      if (state.history.length === 0) return state;
      const layers = state.history[state.history.length - 1];
      return { layers, history: state.history.slice(0, -1), dirty: true };
    }
    case 'clear': {
      if (state.layers.length === 0) return state;
      return { layers: [], history: [...state.history.slice(-(MAX_HISTORY - 1)), state.layers], dirty: true };
    }
    case 'load':
      return { layers: action.layers, history: [], dirty: false };
    case 'markSaved':
      return { ...state, dirty: false };
    default:
      return state;
  }
}

export function newLayerId(): string {
  return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
