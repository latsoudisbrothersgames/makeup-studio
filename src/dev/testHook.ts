import type { AppliedLayer, CosmeticCategory } from '../types/cosmetic';
import type { Expression, Pt, RegionId } from '../types/face';

/** API για Playwright/χειροκίνητες δοκιμές — ενεργό με ?test=1 ή σε DEV. */
export interface StudioTestApi {
  ready: boolean;
  apply(category: CosmeticCategory, color: string, opts?: { variant?: string; regionId?: RegionId; at?: Pt }): void;
  setExpression(e: Expression | null): void;
  freeze(on: boolean): void;
  getLayers(): AppliedLayer[];
  undo(): void;
  clear(): void;
  regionCenterClient(id: RegionId): { x: number; y: number };
  swatchCenterClient(category: CosmeticCategory, color: string): { x: number; y: number } | null;
  saveAs(projectName: string, modelName: string): void;
}

declare global {
  interface Window {
    __studio?: StudioTestApi;
  }
}

export function testHooksEnabled(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('test') || /[?&]test=1/.test(window.location.hash);
}

export function installTestHook(api: StudioTestApi | null): void {
  if (api) window.__studio = api;
  else delete window.__studio;
}
