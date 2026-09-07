import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playSound } from '../audio/soundManager';
import { Button } from '../components/Button/Button';
import { FACES } from '../data/faces';
import { S } from '../data/strings';
import { loadFaceImages } from '../hooks/useFaceImages';
import { MAX_NAME_LENGTH, sanitizeName } from '../storage/gallery';
import { useSession } from '../state/SessionContext';
import type { Face, FaceId } from '../types/face';
import '../styles/layout.css';
import './ChooseFaceScreen.css';

function FacePortrait({ face }: { face: Face }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    void loadFaceImages(face).then((im) => {
      const c = ref.current;
      if (!alive || !c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(im.neutral, 0, 0, 256, 256);
    });
    return () => { alive = false; };
  }, [face]);
  return <canvas ref={ref} width={256} height={256} className="face-card__img pixelated" aria-hidden="true" />;
}

export function ChooseFaceScreen() {
  const nav = useNavigate();
  const session = useSession();
  const [faceId, setFaceId] = useState<FaceId>(session.faceId ?? 'f1');
  const [name, setName] = useState(session.modelName);

  const go = () => {
    session.setFace(faceId);
    session.setModelName(sanitizeName(name));
    session.setProjectId(null);
    nav('/studio?new=1');
  };

  return (
    <main className="screen screen--scroll choose">
      <h1 className="screen__title">{S.chooseTitle}</h1>
      <div className="choose__grid">
        {FACES.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`face-card ${faceId === f.id ? 'is-active' : ''}`}
            data-face={f.id}
            onClick={() => { playSound('click'); setFaceId(f.id); }}
            aria-pressed={faceId === f.id}
          >
            <FacePortrait face={f} />
            <span className="face-card__name">{f.nameEl}</span>
          </button>
        ))}
      </div>
      <form className="choose__form" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label className="field choose__field">
          <span className="field__label">{S.whatsYourName}</span>
          <input
            className="field__input"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder={S.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
            data-field="child-name"
          />
        </label>
        <Button size="xl" type="submit" data-action="go">{S.letsGo}</Button>
      </form>
      <div className="choose__footer">
        <Button variant="ghost" icon="←" onClick={() => nav('/')}>{S.back}</Button>
      </div>
    </main>
  );
}
