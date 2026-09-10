import type { AppliedLayer } from './cosmetic';
import type { FaceId } from './face';

export interface Project {
  v: 1;
  id: string;
  faceId: FaceId;
  projectName: string;
  modelName: string;
  layers: AppliedLayer[];
  createdAt: string;
  updatedAt: string;
  /** 128px PNG data URL ή '' αν δεν χώρεσε. */
  thumb: string;
  /** Άλμπουμ: από πού ήρθε η δημιουργία. */
  kind?: 'studio' | 'salon';
  /** Σαλόνι: όνομα πελάτισσας και αφορμή («Πάει σε γάμο.»). */
  customer?: string;
  occasion?: string;
  /** Αστέρια της πελάτισσας (0–3). */
  stars?: number;
}

export type SaveResult = 'ok' | 'ok-no-thumb' | 'full' | 'unavailable';
