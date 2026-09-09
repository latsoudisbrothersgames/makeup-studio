import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { playSound } from '../audio/soundManager';
import { loadSprites } from '../assets/sprites';
import { Button } from '../components/Button/Button';
import { CosmeticsPanel, defaultSelection, type PanelSelection } from '../components/CosmeticsPanel/CosmeticsPanel';
import { ConfirmDialog, Dialog } from '../components/Dialog/Dialog';
import { DragGhost } from '../components/DragGhost/DragGhost';
import { FaceStage, type FaceStageHandle } from '../components/FaceStage/FaceStage';
import { COSMETICS } from '../data/cosmetics';
import { faceById } from '../data/faces';
import { LEVELS, levelById, makePreset, matchedItems, type Level } from '../data/presets';
import { S } from '../data/strings';
import { testHooksEnabled } from '../dev/testHook';
import { FaceAnimator, type Particle } from '../engine/animator';
import { Compositor, type SpriteMap } from '../engine/compositor';
import type { DropResolution } from '../engine/hitTest';
import { layerAt } from '../engine/layerAt';
import { decorateAccessory, isAccessorySlot } from '../data/accessories';
import { useDragCosmetic, type DragPayload } from '../hooks/useDragCosmetic';
import { useFaceImages } from '../hooks/useFaceImages';
import { useSession } from '../state/SessionContext';
import { initialStudioState, newLayerId, studioReducer } from '../state/studioReducer';
import type { AppliedLayer } from '../types/cosmetic';
import { REGION_IDS, type Expression, type Pt, type RegionId } from '../types/face';
import '../styles/layout.css';
import './GameScreen.css';

type Phase = 'intro' | 'play' | 'result';
type HintMood = 'idle' | 'good' | 'bad';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Παιχνίδι «Αντίγραψε το στυλ»: αριστερά έτοιμο στυλ, δεξιά το ίδιο κορίτσι, χρονόμετρο. */
export function GameScreen() {
  const nav = useNavigate();
  const session = useSession();
  const [params] = useSearchParams();
  const debug = params.get('debug') === '1';
  const face = faceById(params.get('face') ?? session.faceId) ?? faceById('f1')!;
  useEffect(() => { if (session.faceId !== face.id) session.setFace(face.id); }, [face, session]);

  const images = useFaceImages(face);
  const [sprites, setSprites] = useState<SpriteMap>({});
  useEffect(() => { void loadSprites().then(setSprites); }, []);
  const compositor = useMemo(() => (images ? new Compositor(face, images, COSMETICS, sprites) : null), [face, images, sprites]);
  const targetCompositor = useMemo(() => (images ? new Compositor(face, images, COSMETICS, sprites) : null), [face, images, sprites]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [level, setLevel] = useState<Level>(() => levelById(Number(params.get('level'))));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const preset = useMemo(() => makePreset(face, level, seed), [face, level, seed]);
  const [remaining, setRemaining] = useState(level.seconds);
  const [dialog, setDialog] = useState<'none' | 'exit'>('none');

  const [state, dispatch] = useReducer(studioReducer, initialStudioState);
  const layersRef = useRef(state.layers);
  const [expr, setExpr] = useState<Expression>('neutral');
  const exprRef = useRef<Expression>('neutral');
  useEffect(() => { layersRef.current = state.layers; }, [state.layers]);
  useEffect(() => { exprRef.current = expr; }, [expr]);

  const stageRef = useRef<FaceStageHandle>(null);
  const targetRef = useRef<FaceStageHandle>(null);
  const overlayRef = useRef<{ hints: RegionId[]; glow: RegionId[] }>({ hints: [], glow: [] });
  const particlesRef = useRef<Particle[]>([]);
  const [hint, setHint] = useState<{ text: string; mood: HintMood }>({ text: S.gameHintIdle, mood: 'idle' });
  const [sel, setSel] = useState<PanelSelection>(() => defaultSelection('lipstick', face));
  const enabledRef = useRef(false);
  useEffect(() => { enabledRef.current = phase === 'play' && dialog === 'none'; }, [phase, dialog]);

  const matched = useMemo(() => matchedItems(preset, state.layers), [preset, state.layers]);
  const found = matched.filter(Boolean).length;
  const total = preset.length;

  // ── Απόδοση ───────────────────────────────────────────────────────
  const drawOverlayNow = useCallback(() => {
    const o = overlayRef.current;
    stageRef.current?.overlay(exprRef.current, { hints: debug ? REGION_IDS : o.hints, glow: o.glow, particles: particlesRef.current });
  }, [debug]);

  useEffect(() => {
    stageRef.current?.render(expr, state.layers);
    drawOverlayNow();
  }, [compositor, expr, state.layers, drawOverlayNow]);

  useEffect(() => {
    targetRef.current?.render('neutral', preset);
  }, [targetCompositor, preset]);

  const animator = useMemo(
    () => new FaceAnimator({
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

  // ── Χρονόμετρο ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return;
    const t = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) return 0;
        if (r <= 11) playSound('click');
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  const finished = useRef(false);
  useEffect(() => {
    if (phase !== 'play' || finished.current) return;
    if (found === total || remaining === 0) {
      finished.current = true;
      playSound(found === total ? 'save' : 'boing');
      if (found === total) animator.trigger('wow', [256, 240]);
      window.setTimeout(() => setPhase('result'), found === total ? 700 : 300);
    }
  }, [phase, found, total, remaining, animator]);

  const start = (lv: Level) => {
    setLevel(lv);
    setSeed(Math.floor(Math.random() * 1e9));
    setRemaining(lv.seconds);
    finished.current = false;
    dispatch({ type: 'load', layers: [] });
    setHint({ text: S.gameHintIdle, mood: 'idle' });
    setPhase('play');
    playSound('pop');
  };

  // ── Εφαρμογή / σύρσιμο (ίδια λογική με το στούντιο) ──────────────
  const applyLayer = useCallback((layer: AppliedLayer, anchor?: Pt) => {
    dispatch({ type: 'apply', layer });
    compositor?.prewarm(layer, ['neutral', 'blink', 'smile', 'wow'].filter((e) => e !== exprRef.current) as Expression[]);
    const def = COSMETICS[layer.category];
    animator.trigger(def.anim, anchor);
    playSound(def.anim === 'wow' ? 'wow' : 'pop');
    stageRef.current?.bounce();
  }, [animator, compositor]);

  const onDrop = useCallback((p: DragPayload, res: Extract<DropResolution, { ok: true }>) => {
    if (p.cosmetic.category === 'remover') {
      const target = layerAt(face, exprRef.current, layersRef.current, res.anchor);
      if (target) { dispatch({ type: 'remove', id: target.id }); playSound('clear'); setHint({ text: S.hintRemoved, mood: 'good' }); }
      else { playSound('boing'); setHint({ text: S.hintNothingToRemove, mood: 'bad' }); }
      window.setTimeout(() => setHint((h) => (h.mood === 'idle' ? h : { text: S.gameHintIdle, mood: 'idle' })), 1400);
      return;
    }
    if (p.cosmetic.category === 'sticker' && isAccessorySlot(res.regionIds[0])) {
      const deco = decorateAccessory(layersRef.current, res.regionIds[0], p.variant ?? 'heart', p.color, newLayerId());
      if (deco) applyLayer(deco, res.anchor);
      else { playSound('boing'); setHint({ text: S.hintNoAccessory, mood: 'bad' }); }
      window.setTimeout(() => setHint((h) => (h.mood === 'idle' ? h : { text: S.gameHintIdle, mood: 'idle' })), 1400);
      return;
    }
    applyLayer({
      id: newLayerId(), category: p.cosmetic.category, color: p.color, variant: p.variant, regionIds: res.regionIds,
      at: p.cosmetic.target.kind === 'free' ? res.anchor : undefined, seed: Math.floor(Math.random() * 1e9),
    }, res.anchor);
    setHint({ text: S.hintDone, mood: 'good' });
    window.setTimeout(() => setHint((h) => (h.text === S.hintDone ? { text: S.gameHintIdle, mood: 'idle' } : h)), 1200);
  }, [applyLayer, face]);

  const drag = useDragCosmetic({
    face, stageRef, exprRef, enabledRef,
    onHover: (p, hints, res) => {
      overlayRef.current = { hints, glow: res && res.ok ? res.regionIds : [] };
      drawOverlayNow();
      setHint(res && res.ok ? { text: S.hintDropHere, mood: 'good' } : { text: p.cosmetic.hintEl, mood: 'idle' });
    },
    onDrop,
    onEnd: () => {
      overlayRef.current = { hints: [], glow: [] };
      drawOverlayNow();
      setHint((h) => (h.mood === 'good' ? h : { text: S.gameHintIdle, mood: 'idle' }));
    },
  });

  // ── Test hook ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!testHooksEnabled()) return;
    const w = window as unknown as { __game?: unknown };
    w.__game = {
      ready: !!compositor,
      phase,
      preset,
      layers: layersRef.current,
      found,
      total,
      remaining,
      start: (id: number) => start(levelById(id)),
      apply: (l: Partial<AppliedLayer> & { category: AppliedLayer['category'] }) =>
        applyLayer({ color: '#000', regionIds: [], seed: 1, ...l, id: newLayerId() }),
      copyTarget: () => preset.forEach((l) => applyLayer({ ...l, id: newLayerId() })),
    };
    return () => { delete w.__game; };
  });

  const stars = found === total ? (remaining >= level.seconds / 3 ? 3 : 2) : found * 2 >= total ? 1 : 0;
  const resultTitle = stars >= 2 ? S.gameWin : stars === 1 ? S.gameAlmost : S.gameTryAgain;

  return (
    <main className="screen game" data-phase={phase}>
      <div className="game__bar">
        <Button variant="ghost" icon="←" onClick={() => (phase === 'play' ? setDialog('exit') : nav('/studio'))} data-action="game-exit">{S.gameExit}</Button>
        <div className={`game__timer ${remaining <= 10 && phase === 'play' ? 'is-low' : ''}`} data-timer>⏱ {fmt(remaining)}</div>
        <div className="game__score" data-score aria-label={S.gameFound(found, total)}>{S.gameScore(found, total)}</div>
        <Button variant="lilac" icon="↩" onClick={() => { dispatch({ type: 'undo' }); playSound('undo'); }} disabled={state.history.length === 0 || phase !== 'play'} data-action="undo">{S.undo}</Button>
      </div>
      <div className={`hintbar game__hint hintbar--${hint.mood}`} aria-live="polite">{hint.text}</div>
      <div className="game__stages">
        <div className="game__stage">
          <div className="game__label">{S.gameTarget}</div>
          <FaceStage face={face} compositor={targetCompositor} ref={targetRef} />
        </div>
        <div className="game__stage game__stage--you">
          <div className="game__label">{S.gameYou}</div>
          <FaceStage face={face} compositor={compositor} ref={stageRef} />
        </div>
      </div>
      <div className="game__panel">
        <CosmeticsPanel face={face} sel={sel} onSel={setSel} onStartDrag={(e, p) => drag.startDrag(e, p)} />
      </div>
      <DragGhost ghost={drag.ghost} ref={drag.ghostRef} />

      {phase === 'intro' && (
        <Dialog
          title={S.gameTitle}
          onClose={() => nav('/studio')}
          actions={<Button variant="ghost" size="lg" onClick={() => nav('/studio')}>{S.back}</Button>}
        >
          <p>{S.gameIntro}</p>
          <div className="game__levels">
            {LEVELS.map((lv) => (
              <button key={lv.id} type="button" className="game__level" data-level={lv.id} onClick={() => start(lv)}>
                <span className="game__level-emoji" aria-hidden="true">{lv.emoji}</span>
                <span className="game__level-name">{lv.labelEl}</span>
                <span className="game__level-meta">{S.gameLevelMeta(lv.items, lv.seconds)}</span>
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {phase === 'result' && (
        <Dialog
          title={resultTitle}
          onClose={() => setPhase('intro')}
          actions={
            <>
              <Button variant="ghost" size="lg" onClick={() => setPhase('intro')} data-action="game-level">{S.gameChangeLevel}</Button>
              <Button variant="primary" size="lg" onClick={() => start(level)} data-autofocus data-action="game-again">{S.gameAgain}</Button>
            </>
          }
        >
          <div className="game__stars" aria-label={`${stars}/3`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
          <p>{S.gameFound(found, total)}{found === total ? ` · ${S.gameTimeLeft(remaining)}` : ''}</p>
        </Dialog>
      )}
      {dialog === 'exit' && (
        <ConfirmDialog title={S.gameExitTitle} yesLabel={S.gameExit} onYes={() => nav('/studio')} onNo={() => setDialog('none')} />
      )}
    </main>
  );
}
