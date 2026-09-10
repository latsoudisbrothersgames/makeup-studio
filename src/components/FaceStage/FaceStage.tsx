import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { Compositor } from '../../engine/compositor';
import { drawOverlay, type OverlayState } from '../../engine/overlay';
import type { AppliedLayer } from '../../types/cosmetic';
import type { Expression, Face, Pt } from '../../types/face';
import './FaceStage.css';

export interface FaceStageHandle {
  render(expr: Expression, layers: AppliedLayer[], pulse?: number): void;
  overlay(expr: Expression, state: OverlayState): void;
  clientToFace(clientX: number, clientY: number): Pt;
  faceToClient(p: Pt): { x: number; y: number };
  /** Ο καμβάς 512 με το τελικό πρόσωπο (για thumbnail). */
  faceCanvas(): HTMLCanvasElement | null;
  bounce(): void;
}

interface Props {
  face: Face;
  compositor: Compositor | null;
  ref: Ref<FaceStageHandle>;
  onPointerDownFace?: (e: React.PointerEvent) => void;
  /** Σκηνικό πίσω από το πρόσωπο (data/shop.ts). */
  bg?: string;
}

/** Επιλέγει ακέραιο πολλαπλάσιο των 512 όταν χωράει, αλλιώς ρευστό μέγεθος. */
function pickSide(avail: number): number {
  for (const s of [1024, 768, 512]) if (avail >= s) return s;
  return Math.max(160, Math.floor(avail));
}

export function FaceStage({ face, compositor, ref, onPointerDownFace, bg = 'classic' }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const lastRender = useRef<{ expr: Expression; layers: AppliedLayer[]; pulse: number } | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const apply = () => {
      const r = box.getBoundingClientRect();
      const side = pickSide(Math.min(r.width, r.height));
      for (const c of [faceRef.current, overlayRef.current]) {
        if (!c) continue;
        c.style.width = `${side}px`;
        c.style.height = `${side}px`;
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    render(expr, layers, pulse = 1) {
      const c = faceRef.current;
      if (!c || !compositor) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(compositor.render(expr, layers, pulse), 0, 0);
      lastRender.current = { expr, layers, pulse };
      c.dataset.faceReady = '1';
    },
    overlay(expr, state) {
      const c = overlayRef.current;
      const ctx = c?.getContext('2d');
      if (!ctx) return;
      drawOverlay(ctx, face, expr, state);
    },
    clientToFace(clientX, clientY) {
      const c = faceRef.current;
      if (!c) return [0, 0];
      const r = c.getBoundingClientRect();
      return [((clientX - r.left) / r.width) * 512, ((clientY - r.top) / r.height) * 512];
    },
    faceToClient([x, y]) {
      const c = faceRef.current;
      if (!c) return { x: 0, y: 0 };
      const r = c.getBoundingClientRect();
      return { x: r.left + (x / 512) * r.width, y: r.top + (y / 512) * r.height };
    },
    faceCanvas() {
      return compositor?.out ?? null;
    },
    bounce() {
      const box = boxRef.current;
      if (!box) return;
      box.classList.remove('face-stage--bounce');
      void box.offsetWidth;
      box.classList.add('face-stage--bounce');
    },
  }), [compositor, face]);

  return (
    <div className="face-stage" ref={boxRef}>
      <div className="face-stage__frame" data-bg={bg}>
        <canvas ref={faceRef} width={512} height={512} className="face-stage__face pixelated" onPointerDown={onPointerDownFace} />
        <canvas ref={overlayRef} width={512} height={512} className="face-stage__overlay pixelated" aria-hidden="true" />
      </div>
    </div>
  );
}
