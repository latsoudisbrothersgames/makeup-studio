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
import { briefById, evaluate, nextCustomer, type Customer, type Verdict } from '../data/salon';
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
import { addCoins, addStars, playerCoins, playerStars } from '../storage/players';
import { useSession } from '../state/SessionContext';
import { initialStudioState, newLayerId, studioReducer } from '../state/studioReducer';
import type { AppliedLayer } from '../types/cosmetic';
import { REGION_IDS, type Expression, type FaceId, type Pt, type RegionId } from '../types/face';
import '../styles/layout.css';
import './SalonScreen.css';

/**
 * «Σαλόνι»: μια πελάτισσα μπαίνει με ένα αίτημα, το παιδί τη φτιάχνει, εκείνη αντιδρά και πληρώνει.
 * Φάσεις: name? → intro → arrive → work → verdict → arrive …
 */
type Phase = 'name' | 'intro' | 'arrive' | 'work' | 'verdict';
type HintMood = 'idle' | 'good' | 'bad';

const RECENT = 6;

export function SalonScreen() {
  const nav = useNavigate();
  const session = useSession();
  const [params] = useSearchParams();
  const debug = params.get('debug') === '1';

  const [phase, setPhase] = useState<Phase>(() => (session.modelName ? 'intro' : 'name'));
  const [nameDraft, setNameDraft] = useState(session.modelName);
  const player = session.modelName;
  const { locked } = usePlayerStars(player);
  const lockedRef = useRef(locked);
  useEffect(() => { lockedRef.current = locked; }, [locked]);

  const recentRef = useRef<string[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [served, setServed] = useState(0);
  const [coins, setCoins] = useState(() => playerCoins(player));
  useEffect(() => { setCoins(playerCoins(player)); }, [player]);

  const face = faceById(customer?.face ?? 'f1')!;
  const images = useFaceImages(face);
  const [sprites, setSprites] = useState<SpriteMap>({});
  useEffect(() => { void loadSprites().then(setSprites); }, []);
  const compositor = useMemo(() => (images ? new Compositor(face, images, COSMETICS, sprites) : null), [face, images, sprites]);

  const [state, dispatch] = useReducer(studioReducer, initialStudioState);
  const layersRef = useRef(state.layers);
  const [expr, setExpr] = useState<Expression>('neutral');
  const exprRef = useRef<Expression>('neutral');
  useEffect(() => { layersRef.current = state.layers; }, [state.layers]);
  useEffect(() => { exprRef.current = expr; }, [expr]);

  const stageRef = useRef<FaceStageHandle>(null);
  const overlayRef = useRef<{ hints: RegionId[]; glow: RegionId[]; marker?: Pt }>({ hints: [], glow: [] });
  const particlesRef = useRef<Particle[]>([]);
  const [hint, setHint] = useState<{ text: string; mood: HintMood }>({ text: '', mood: 'idle' });
  const [sel, setSel] = useState<PanelSelection>(() => defaultSelection('lipstick', face));
  const [dialog, setDialog] = useState<'none' | 'exit' | 'request'>('none');
  const [toast, setToast] = useState<string | null>(null);

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  /** Ό,τι έχει ήδη πληρωθεί για ΑΥΤΗ την πελάτισσα (στη «διόρθωση» πληρώνεται μόνο η διαφορά). */
  const awarded = useRef({ stars: 0, coins: 0 });
  const [gained, setGained] = useState<{ stars: number; coins: number; unlocks: Unlock[] }>({ stars: 0, coins: 0, unlocks: [] });

  const enabledRef = useRef(false);
  const interactive = phase === 'work' && dialog === 'none';
  useEffect(() => { enabledRef.current = interactive; }, [interactive]);

  // ── Απόδοση ───────────────────────────────────────────────────────
  const drawOverlayNow = useCallback(() => {
    const o = overlayRef.current;
    stageRef.current?.overlay(exprRef.current, { hints: debug ? REGION_IDS : o.hints, glow: o.glow, marker: o.marker, particles: particlesRef.current });
  }, [debug]);

  useEffect(() => {
    stageRef.current?.render(expr, state.layers);
    drawOverlayNow();
  }, [compositor, expr, state.layers, drawOverlayNow]);

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

  // ── Ροή ───────────────────────────────────────────────────────────
  const requestText = customer ? customer.brief.requestEl : '';
  const idleHint = useCallback((): { text: string; mood: HintMood } => ({ text: requestText, mood: 'idle' }), [requestText]);
  useEffect(() => { setHint(idleHint()); }, [idleHint]);

  const callNext = useCallback((briefId?: string) => {
    const c = nextCustomer(lockedRef.current, recentRef.current, customer?.face ?? null);
    if (briefId) { const b = briefById(briefId); if (b) c.brief = b; }
    recentRef.current = [c.brief.id, ...recentRef.current].slice(0, RECENT);
    dispatch({ type: 'load', layers: [] });
    setVerdict(null);
    awarded.current = { stars: 0, coins: 0 };
    setGained({ stars: 0, coins: 0, unlocks: [] });
    setSel(defaultSelection('lipstick', faceById(c.face)!));
    setCustomer(c);
    setPhase('arrive');
    playSound('pop');
  }, [customer]);

  const startWork = () => { setPhase('work'); playSound('click'); };

  const finish = useCallback(() => {
    if (layersRef.current.length === 0) { setHint({ text: S.salonEmpty, mood: 'bad' }); playSound('boing'); return; }
    if (!customer) return;
    const v = evaluate(customer.brief, layersRef.current);
    // Πληρωμή μόνο για ό,τι δεν έχει ήδη πληρωθεί (διόρθωση = μόνο η βελτίωση).
    const dStars = Math.max(0, v.stars - awarded.current.stars);
    const dCoins = Math.max(0, v.coins - awarded.current.coins);
    let unlocks: Unlock[] = [];
    if (dStars > 0) {
      const before = playerStars(player);
      const after = addStars(player, dStars, 'salon');
      unlocks = newlyUnlocked(before, after);
    }
    if (dCoins > 0) setCoins(addCoins(player, dCoins));
    else if (awarded.current.coins === 0) setCoins(addCoins(player, 0)); // μετρά την πελάτισσα ακόμη κι αν δεν κέρδισε τίποτα
    awarded.current = { stars: Math.max(awarded.current.stars, v.stars), coins: Math.max(awarded.current.coins, v.coins) };
    setGained({ stars: dStars, coins: dCoins, unlocks });
    setVerdict(v);
    if (v.reaction === 'wow') { animator.trigger('wow', [256, 240]); playSound('wow'); }
    else if (v.reaction === 'smile') { animator.trigger('smile'); playSound('save'); }
    else playSound('boing');
    setServed((n) => n + 1);
    window.setTimeout(() => setPhase('verdict'), v.reaction === 'neutral' ? 300 : 900);
  }, [customer, player, animator]);

  const fix = () => { setPhase('work'); playSound('click'); };

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

  const drag = useDragCosmetic({
    face, stageRef, exprRef, enabledRef,
    onHover: (p, hints, res) => {
      overlayRef.current = { hints, glow: res && res.ok ? res.regionIds : [], marker: res && res.ok && res.regionIds.length === 0 ? res.anchor : undefined };
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
    const w = window as unknown as { __salon?: unknown };
    w.__salon = {
      ready: !!compositor,
      phase, customer, verdict, coins, served, gained, player,
      layers: layersRef.current,
      open: () => callNext(),
      call: (briefId: string, faceId?: FaceId) => { callNext(briefId); if (faceId) setCustomer((c) => (c ? { ...c, face: faceId } : c)); },
      start: startWork,
      finish,
      fix,
      next: () => callNext(),
      apply: (l: Partial<AppliedLayer> & { category: AppliedLayer['category'] }) =>
        applyLayer({ color: '#000', regionIds: [], seed: 1, ...l, id: newLayerId() }),
    };
    return () => { delete w.__salon; };
  });

  const stars = verdict?.stars ?? 0;
  const verdictTitle = stars === 3 ? S.salonPerfect : stars > 0 ? S.salonGood : S.salonMeh;
  const exit = () => nav('/');

  return (
    <main className="screen studio salon" data-phase={phase}>
      <div className="studio__bar salon__bar">
        <Button variant="ghost" icon="←" onClick={() => (phase === 'work' ? setDialog('exit') : exit())} data-action="salon-exit">{S.gameExit}</Button>
        <div className="salon__coins" data-coins aria-label={`${coins} νομίσματα`}>{S.salonCoins(coins)}</div>
        <Button variant="lilac" icon="↩" onClick={() => { dispatch({ type: 'undo' }); playSound('undo'); }} disabled={state.history.length === 0 || phase !== 'work'} data-action="undo">{S.undo}</Button>
        <Button variant="mint" icon="✔" onClick={finish} disabled={phase !== 'work'} data-action="salon-done">{S.salonDone}</Button>
      </div>
      <button
        type="button"
        className={`hintbar studio__hint salon__hint hintbar--${hint.mood}`}
        aria-live="polite"
        onClick={() => { if (phase === 'work' && customer) setDialog('request'); }}
        data-hint
      >
        {customer && hint.mood === 'idle' && hint.text === requestText ? <span className="salon__hint-who">{customer.brief.emoji} {face.nameEl}: </span> : null}
        {hint.text}
      </button>
      <div className="studio__stage salon__stage">
        <FaceStage face={face} compositor={compositor} ref={stageRef} />
      </div>
      <div className="studio__panel">
        <CosmeticsPanel face={face} sel={sel} onSel={setSel} onStartDrag={(e, p) => drag.startDrag(e, p)} locked={locked} onLocked={onLocked} />
      </div>
      <DragGhost ghost={drag.ghost} ref={drag.ghostRef} />

      {phase === 'name' && (
        <Dialog
          title={S.salonWhoWorks}
          onClose={exit}
          actions={
            <>
              <Button variant="ghost" size="lg" onClick={exit}>{S.back}</Button>
              <Button variant="primary" size="lg" data-action="name-go" onClick={() => {
                const n = sanitizeName(nameDraft) || S.gamePlayerA;
                session.setModelName(n);
                setPhase('intro');
              }}>{S.letsGo}</Button>
            </>
          }
        >
          <form className="game__names" onSubmit={(e) => { e.preventDefault(); }}>
            <label className="field">
              <span className="field__label">{S.whatsYourName}</span>
              <input className="field__input" value={nameDraft} maxLength={MAX_NAME_LENGTH} placeholder={S.namePlaceholder} data-field="player" autoFocus
                onChange={(e) => setNameDraft(e.target.value)} />
            </label>
          </form>
        </Dialog>
      )}
      {phase === 'intro' && (
        <Dialog
          title={S.salonTitle}
          onClose={exit}
          actions={
            <>
              <Button variant="ghost" size="lg" onClick={exit}>{S.back}</Button>
              <Button variant="primary" size="lg" onClick={() => callNext()} data-action="salon-open" data-autofocus>{S.salonOpen}</Button>
            </>
          }
        >
          <p className="salon__intro-emoji" aria-hidden="true">💇‍♀️✨💄</p>
          <p>{S.salonIntro}</p>
        </Dialog>
      )}
      {(phase === 'arrive' || dialog === 'request') && customer && (
        <Dialog
          title={phase === 'arrive' ? S.salonArrived(face.nameEl) : S.salonReadRequest}
          onClose={() => (phase === 'arrive' ? startWork() : setDialog('none'))}
          actions={<Button variant="primary" size="xl" onClick={() => (phase === 'arrive' ? startWork() : setDialog('none'))} data-action="salon-start" data-autofocus>{phase === 'arrive' ? S.salonStart : S.letsGo}</Button>}
        >
          <div className="salon__card">
            <div className="salon__occasion"><span className="salon__occasion-emoji" aria-hidden="true">{customer.brief.emoji}</span> {customer.brief.occasionEl}</div>
            <blockquote className="salon__request" data-request>«{customer.brief.requestEl}»</blockquote>
          </div>
        </Dialog>
      )}
      {phase === 'verdict' && verdict && customer && (
        <Dialog
          title={verdictTitle}
          onClose={() => callNext()}
          actions={
            <>
              {stars < 3 && <Button variant="ghost" size="lg" onClick={fix} data-action="salon-fix">{S.salonFix}</Button>}
              <Button variant="primary" size="lg" onClick={() => callNext()} data-action="salon-next" data-autofocus>{S.salonNext}</Button>
            </>
          }
        >
          <div className="game__stars" aria-label={`${stars}/3`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
          <ul className="salon__checklist" data-checklist>
            {verdict.results.map((r, i) => (
              <li key={i} className={`salon__check ${r.ok ? 'is-ok' : 'is-missing'}`} data-ok={r.ok ? '1' : '0'}>
                <span className="salon__check-mark" aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
                {r.rule.labelEl}
              </li>
            ))}
          </ul>
          {gained.coins > 0 && <p className="game__gain">{S.salonCoinsEarned(gained.coins)}{gained.stars > 0 ? ` · ${S.gameStarsEarned(gained.stars)}` : ''}</p>}
          {gained.unlocks.map((u) => <p key={u.stars} className="game__unlock" data-unlock>{u.emoji} {S.gameUnlocked(u.labelEl)}</p>)}
          <p className="salon__served">{S.salonCustomers(served)} · {S.salonCoins(coins)}</p>
        </Dialog>
      )}
      {dialog === 'exit' && (
        <ConfirmDialog title={S.salonExitTitle} yesLabel={S.gameExit} onYes={exit} onNo={() => setDialog('none')} />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
