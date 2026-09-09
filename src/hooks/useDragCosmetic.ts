import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { playSound } from '../audio/soundManager';
import type { FaceStageHandle } from '../components/FaceStage/FaceStage';
import { candidateRegions, resolveDrop, type DropResolution } from '../engine/hitTest';
import type { Cosmetic } from '../types/cosmetic';
import type { Expression, Face, Pt, RegionId } from '../types/face';

export interface DragPayload {
  cosmetic: Cosmetic;
  color: string;
  variant?: string;
}

export interface DragGhostState extends DragPayload {
  pointerType: string;
}

interface Options {
  face: Face;
  stageRef: RefObject<FaceStageHandle | null>;
  exprRef: RefObject<Expression>;
  enabledRef: RefObject<boolean>;
  onHover(payload: DragPayload, hints: RegionId[], res: DropResolution | null): void;
  onDrop(payload: DragPayload, res: Extract<DropResolution, { ok: true }>, facePt: Pt): void;
  onEnd(): void;
}

const TOUCH_LIFT = 56;

/**
 * Σύρσιμο καλλυντικού με Pointer Events (ποντίκι + αφή). Το «φάντασμα» κινείται με ref
 * (χωρίς React state ανά καρέ)· ο έλεγχος περιοχής γίνεται στον χώρο του προσώπου.
 */
export function useDragCosmetic(opts: Options) {
  const [ghost, setGhost] = useState<DragGhostState | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const ghostTimer = useRef<number | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const active = useRef<{
    payload: DragPayload;
    el: HTMLElement;
    pointerId: number;
    pointerType: string;
    lastKey: string;
    lastRes: DropResolution | null;
    lastFacePt: Pt;
    moved: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const moveGhost = (clientX: number, clientY: number, pointerType: string) => {
    const g = ghostRef.current;
    if (!g) return;
    const lift = pointerType === 'touch' ? TOUCH_LIFT : 0;
    g.style.transform = `translate3d(${clientX}px, ${clientY - lift}px, 0) translate(-50%, -50%)`;
  };

  const finish = useCallback((cancelled: boolean, clientX?: number, clientY?: number) => {
    const a = active.current;
    if (!a) return;
    active.current = null;
    a.el.removeEventListener('pointermove', onMove);
    a.el.removeEventListener('pointerup', onUp);
    a.el.removeEventListener('pointercancel', onCancel);
    a.el.removeEventListener('lostpointercapture', onLost);
    window.removeEventListener('pointerup', onWindowUp, true);
    try { a.el.releasePointerCapture(a.pointerId); } catch { /* ήδη ελεύθερο */ }
    document.body.classList.remove('is-dragging');
    const o = optsRef.current;
    // Τελική ανάλυση από τις συντεταγμένες του pointerup (όχι από την τελευταία κίνηση, που μπορεί
    // να έχει συγχωνευθεί από τον browser) — η τοποθέτηση γίνεται ακριβώς εκεί που αφέθηκε.
    let res = a.lastRes;
    const stage = o.stageRef.current;
    if (!cancelled && a.moved && stage && clientX !== undefined && clientY !== undefined) {
      const lift = a.pointerType === 'touch' ? TOUCH_LIFT : 0;
      const fp = stage.clientToFace(clientX, clientY - lift);
      a.lastFacePt = fp;
      res = resolveDrop(o.face, o.exprRef.current, a.payload.cosmetic, fp);
    }
    if (ghostTimer.current) { window.clearTimeout(ghostTimer.current); ghostTimer.current = null; }
    try {
      if (!cancelled && a.moved && res && res.ok && clientX !== undefined && clientY !== undefined) {
        const target = o.stageRef.current?.faceToClient(res.anchor);
        const g = ghostRef.current;
        if (g && target) {
          g.style.transition = 'transform 140ms ease-out, opacity 140ms ease-out';
          g.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) translate(-50%, -50%) scale(0.4)`;
          g.style.opacity = '0';
        }
        ghostTimer.current = window.setTimeout(() => { ghostTimer.current = null; setGhost(null); }, 150);
        o.onDrop(a.payload, res, a.lastFacePt);
      } else {
        if (a.moved) playSound('boing');
        setGhost(null);
      }
    } catch (err) {
      console.error('drop failed', err);
      setGhost(null);
    }
    o.onEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = useCallback((e: PointerEvent) => {
    const a = active.current;
    if (!a || e.pointerId !== a.pointerId) return;
    e.preventDefault();
    if (!a.moved && Math.hypot(e.clientX - a.startX, e.clientY - a.startY) < 4) return;
    a.moved = true;
    moveGhost(e.clientX, e.clientY, a.pointerType);
    const o = optsRef.current;
    const stage = o.stageRef.current;
    if (!stage) return;
    // Το σημείο ελέγχου = το κέντρο του φαντάσματος (σε αφή είναι ανασηκωμένο πάνω από το δάχτυλο).
    const lift = a.pointerType === 'touch' ? TOUCH_LIFT : 0;
    const fp = stage.clientToFace(e.clientX, e.clientY - lift);
    a.lastFacePt = fp;
    const res = resolveDrop(o.face, o.exprRef.current, a.payload.cosmetic, fp);
    // ΠΑΝΤΑ η τελευταία ανάλυση: για ελεύθερη τοποθέτηση (αυτοκόλλητα, γκλίτερ, βαμβάκι) το anchor
    // αλλάζει σε κάθε κίνηση, ενώ οι περιοχές (key) δεν αλλάζουν — αλλιώς «κλειδώνει» στο σημείο εισόδου.
    a.lastRes = res;
    const key = res.ok ? res.regionIds.join('+') || 'free' : 'no';
    if (key !== a.lastKey) {
      a.lastKey = key;
      o.onHover(a.payload, candidateRegions(o.face, o.exprRef.current, a.payload.cosmetic), res);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUp = useCallback((e: PointerEvent) => {
    const a = active.current;
    if (!a || e.pointerId !== a.pointerId) return;
    e.preventDefault();
    finish(false, e.clientX, e.clientY);
  }, [finish]);

  const onCancel = useCallback((e: PointerEvent) => {
    const a = active.current;
    if (!a || e.pointerId !== a.pointerId) return;
    finish(true);
  }, [finish]);

  // Αν ο browser πάρει τον δείκτη (native drag, scroll, αλλαγή παραθύρου) → ακύρωση, ποτέ «κολλημένο» σύρσιμο.
  const onLost = useCallback((e: PointerEvent) => {
    const a = active.current;
    if (!a || e.pointerId !== a.pointerId) return;
    finish(true);
  }, [finish]);

  // Δίχτυ ασφαλείας: pointerup που δεν έφτασε στο στοιχείο (capture χάθηκε σιωπηλά).
  const onWindowUp = useCallback((e: PointerEvent) => {
    const a = active.current;
    if (!a || e.pointerId !== a.pointerId) return;
    finish(false, e.clientX, e.clientY);
  }, [finish]);

  const startDrag = useCallback((e: React.PointerEvent, payload: DragPayload) => {
    if (active.current || !optsRef.current.enabledRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* παλιοί browsers */ }
    active.current = {
      payload, el, pointerId: e.pointerId, pointerType: e.pointerType,
      lastKey: '', lastRes: null, lastFacePt: [0, 0], moved: false, startX: e.clientX, startY: e.clientY,
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('lostpointercapture', onLost);
    window.addEventListener('pointerup', onWindowUp, true);
    document.body.classList.add('is-dragging');
    if (ghostTimer.current) { window.clearTimeout(ghostTimer.current); ghostTimer.current = null; }
    setGhost({ ...payload, pointerType: e.pointerType });
    const o = optsRef.current;
    o.onHover(payload, candidateRegions(o.face, o.exprRef.current, payload.cosmetic), null);
    requestAnimationFrame(() => {
      const g = ghostRef.current;
      if (g) {
        g.style.transition = '';
        g.style.opacity = '1';
      }
      moveGhost(e.clientX, e.clientY, e.pointerType);
    });
  }, [onMove, onUp, onCancel, onLost, onWindowUp]);

  // Escape / απώλεια εστίασης παραθύρου → ακύρωση
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(true); };
    const onBlur = () => finish(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, [finish]);

  // Όσο σέρνουμε: μπλοκάρουμε scroll/pull-to-refresh σε κινητά.
  useEffect(() => {
    if (!ghost) return;
    const block = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, [ghost]);

  return { startDrag, ghost, ghostRef, cancel: () => finish(true) };
}
