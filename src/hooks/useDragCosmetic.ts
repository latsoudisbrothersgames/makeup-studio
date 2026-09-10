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
  /** Αρχική θέση (client) — το φάντασμα γεννιέται ήδη εκεί και ορατό. */
  x: number;
  y: number;
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

/** Σε αφή το φάντασμα σχεδιάζεται λίγο πάνω από το δάχτυλο για να φαίνεται — αλλά το αντικείμενο
 *  πέφτει ΕΚΕΙ ΠΟΥ ΕΙΝΑΙ ΤΟ ΔΑΧΤΥΛΟ. (Πριν έπεφτε 56px ψηλότερα: σε πρόσωπο 215px = 1/4 του προσώπου —
 *  το παιδί σημάδευε το πηγούνι και το αυτοκόλλητο πήγαινε στη μύτη.) */
export const GHOST_LIFT = 60;

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
    /** Σε αφή το σύρσιμο «ανοίγει» μόνο αν η πρώτη κίνηση είναι κατακόρυφη (προς το πρόσωπο)·
     *  οριζόντια κίνηση = κύλιση της λωρίδας, την αφήνουμε στον browser. */
    started: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const moveGhost = (clientX: number, clientY: number, pointerType: string) => {
    const g = ghostRef.current;
    if (!g) return;
    const lift = pointerType === 'touch' ? GHOST_LIFT : 0;
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
      const fp = stage.clientToFace(clientX, clientY);
      a.lastFacePt = fp;
      res = resolveDrop(o.face, o.exprRef.current, a.payload.cosmetic, fp, a.payload.variant);
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

  /** Πραγματική έναρξη σύρσιματος: φάντασμα, δείκτης, υπόδειξη περιοχών. */
  const begin = useCallback((a: NonNullable<typeof active.current>) => {
    a.started = true;
    document.body.classList.add('is-dragging');
    if (ghostTimer.current) { window.clearTimeout(ghostTimer.current); ghostTimer.current = null; }
    setGhost({ ...a.payload, pointerType: a.pointerType, x: a.startX, y: a.startY });
    const o = optsRef.current;
    o.onHover(a.payload, candidateRegions(o.face, o.exprRef.current, a.payload.cosmetic, a.payload.variant), null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = useCallback((e: PointerEvent) => {
    const a = active.current;
    if (!a || e.pointerId !== a.pointerId) return;
    const dx = e.clientX - a.startX;
    const dy = e.clientY - a.startY;
    if (!a.started) {
      if (Math.hypot(dx, dy) < (a.pointerType === 'touch' ? 8 : 4)) return;
      // Αφή: οριζόντια κίνηση → κύλιση της λωρίδας (touch-action: pan-x), όχι σύρσιμο.
      if (a.pointerType === 'touch' && Math.abs(dx) > Math.abs(dy) * 1.2) { finish(true); return; }
      begin(a);
    }
    e.preventDefault();
    a.moved = true;
    moveGhost(e.clientX, e.clientY, a.pointerType);
    const o = optsRef.current;
    const stage = o.stageRef.current;
    if (!stage) return;
    // Το σημείο ελέγχου = το δάχτυλο/δείκτης (όχι το ανασηκωμένο φάντασμα).
    const fp = stage.clientToFace(e.clientX, e.clientY);
    a.lastFacePt = fp;
    const res = resolveDrop(o.face, o.exprRef.current, a.payload.cosmetic, fp, a.payload.variant);
    // ΠΑΝΤΑ η τελευταία ανάλυση: για ελεύθερη τοποθέτηση (αυτοκόλλητα, γκλίτερ, βαμβάκι) το anchor
    // αλλάζει σε κάθε κίνηση, ενώ οι περιοχές (key) δεν αλλάζουν — αλλιώς «κλειδώνει» στο σημείο εισόδου.
    a.lastRes = res;
    const key = res.ok ? res.regionIds.join('+') || 'free' : 'no';
    // Ελεύθερη τοποθέτηση: ενημέρωση σε κάθε κίνηση, ώστε το σημάδι στόχου να ακολουθεί το δάχτυλο.
    if (key !== a.lastKey || key === 'free') {
      a.lastKey = key;
      o.onHover(a.payload, candidateRegions(o.face, o.exprRef.current, a.payload.cosmetic, a.payload.variant), res);
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
    const a = {
      payload, el, pointerId: e.pointerId, pointerType: e.pointerType,
      lastKey: '', lastRes: null, lastFacePt: [0, 0] as Pt, moved: false, started: false, startX: e.clientX, startY: e.clientY,
    };
    active.current = a;
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('lostpointercapture', onLost);
    window.addEventListener('pointerup', onWindowUp, true);
    // Ποντίκι: το φάντασμα εμφανίζεται αμέσως. Αφή: μόνο όταν η πρώτη κίνηση δείξει σύρσιμο (onMove).
    if (e.pointerType !== 'touch') begin(a);
  }, [onMove, onUp, onCancel, onLost, onWindowUp, begin]);

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
