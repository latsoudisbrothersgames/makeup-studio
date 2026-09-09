import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { playSound } from '../audio/soundManager';
import { ActionBar } from '../components/ActionBar/ActionBar';
import { CosmeticsPanel, defaultSelection, paletteFor, type PanelSelection } from '../components/CosmeticsPanel/CosmeticsPanel';
import { ConfirmDialog } from '../components/Dialog/Dialog';
import { DragGhost } from '../components/DragGhost/DragGhost';
import { FaceStage, type FaceStageHandle } from '../components/FaceStage/FaceStage';
import { SaveDialog } from '../components/SaveDialog/SaveDialog';
import { Toast } from '../components/Toast/Toast';
import { COSMETICS } from '../data/cosmetics';
import { faceById } from '../data/faces';
import { S } from '../data/strings';
import { stickerUrls } from '../assets';
import { FaceAnimator, type Particle } from '../engine/animator';
import { loadImage } from '../engine/canvas';
import { Compositor, type SpriteMap } from '../engine/compositor';
import { centroid } from '../engine/geometry';
import type { DropResolution } from '../engine/hitTest';
import { hairCentroid } from '../engine/hairMask';
import { getRegion } from '../engine/regions';
import { makeThumbnail } from '../engine/thumbnail';
import { installTestHook, testHooksEnabled } from '../dev/testHook';
import { useDragCosmetic, type DragPayload } from '../hooks/useDragCosmetic';
import { useFaceImages } from '../hooks/useFaceImages';
import { loadDraft, loadGallery, newProjectId, sanitizeName, saveDraft, saveProject } from '../storage/gallery';
import { useSession } from '../state/SessionContext';
import { initialStudioState, newLayerId, studioReducer } from '../state/studioReducer';
import type { AppliedLayer, CosmeticCategory } from '../types/cosmetic';
import { REGION_IDS, type Expression, type Pt, type RegionId } from '../types/face';
import type { Project } from '../types/project';
import '../styles/layout.css';

type DialogKind = 'none' | 'confirmClear' | 'save' | 'leave';
type HintMood = 'idle' | 'good' | 'bad';

let spriteCache: Promise<SpriteMap> | null = null;
function loadSprites(): Promise<SpriteMap> {
  if (!spriteCache) {
    spriteCache = (async () => {
      const out: SpriteMap = {};
      for (const [name, url] of Object.entries(stickerUrls())) {
        try { out[name] = await loadImage(url); } catch { /* παραλείπεται */ }
      }
      return out;
    })();
  }
  return spriteCache;
}

export function StudioScreen() {
  const nav = useNavigate();
  const session = useSession();
  const [params] = useSearchParams();
  const debug = params.has('debug');

  // Το πρόσωπο έρχεται από τη συνεδρία ή από το ?face= (για δοκιμές/επανάληψη).
  const face = useMemo(() => faceById(session.faceId ?? params.get('face')), [session.faceId, params]);
  useEffect(() => {
    if (!face) nav('/choose', { replace: true });
    else if (!session.faceId) session.setFace(face.id);
    const m = params.get('model');
    if (m && !session.modelName) session.setModelName(sanitizeName(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [face]);

  const images = useFaceImages(face ?? null);
  const [sprites, setSprites] = useState<SpriteMap>({});
  useEffect(() => { void loadSprites().then(setSprites); }, []);
  const compositor = useMemo(
    () => (face && images ? new Compositor(face, images, COSMETICS, sprites) : null),
    [face, images, sprites],
  );

  const [state, dispatch] = useReducer(studioReducer, initialStudioState);
  const layersRef = useRef(state.layers);
  layersRef.current = state.layers;

  const [expr, setExpr] = useState<Expression>('neutral');
  const exprRef = useRef<Expression>('neutral');
  exprRef.current = expr;

  const stageRef = useRef<FaceStageHandle>(null);
  const overlayRef = useRef<{ hints: RegionId[]; glow: RegionId[] }>({ hints: [], glow: [] });
  const particlesRef = useRef<Particle[]>([]);
  const [hint, setHint] = useState<{ text: string; mood: HintMood }>({ text: S.hintIdle, mood: 'idle' });
  const [dialog, setDialog] = useState<DialogKind>('none');
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sel, setSel] = useState<PanelSelection>(() => defaultSelection('lipstick', face ?? faceById('f1')!));
  const enabledRef = useRef(true);
  enabledRef.current = dialog === 'none';

  // ── Φόρτωση έργου / πρόχειρου ─────────────────────────────────────
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!face) return;
    const key = `${face.id}|${params.get('project') ?? ''}|${params.get('new') ?? ''}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    const pid = params.get('project');
    if (pid) {
      const p = loadGallery().find((x) => x.id === pid);
      if (p && p.faceId === face.id) {
        dispatch({ type: 'load', layers: p.layers });
        session.setProjectId(p.id);
        return;
      }
    }
    if (!params.has('new')) {
      const d = loadDraft();
      if (d && d.faceId === face.id) {
        dispatch({ type: 'load', layers: d.layers });
        session.setProjectId(d.projectId);
        return;
      }
    }
    dispatch({ type: 'load', layers: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [face, params]);

  // Πρόχειρο: ό,τι αλλάζει σώζεται ώστε ένα reload να μη χάνει τη δουλειά.
  useEffect(() => {
    if (!face) return;
    const t = window.setTimeout(() => {
      saveDraft({ faceId: face.id, modelName: session.modelName, projectId: session.projectId, layers: state.layers });
    }, 250);
    return () => window.clearTimeout(t);
  }, [face, state.layers, session.modelName, session.projectId]);

  // ── Απόδοση ───────────────────────────────────────────────────────
  const drawOverlayNow = useCallback(() => {
    const st = stageRef.current;
    if (!st) return;
    const o = overlayRef.current;
    st.overlay(exprRef.current, {
      hints: debug ? REGION_IDS : o.hints,
      glow: o.glow,
      particles: particlesRef.current,
    });
  }, [debug]);

  useEffect(() => {
    stageRef.current?.render(expr, state.layers);
    drawOverlayNow();
  }, [compositor, expr, state.layers, drawOverlayNow]);

  const animator = useMemo(
    () =>
      new FaceAnimator({
        onExpression: (e) => setExpr(e),
        onFrame: (pulse, particles) => {
          particlesRef.current = particles;
          stageRef.current?.render(exprRef.current, layersRef.current, pulse);
          drawOverlayNow();
        },
      }),
    [drawOverlayNow],
  );
  useEffect(() => {
    animator.start();
    return () => animator.stop();
  }, [animator]);

  // ── Εφαρμογή καλλυντικού ──────────────────────────────────────────
  const applyLayer = useCallback((layer: AppliedLayer, anchor?: Pt) => {
    dispatch({ type: 'apply', layer });
    compositor?.prewarm(layer, ['neutral', 'blink', 'smile', 'wow'].filter((e) => e !== exprRef.current) as Expression[]);
    const def = COSMETICS[layer.category];
    animator.trigger(def.anim, anchor);
    playSound(def.anim === 'wow' ? 'wow' : 'pop');
    window.setTimeout(() => playSound('sparkle'), 90);
    stageRef.current?.bounce();
  }, [animator, compositor]);

  const onDrop = useCallback((p: DragPayload, res: Extract<DropResolution, { ok: true }>) => {
    const layer: AppliedLayer = {
      id: newLayerId(),
      category: p.cosmetic.category,
      color: p.color,
      variant: p.variant,
      regionIds: res.regionIds,
      at: p.cosmetic.target.kind === 'free' ? res.anchor : undefined,
      seed: Math.floor(Math.random() * 1e9),
    };
    applyLayer(layer, res.anchor);
    setHint({ text: S.hintDone, mood: 'good' });
    window.setTimeout(() => setHint((h) => (h.text === S.hintDone ? { text: S.hintIdle, mood: 'idle' } : h)), 1400);
  }, [applyLayer]);

  const drag = useDragCosmetic({
    face: face ?? faceById('f1')!,
    stageRef,
    exprRef,
    enabledRef,
    onHover: (p, hints, res) => {
      overlayRef.current = { hints, glow: res && res.ok ? res.regionIds : [] };
      drawOverlayNow();
      if (res === null) setHint({ text: p.cosmetic.hintEl, mood: 'idle' });
      else if (res.ok) setHint({ text: S.hintDropHere, mood: 'good' });
      else setHint({ text: p.cosmetic.hintEl, mood: 'idle' });
    },
    onDrop,
    onEnd: () => {
      overlayRef.current = { hints: [], glow: [] };
      drawOverlayNow();
      setHint((h) => (h.mood === 'good' ? h : { text: S.hintIdle, mood: 'idle' }));
    },
  });

  // ── Ενέργειες ─────────────────────────────────────────────────────
  const doUndo = () => { dispatch({ type: 'undo' }); playSound('undo'); };
  const doClear = () => {
    dispatch({ type: 'clear' });
    playSound('clear');
    setDialog('none');
    setHint({ text: S.hintCleared, mood: 'good' });
  };

  const persist = useCallback((projectName: string, modelName: string): boolean => {
    if (!face || !compositor) return false;
    // Thumbnail πάντα με ουδέτερη έκφραση.
    const neutral = compositor.render('neutral', layersRef.current);
    const thumb = makeThumbnail(neutral);
    stageRef.current?.render(exprRef.current, layersRef.current);
    const existing = session.projectId ? loadGallery().find((p) => p.id === session.projectId) : undefined;
    const now = new Date().toISOString();
    const project: Project = {
      v: 1,
      id: existing?.id ?? newProjectId(),
      faceId: face.id,
      projectName,
      modelName,
      layers: layersRef.current,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      thumb,
    };
    const r = saveProject(project);
    if (r === 'full') { setToast(S.galleryFull); return false; }
    if (r === 'unavailable') { setToast(S.storageUnavailable); return false; }
    session.setProjectId(project.id);
    session.setModelName(modelName);
    dispatch({ type: 'markSaved' });
    playSound('save');
    setToast(r === 'ok-no-thumb' ? S.savedNoThumb : S.saved);
    return true;
  }, [face, compositor, session]);

  const onSaveClick = () => {
    if (session.projectId) {
      const existing = loadGallery().find((p) => p.id === session.projectId);
      if (existing) { persist(existing.projectName, session.modelName); return; }
    }
    setDialog('save');
  };

  const guardedNav = (to: string) => {
    if (state.dirty && state.layers.length > 0) {
      setPendingNav(to);
      setDialog('leave');
    } else {
      nav(to);
    }
  };

  // ── Test hook ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!face || !testHooksEnabled()) return;
    const api = {
      ready: !!compositor,
      apply(category: CosmeticCategory, color: string, opts?: { variant?: string; regionId?: RegionId; at?: Pt }) {
        const c = COSMETICS[category];
        let regionIds: RegionId[] = [];
        let at: Pt | undefined;
        if (c.target.kind === 'regions') {
          regionIds = opts?.regionId ? [opts.regionId] : c.target.regions.filter((r) => !r.startsWith('eyeHole') && !r.startsWith('lid') || category !== 'eyeliner' && category !== 'mascara');
          if (category === 'eyeliner' || category === 'mascara') regionIds = ['lashL', 'lashR'];
        } else if (c.target.kind === 'face') {
          regionIds = ['skin'];
        } else if (c.target.kind === 'hair') {
          regionIds = ['hair'];
          at = undefined;
        } else {
          at = opts?.at ?? centroid(getRegion(face.regions, 'neutral', 'cheekL').points);
        }
        const layer: AppliedLayer = {
          id: newLayerId(), category, color, variant: opts?.variant ?? c.variants?.[0], regionIds, at, seed: 12345,
        };
        applyLayer(layer, at ?? (c.target.kind === 'hair' ? hairCentroid(face.id) : centroid(getRegion(face.regions, 'neutral', regionIds[0] ?? 'skin').points)));
      },
      setExpression: (e: Expression | null) => animator.setExpression(e),
      freeze: (on: boolean) => animator.freeze(on),
      getLayers: () => layersRef.current,
      undo: doUndo,
      clear: () => dispatch({ type: 'clear' }),
      regionCenterClient(id: RegionId) {
        const c = centroid(getRegion(face.regions, exprRef.current, id).points);
        return stageRef.current?.faceToClient(c) ?? { x: 0, y: 0 };
      },
      swatchCenterClient(category: CosmeticCategory, color: string) {
        setSel(defaultSelection(category, face));
        const el = document.querySelector<HTMLElement>(`[data-swatch="${category}:${color}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
      saveAs: (projectName: string, modelName: string) => { persist(projectName, modelName); },
    };
    installTestHook(api);
    return () => installTestHook(null);
  }, [face, compositor, animator, applyLayer, persist]);

  if (!face) return null;

  const galleryCount = loadGallery().length;
  const defaultProjectName = S.defaultProjectName(galleryCount + 1);

  return (
    <main className="screen studio" data-expr={expr}>
      <div className="studio__bar">
        <ActionBar
          faceName={face.nameEl}
          modelName={session.modelName}
          canUndo={state.history.length > 0}
          canClear={state.layers.length > 0}
          onUndo={doUndo}
          onClear={() => setDialog('confirmClear')}
          onSave={onSaveClick}
          onGallery={() => guardedNav('/gallery')}
          onChangeFace={() => guardedNav('/choose')}
        />
      </div>
      <div className={`hintbar studio__hint hintbar--${hint.mood}`} aria-live="polite">{hint.text}</div>
      <div className="studio__stage">
        <FaceStage face={face} compositor={compositor} ref={stageRef} />
      </div>
      <div className="studio__panel">
        <CosmeticsPanel
          face={face}
          sel={sel}
          onSel={setSel}
          onStartDrag={(e, p) => drag.startDrag(e, p)}
        />
      </div>
      <DragGhost ghost={drag.ghost} ref={drag.ghostRef} />

      {dialog === 'confirmClear' && (
        <ConfirmDialog title={S.confirmClearTitle} body={S.confirmClearBody} yesLabel={S.yesClear} onYes={doClear} onNo={() => setDialog('none')} />
      )}
      {dialog === 'leave' && (
        <ConfirmDialog
          title={S.leaveUnsavedTitle}
          body={S.leaveUnsavedBody}
          yesLabel={S.yesLeave}
          onYes={() => { setDialog('none'); if (pendingNav) nav(pendingNav); }}
          onNo={() => setDialog('none')}
        />
      )}
      {dialog === 'save' && (
        <SaveDialog
          defaultProjectName={defaultProjectName}
          defaultModelName={session.modelName}
          onSave={(p, m) => { if (persist(p, m)) setDialog('none'); }}
          onCancel={() => setDialog('none')}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
      {/* Κρατά την παλέτα της βάσης ενημερωμένη αν αλλάξει πρόσωπο */}
      <span className="visually-hidden">{paletteFor(COSMETICS[sel.category], face).length}</span>
    </main>
  );
}
