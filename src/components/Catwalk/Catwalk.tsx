import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playJingle, playSound } from '../../audio/soundManager';
import { loadSprites } from '../../assets/sprites';
import { COSMETICS } from '../../data/cosmetics';
import { S } from '../../data/strings';
import { Compositor, type SpriteMap } from '../../engine/compositor';
import { renderPhoto, sharePhoto, type ShareResult } from '../../engine/exportImage';
import { useFaceImages } from '../../hooks/useFaceImages';
import type { AppliedLayer } from '../../types/cosmetic';
import type { Expression, Face } from '../../types/face';
import { Button } from '../Button/Button';
import { FaceStage, type FaceStageHandle } from '../FaceStage/FaceStage';
import './Catwalk.css';

interface Props {
  face: Face;
  layers: AppliedLayer[];
  bg: string;
  /** «Μαρία» / όνομα μοντέλου — τίτλος της φωτογραφίας. */
  caption: string;
  /** «Πάει σε γάμο.» / όνομα δημιουργίας — υπότιτλος. */
  subcaption: string;
  /** Καλείται μία φορά όταν τελειώσει η επίδειξη (εδώ ο γονέας γράφει στο άλμπουμ). */
  onFinished?(): void;
  onClose(): void;
}

/** Χορογραφία: (χρόνος ms, έκφραση). Το ζουμ και το κομφετί οδηγούνται από CSS με data-step. */
const SCRIPT: [number, Expression][] = [
  [0, 'neutral'], [500, 'blink'], [640, 'neutral'], [1200, 'smile'], [2600, 'wow'], [3900, 'smile'], [4700, 'blink'], [4840, 'smile'],
];
const SHOW_MS = 5400;
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 137) % 900,
  dur: 2600 + ((i * 311) % 1400),
  color: ['#ff5c8a', '#ffd54f', '#4fc3f7', '#69f0ae', '#ba68c8', '#ff8a65'][i % 6],
  rot: (i * 53) % 360,
  w: 8 + (i % 3) * 3,
}));

/** Πασαρέλα: το κορίτσι «βγαίνει» με μουσική, εκφράσεις, ζουμ και κομφετί· στο τέλος η φωτογραφία. */
export function Catwalk({ face, layers, bg, caption, subcaption, onFinished, onClose }: Props) {
  const images = useFaceImages(face);
  const [sprites, setSprites] = useState<SpriteMap>({});
  useEffect(() => { void loadSprites().then(setSprites); }, []);
  const compositor = useMemo(() => (images ? new Compositor(face, images, COSMETICS, sprites, false) : null), [face, images, sprites]);
  const stageRef = useRef<FaceStageHandle>(null);
  const [phase, setPhase] = useState<'show' | 'photo'>('show');
  const [expr, setExpr] = useState<Expression>('neutral');
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [share, setShare] = useState<ShareResult | null>(null);
  const finishedRef = useRef(false);

  // Απόδοση της τρέχουσας έκφρασης
  useEffect(() => { stageRef.current?.render(expr, layers); }, [compositor, expr, layers]);

  // Χορογραφία — ξεκινά μόλις υπάρχει compositor
  useEffect(() => {
    if (!compositor) return;
    playJingle();
    const timers = SCRIPT.map(([t, e], i) => window.setTimeout(() => { setExpr(e); setStep(i); if (e === 'wow') playSound('sparkle'); }, t));
    timers.push(window.setTimeout(() => {
      setExpr('smile');
      stageRef.current?.render('smile', layers);
      const c = stageRef.current?.faceCanvas();
      if (c) setPhoto(renderPhoto(c, 'plain', caption, subcaption).toDataURL('image/png'));
      setPhase('photo');
      playSound('save');
      if (!finishedRef.current) { finishedRef.current = true; onFinished?.(); }
    }, SHOW_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositor]);

  const doShare = async () => {
    const c = stageRef.current?.faceCanvas();
    if (!c) return;
    const r = await sharePhoto(renderPhoto(c, 'plain', caption, subcaption), `${caption.replace(/\s+/g, '-')}-pasarela.png`, S.catwalkTitle);
    setShare(r);
  };

  return createPortal(
    <div className="catwalk" data-phase={phase} data-step={step} role="dialog" aria-label={S.catwalkTitle}>
      <div className="catwalk__lights" aria-hidden="true" />
      {phase === 'show' && (
        <div className="catwalk__confetti" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span key={i} className="catwalk__piece" style={{ left: `${c.left}%`, animationDelay: `${c.delay}ms`, animationDuration: `${c.dur}ms`, background: c.color, width: c.w, height: c.w * 1.6, transform: `rotate(${c.rot}deg)` }} />
          ))}
        </div>
      )}
      <div className="catwalk__title">{phase === 'show' ? S.catwalkTitle : S.catwalkInAlbum}</div>
      <div className="catwalk__stage">
        <FaceStage face={face} compositor={compositor} ref={stageRef} bg={bg} />
      </div>
      <div className="catwalk__caption">
        <strong>{caption}</strong>
        {subcaption && <span>{subcaption}</span>}
      </div>
      {phase === 'show' ? (
        <div className="catwalk__actions">
          <Button variant="ghost" onClick={onClose} data-action="catwalk-skip">{S.catwalkSkip}</Button>
        </div>
      ) : (
        <div className="catwalk__actions">
          {photo && <img className="catwalk__photo" src={photo} alt="" data-photo />}
          <div className="catwalk__buttons">
            <Button variant="sun" icon="📤" onClick={doShare} data-action="catwalk-share">{share === 'downloaded' ? S.photoDownloaded : share === 'shared' ? S.photoShared : S.catwalkShare}</Button>
            <Button variant="primary" size="lg" onClick={onClose} data-action="catwalk-done" data-autofocus>{S.catwalkDone}</Button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
