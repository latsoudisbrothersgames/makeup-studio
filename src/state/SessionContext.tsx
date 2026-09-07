import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadLastName, readStorage, SETTINGS_KEY, saveLastName, writeStorage } from '../storage/session';
import { setSoundEnabled } from '../audio/soundManager';
import type { FaceId } from '../types/face';

export interface Session {
  faceId: FaceId | null;
  modelName: string;
  projectId: string | null;
  soundEnabled: boolean;
}

interface SessionApi extends Session {
  setFace(faceId: FaceId): void;
  setModelName(name: string): void;
  setProjectId(id: string | null): void;
  setSound(on: boolean): void;
}

const Ctx = createContext<SessionApi | null>(null);

interface Settings { soundEnabled: boolean }
const isSettings = (v: unknown): v is Settings => !!v && typeof v === 'object' && typeof (v as Settings).soundEnabled === 'boolean';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Session>(() => {
    const settings = readStorage<Settings>(SETTINGS_KEY, { soundEnabled: true }, isSettings);
    setSoundEnabled(settings.soundEnabled);
    return { faceId: null, modelName: loadLastName(), projectId: null, soundEnabled: settings.soundEnabled };
  });

  const setFace = useCallback((faceId: FaceId) => setState((s) => ({ ...s, faceId })), []);
  const setModelName = useCallback((modelName: string) => {
    saveLastName(modelName);
    setState((s) => ({ ...s, modelName }));
  }, []);
  const setProjectId = useCallback((projectId: string | null) => setState((s) => ({ ...s, projectId })), []);
  const setSound = useCallback((soundEnabled: boolean) => {
    setSoundEnabled(soundEnabled);
    writeStorage(SETTINGS_KEY, { soundEnabled });
    setState((s) => ({ ...s, soundEnabled }));
  }, []);

  const api = useMemo<SessionApi>(() => ({ ...state, setFace, setModelName, setProjectId, setSound }), [state, setFace, setModelName, setProjectId, setSound]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession έξω από SessionProvider');
  return v;
}
