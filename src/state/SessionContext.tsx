import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadLastName, readStorage, SETTINGS_KEY, saveLastName, writeStorage } from '../storage/session';
import { setSoundEnabled } from '../audio/soundManager';
import type { FaceId } from '../types/face';
import { STAGE_BGS, type StageBg } from '../data/shop';

export interface Session {
  faceId: FaceId | null;
  modelName: string;
  projectId: string | null;
  soundEnabled: boolean;
  /** Σκηνικό πίσω από το πρόσωπο (αγορά από το κατάστημα). */
  stageBg: StageBg;
}

interface SessionApi extends Session {
  setFace(faceId: FaceId): void;
  setModelName(name: string): void;
  setProjectId(id: string | null): void;
  setSound(on: boolean): void;
  setStageBg(bg: StageBg): void;
}

const Ctx = createContext<SessionApi | null>(null);

interface Settings { soundEnabled: boolean; stageBg?: StageBg }
const isSettings = (v: unknown): v is Settings => !!v && typeof v === 'object' && typeof (v as Settings).soundEnabled === 'boolean';
const validBg = (b: unknown): StageBg => (STAGE_BGS.includes(b as StageBg) ? (b as StageBg) : 'classic');

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Session>(() => {
    const settings = readStorage<Settings>(SETTINGS_KEY, { soundEnabled: true }, isSettings);
    setSoundEnabled(settings.soundEnabled);
    return { faceId: null, modelName: loadLastName(), projectId: null, soundEnabled: settings.soundEnabled, stageBg: validBg(settings.stageBg) };
  });

  const setFace = useCallback((faceId: FaceId) => setState((s) => ({ ...s, faceId })), []);
  const setModelName = useCallback((modelName: string) => {
    saveLastName(modelName);
    setState((s) => ({ ...s, modelName }));
  }, []);
  const setProjectId = useCallback((projectId: string | null) => setState((s) => ({ ...s, projectId })), []);
  const setSound = useCallback((soundEnabled: boolean) => {
    setSoundEnabled(soundEnabled);
    setState((s) => { writeStorage(SETTINGS_KEY, { soundEnabled, stageBg: s.stageBg }); return { ...s, soundEnabled }; });
  }, []);
  const setStageBg = useCallback((stageBg: StageBg) => {
    setState((s) => { writeStorage(SETTINGS_KEY, { soundEnabled: s.soundEnabled, stageBg }); return { ...s, stageBg }; });
  }, []);

  const api = useMemo<SessionApi>(() => ({ ...state, setFace, setModelName, setProjectId, setSound, setStageBg }), [state, setFace, setModelName, setProjectId, setSound, setStageBg]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession έξω από SessionProvider');
  return v;
}
