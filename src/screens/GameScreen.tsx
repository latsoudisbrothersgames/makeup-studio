import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { playSound } from '../audio/soundManager';
import { loadSprites } from '../assets/sprites';
import { Button } from '../components/Button/Button';
import { CosmeticsPanel, defaultSelection, type PanelSelection } from '../components/CosmeticsPanel/CosmeticsPanel';
import { ConfirmDialog, Dialog } from '../components/Dialog/Dialog';
import { DragGhost } from '../components/DragGhost/DragGhost';
import { FaceStage, type FaceStageHandle } from '../components/FaceStage/FaceStage';
import { Toast } from '../components/Toast/Toast';
import { decorateAccessory, isAccessorySlot } from '../data/accessories';
import { COSMETICS } from '../data/cosmetics';
import { faceById } from '../data/faces';
import { LEVELS, levelById, makePreset, matchedItems, type Level } from '../data/presets';
import { S } from '../data/strings';
import { newlyUnlocked, unlockFor, type Unlock } from '../data/unlocks';
import { testHooksEnabled } from '../dev/testHook';
import { FaceAnimator, type Particle } from '../engine/animator';
import { Compositor, type SpriteMap } from '../engine/compositor';
import type { DropResolution } from '../engine/hitTest';
import { layerAt } from '../engine/layerAt';
import { useDragCosmetic, type DragPayload } from '../hooks/useDragCosmetic';
import { useFaceImages } from '../hooks/useFaceImages';
import { usePlayerStars } from '../hooks/usePlayerStars';
import { MAX_NAME_LENGTH, sanitizeName } from '../storage/gallery';
import { addStars, ANONYMOUS, playerStars } from '../storage/players';
import { useSession } from '../state/SessionContext';
import { initialStudioState, newLayerId, studioReducer } from '../state/studioReducer';
import type { AppliedLayer } from '../types/cosmetic';
import { REGION_IDS, type Expression, type Pt, type RegionId } from '../types/face';
import '../styles/layout.css';
import './GameScreen.css';

/**
 * Φάσεις:
 *  intro → (solo) play → result → intro/play
 *  intro → (duo) names → handoff(δημιουργία) → create → handoff(αντιγραφή) → play → result → handoff(άλλος δημιουργεί) → … → final
 */
type Phase = 'intro' | 'names' | 'handoff' | 'create' | 'play' | 'result' | 'final';
type Mode = 'solo' | 'duo';
type HintMood = 'idle' | 'good' | 'bad';

const CREATE_SECONDS = 60;
const EMPTY_LOCKS = new Set<string>();

function fmt(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function starsFor(found: number, total: number, remaining: number, seconds: number): number {
  if (found === total) return remaining >= seconds / 3 ? 3 : 2;
  return found * 2 >= total ? 1 : 0;
}

/** Παιχνίδι «Αντίγραψε το στυλ»: αριστερά έτοιμο στυλ, δεξιά το ίδιο κορίτσι, χρονόμετρο. Μόνος ή δύο παίκτες. */
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

  // ── Παιχνίδι ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('solo');
  const [level, setLevel] = useState<Level>(() => levelById(Number(params.get('level'))));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [players, setPlayers] = useState<[string, string]>([session.modelName || ANONYMOUS, '']);
  const [round, setRound] = useState<0 | 1>(0);
  const [creatorLayers, setCreatorLayers] = useState<AppliedLayer[]>([]);
  const [duoResults, setDuoResults] = useState<{ name: string; stars: number; found: number; total: number }[]>([]);
  const [remaining, setRemaining] = useState(level.seconds);
  const [dialog, setDialog] = useState<'none' | 'exit'>('none');
  const [toast, setToast] = useState<string | null>(null);
  const [gained, setGained] = useState<{ stars: number; unlocks: Unlock[] } | null>(null);

  const creator = players[round];
  const copier = players[1 - round];
  /** Το «Πάμε» της παράδοσης: αν υπάρχει στυλ που δεν αντιγράφηκε ακόμη → αντιγραφή, αλλιώς → δημιουργία. */
  const handoffPending = creatorLayers.length > 0 && duoResults.length === round;
  /** Ποιος κρατά τη συσκευή τώρα. */
  const creating = phase === 'create' || (phase === 'handoff' && !handoffPending);
  const activeName = mode === 'duo' ? (creating ? creator : copier) : session.modelName;
  const { locked: soloLocked } = usePlayerStars(session.modelName);
  // Στους δύο παίκτες όλα είναι ανοιχτά — αλλιώς ο ένας θα έβαζε πράγματα που ο άλλος δεν έχει.
  const locked = mode === 'duo' ? EMPTY_LOCKS : soloLocked;

  const preset = useMemo(
    () => (mode === 'duo' ? creatorLayers : makePreset(face, level, seed, soloLocked)),
    [mode, creatorLayers, face, level, seed, soloLocked],
  );

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

  const matched = useMemo(() => (phase === 'create' ? [] : matchedItems(preset, state.layers)), [phase, preset, state.layers]);
  const found = matched.filter(Boolean).length;
  const total = preset.length;
  /** Στη δημιουργία: πόσα πράγματα έχει βάλει ο δημιουργός. */
  const created = state.layers.length;
  const createFull = phase === 'create' && created >= level.items;

  const enabledRef = useRef(false);
  const interactive = dialog === 'none' && (phase === 'play' || (phase === 'create' && !createFull));
  useEffect(() => { enabledRef.current = interactive; }, [interactive]);

  // ── Απόδοση ───────────────────────────────────────────────────────
  const drawOverlayNow = useCallback(() => {
    const o = overlayRef.current;
    stageRef.current?.overlay(exprRef.current, { hints: debug ? REGION_IDS : o.hints, glow: o.glow, particles: particlesRef.current });
  }, [debug]);

  useEffect(() => {
    stageRef.current?.render(expr, state.layers);
    drawOverlayNow();
  }, [compositor, expr, state.layers, drawOverlayNow]);

  // Ο στόχος φαίνεται μόνο όταν πρέπει (όχι στη δημιουργία/παράδοση — ο άλλος δεν κοιτάει).
  const showTarget = phase === 'play' || phase === 'result' || phase === 'final' || (phase === 'intro' && mode === 'solo');
  useEffect(() => {
    targetRef.current?.render('neutral', showTarget ? preset : []);
  }, [targetCompositor, preset, showTarget]);

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
  const timed = phase === 'play' || phase === 'create';
  useEffect(() => {
    if (!timed) return;
    const t = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) return 0;
        if (r <= 11) playSound('click');
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [timed]);

  // ── Μεταβάσεις ────────────────────────────────────────────────────
  const finished = useRef(false);

  const beginCopy = useCallback((lv: Level) => {
    finished.current = false;
    dispatch({ type: 'load', layers: [] });
    setRemaining(lv.seconds);
    setHint({ text: S.gameHintIdle, mood: 'idle' });
    setGained(null);
    setPhase('play');
    playSound('pop');
  }, []);

  const beginCreate = useCallback(() => {
    finished.current = false;
    dispatch({ type: 'load', layers: [] });
    setRemaining(CREATE_SECONDS);
    setHint({ text: S.gameCreateHint(level.items), mood: 'idle' });
    setPhase('create');
    playSound('pop');
  }, [level.items]);

  const startSolo = (lv: Level) => {
    setMode('solo');
    setLevel(lv);
    setSeed(Math.floor(Math.random() * 1e9));
    beginCopy(lv);
  };

  const startDuo = (lv: Level) => {
    setMode('duo');
    setLevel(lv);
    setRound(0);
    setDuoResults([]);
    setCreatorLayers([]);
    setPhase('names');
  };

  /** Ο δημιουργός τελείωσε (χρόνος ή «Έτοιμο») → παράδοση στον αντιγραφέα. */
  const finishCreate = useCallback(() => {
    if (finished.current) return;
    const layers = layersRef.current;
    if (layers.length === 0) { setHint({ text: S.gameCreateEmpty, mood: 'bad' }); return; }
    finished.current = true;
    setCreatorLayers(layers);
    dispatch({ type: 'load', layers: [] });
    setPhase('handoff');
    playSound('save');
  }, []);

  useEffect(() => {
    if (phase === 'create' && remaining === 0) {
      if (layersRef.current.length === 0) setRemaining(CREATE_SECONDS); // άδειο στυλ: ξανά από την αρχή
      else finishCreate();
    }
  }, [phase, remaining, finishCreate]);

  // Τέλος αντιγραφής: όλα βρέθηκαν ή τέλος χρόνου → αστέρια στον παίκτη.
  useEffect(() => {
    if (phase !== 'play' || finished.current) return;
    if (found === total || remaining === 0) {
      finished.current = true;
      const stars = starsFor(found, total, remaining, level.seconds);
      const who = mode === 'duo' ? copier : session.modelName;
      const before = playerStars(who);
      const after = addStars(who, stars, level.id);
      setGained({ stars, unlocks: mode === 'duo' ? [] : newlyUnlocked(before, after) });
      if (mode === 'duo') setDuoResults((r) => [...r, { name: copier, stars, found, total }]);
      playSound(found === total ? 'save' : 'boing');
      if (found === total) animator.trigger('wow', [256, 240]);
      window.setTimeout(() => setPhase('result'), found === total ? 700 : 300);
    }
  }, [phase, found, total, remaining, animator, level, mode, copier, session.modelName]);

  const handoffGo = () => {
    if (handoffPending) beginCopy(level);
    else beginCreate();
  };

  const afterResult = () => {
    if (mode === 'solo') { startSolo(level); return; }
    if (round === 0) { setRound(1); setCreatorLayers([]); setPhase('handoff'); }
    else setPhase('final');
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

  const idleHint = useCallback(
    (): { text: string; mood: HintMood } => ({ text: phase === 'create' ? S.gameCreateHint(level.items) : S.gameHintIdle, mood: 'idle' }),
    [phase, level.items],
  );

  const onDrop = useCallback((p: DragPayload, res: Extract<DropResolution, { ok: true }>) => {
    if (p.cosmetic.category === 'remover') {
      const target = layerAt(face, exprRef.current, layersRef.current, res.anchor);
      if (target) { dispatch({ type: 'remove', id: target.id }); playSound('clear'); setHint({ text: S.hintRemoved, mood: 'good' }); }
      else { playSound('boing'); setHint({ text: S.hintNothingToRemove, mood: 'bad' }); }
      window.setTimeout(() => setHint((h) => (h.mood === 'idle' ? h : idleHint())), 1400);
      return;
    }
    if (p.cosmetic.category === 'sticker' && isAccessorySlot(res.regionIds[0])) {
      const deco = decorateAccessory(layersRef.current, res.regionIds[0], p.variant ?? 'heart', p.color, newLayerId());
      if (deco) applyLayer(deco, res.anchor);
      else { playSound('boing'); setHint({ text: S.hintNoAccessory, mood: 'bad' }); }
      window.setTimeout(() => setHint((h) => (h.mood === 'idle' ? h : idleHint())), 1400);
      return;
    }
    applyLayer({
      id: newLayerId(), category: p.cosmetic.category, color: p.color, variant: p.variant, regionIds: res.regionIds,
      at: p.cosmetic.target.kind === 'free' ? res.anchor : undefined, seed: Math.floor(Math.random() * 1e9),
    }, res.anchor);
    setHint({ text: S.hintDone, mood: 'good' });
    window.setTimeout(() => setHint((h) => (h.text === S.hintDone ? idleHint() : h)), 1200);
  }, [applyLayer, face, idleHint]);

  useEffect(() => {
    if (createFull) setHint({ text: S.gameCreateDone, mood: 'good' });
  }, [createFull]);

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
      setHint((h) => (h.mood === 'good' ? h : idleHint()));
    },
  });

  const onLocked = (key: string) => {
    const u = unlockFor(key);
    playSound('boing');
    setToast(u ? S.lockedHint(u.stars) : S.lockedGeneric);
  };

  // ── Test hook ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!testHooksEnabled()) return;
    const w = window as unknown as { __game?: unknown };
    w.__game = {
      ready: !!compositor,
      phase, mode, round, players, preset, found, total, remaining, gained, duoResults, handoffPending,
      layers: layersRef.current,
      start: (id: number) => startSolo(levelById(id)),
      startDuo: (id: number, a: string, b: string) => { setPlayers([a, b]); startDuo(levelById(id)); setPhase('handoff'); },
      handoffGo,
      finishCreate,
      afterResult,
      apply: (l: Partial<AppliedLayer> & { category: AppliedLayer['category'] }) =>
        applyLayer({ color: '#000', regionIds: [], seed: 1, ...l, id: newLayerId() }),
      copyTarget: () => preset.forEach((l) => applyLayer({ ...l, id: newLayerId() })),
    };
    return () => { delete w.__game; };
  });

  const stars = gained?.stars ?? 0;
  const resultTitle = stars >= 2 ? S.gameWin : stars === 1 ? S.gameAlmost : S.gameTryAgain;
  const handoffTo = handoffPending ? copier : creator;

  return (
    <main className="screen game" data-phase={phase} data-mode={mode}>
      <div className="game__bar">
        <Button variant="ghost" icon="←" onClick={() => (timed ? setDialog('exit') : nav('/studio'))} data-action="game-exit">{S.gameExit}</Button>
        <div className={`game__timer ${remaining <= 10 && timed ? 'is-low' : ''}`} data-timer>⏱ {fmt(remaining)}</div>
        {phase === 'create' ? (
          <Button variant="mint" icon="✔" onClick={finishCreate} disabled={created === 0} data-action="game-ready">{S.gameReady}</Button>
        ) : (
          <div className="game__score" data-score aria-label={S.gameFound(found, total)}>{S.gameScore(found, total)}</div>
        )}
        <Button variant="lilac" icon="↩" onClick={() => { dispatch({ type: 'undo' }); playSound('undo'); }} disabled={state.history.length === 0 || !timed} data-action="undo">{S.undo}</Button>
      </div>
      <div className={`hintbar game__hint hintbar--${hint.mood}`} aria-live="polite">{hint.text}</div>
      <div className="game__stages">
        <div className="game__stage">
          <div className="game__label">{mode === 'duo' && phase === 'create' ? S.gameCreating(creator) : S.gameTarget}</div>
          <FaceStage face={face} compositor={targetCompositor} ref={targetRef} />
        </div>
        <div className="game__stage game__stage--you">
          <div className="game__label">{mode === 'duo' ? activeName || S.gameYou : S.gameYou}</div>
          <FaceStage face={face} compositor={compositor} ref={stageRef} />
        </div>
      </div>
      <div className="game__panel">
        <CosmeticsPanel face={face} sel={sel} onSel={setSel} onStartDrag={(e, p) => drag.startDrag(e, p)} locked={locked} onLocked={onLocked} />
      </div>
      <DragGhost ghost={drag.ghost} ref={drag.ghostRef} />

      {phase === 'intro' && (
        <Dialog
          title={S.gameTitle}
          onClose={() => nav('/studio')}
          actions={<Button variant="ghost" size="lg" onClick={() => nav('/studio')}>{S.back}</Button>}
        >
          <div className="game__modes" role="radiogroup" aria-label={S.gameMode}>
            <button type="button" role="radio" aria-checked={mode === 'solo'} className={`game__mode ${mode === 'solo' ? 'is-active' : ''}`} onClick={() => setMode('solo')} data-mode-pick="solo">🙋 {S.gameSolo}</button>
            <button type="button" role="radio" aria-checked={mode === 'duo'} className={`game__mode ${mode === 'duo' ? 'is-active' : ''}`} onClick={() => setMode('duo')} data-mode-pick="duo">👭 {S.gameDuo}</button>
          </div>
          <p>{mode === 'duo' ? S.gameDuoIntro : S.gameIntro}</p>
          <div className="game__levels">
            {LEVELS.map((lv) => (
              <button key={lv.id} type="button" className="game__level" data-level={lv.id} onClick={() => (mode === 'duo' ? startDuo(lv) : startSolo(lv))}>
                <span className="game__level-emoji" aria-hidden="true">{lv.emoji}</span>
                <span className="game__level-name">{lv.labelEl}</span>
                <span className="game__level-meta">{S.gameLevelMeta(lv.items, lv.seconds)}</span>
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {phase === 'names' && (
        <Dialog
          title={S.gameNamesTitle}
          onClose={() => setPhase('intro')}
          actions={
            <>
              <Button variant="ghost" size="lg" onClick={() => setPhase('intro')}>{S.back}</Button>
              <Button variant="primary" size="lg" data-action="names-go" onClick={() => {
                const a = sanitizeName(players[0]) || S.gamePlayerA;
                const b0 = sanitizeName(players[1]) || S.gamePlayerB;
                setPlayers([a, b0.toLowerCase() === a.toLowerCase() ? `${b0} 2` : b0]);
                setPhase('handoff');
              }}>{S.gameGo}</Button>
            </>
          }
        >
          <form className="game__names" onSubmit={(e) => e.preventDefault()}>
            {([0, 1] as const).map((i) => (
              <label key={i} className="field">
                <span className="field__label">{i === 0 ? S.gamePlayerA : S.gamePlayerB}</span>
                <input className="field__input" value={players[i]} maxLength={MAX_NAME_LENGTH} placeholder={S.namePlaceholder} data-field={`player-${i}`}
                  onChange={(e) => setPlayers((p) => (i === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]))} />
              </label>
            ))}
          </form>
        </Dialog>
      )}
      {phase === 'handoff' && (
        <Dialog
          title={S.gameHandoffTitle(handoffTo)}
          onClose={() => setDialog('exit')}
          actions={<Button variant="primary" size="xl" onClick={handoffGo} data-action="handoff-go" data-autofocus>{S.gameGo}</Button>}
        >
          <p>{handoffPending ? S.gameHandoffCopy : S.gameHandoffCreate(level.items)}</p>
        </Dialog>
      )}
      {phase === 'result' && (
        <Dialog
          title={resultTitle}
          onClose={afterResult}
          actions={
            <>
              {mode === 'solo' && <Button variant="ghost" size="lg" onClick={() => setPhase('intro')} data-action="game-level">{S.gameChangeLevel}</Button>}
              <Button variant="primary" size="lg" onClick={afterResult} data-autofocus data-action="game-again">
                {mode === 'solo' ? S.gameAgain : round === 0 ? S.gameNextRound : S.gameFinal}
              </Button>
            </>
          }
        >
          <div className="game__stars" aria-label={`${stars}/3`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
          <p>{mode === 'duo' ? `${copier}: ` : ''}{S.gameFound(found, total)}{found === total ? ` · ${S.gameTimeLeft(remaining)}` : ''}</p>
          {stars > 0 && <p className="game__gain">{S.gameStarsEarned(stars)}</p>}
          {gained?.unlocks.map((u) => <p key={u.stars} className="game__unlock" data-unlock>{u.emoji} {S.gameUnlocked(u.labelEl)}</p>)}
        </Dialog>
      )}
      {phase === 'final' && (
        <Dialog
          title={S.gameFinalTitle}
          onClose={() => setPhase('intro')}
          actions={
            <>
              <Button variant="ghost" size="lg" onClick={() => setPhase('intro')}>{S.gameChangeLevel}</Button>
              <Button variant="primary" size="lg" onClick={() => { setRound(0); setDuoResults([]); setCreatorLayers([]); setPhase('handoff'); }} data-action="duo-again" data-autofocus>{S.gameAgain}</Button>
            </>
          }
        >
          <ul className="game__final">
            {duoResults.map((r) => (
              <li key={r.name} className="game__final-row">
                <span className="game__final-name">{r.name}</span>
                <span className="game__final-stars">{'★'.repeat(r.stars)}{'☆'.repeat(3 - r.stars)}</span>
                <span className="game__final-found">{r.found}/{r.total}</span>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
      {dialog === 'exit' && (
        <ConfirmDialog title={S.gameExitTitle} yesLabel={S.gameExit} onYes={() => nav('/studio')} onNo={() => setDialog('none')} />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
