import { useEffect, useMemo, useState } from 'react';
import { S } from '../../data/strings';
import { PHOTO_BGS, sharePhoto, type PhotoBg, type ShareResult } from '../../engine/exportImage';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import './PhotoDialog.css';

interface Props {
  /** Αποδίδει την τελική εικόνα για το φόντο (καλείται σε κάθε αλλαγή φόντου). */
  render(bg: PhotoBg): HTMLCanvasElement;
  filename: string;
  onDone(result: ShareResult): void;
  onClose(): void;
}

const BG_LABEL: Record<PhotoBg, string> = { plain: S.photoBgPlain, dots: S.photoBgDots, white: S.photoBgWhite };

/** «Φωτογράφισε τη δημιουργία μου»: επιλογή φόντου, προεπισκόπηση, αποθήκευση/κοινοποίηση. */
export function PhotoDialog({ render, filename, onDone, onClose }: Props) {
  const [bg, setBg] = useState<PhotoBg>('plain');
  const [busy, setBusy] = useState(false);
  const canvas = useMemo(() => render(bg), [render, bg]);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    try {
      setPreview(canvas.toDataURL('image/png'));
    } catch {
      setPreview('');
    }
  }, [canvas]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const r = await sharePhoto(canvas, filename, S.appTitle);
    setBusy(false);
    onDone(r);
  };

  return (
    <Dialog
      title={S.photoTitle}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" size="lg" onClick={onClose}>{S.cancel}</Button>
          <Button variant="mint" size="lg" onClick={() => void save()} disabled={busy} data-action="photo-save" data-autofocus>{S.photoSave}</Button>
        </>
      }
    >
      <div className="photo">
        {preview && <img className="photo__preview pixelated" src={preview} alt="" />}
        <div className="photo__bgs" role="radiogroup" aria-label={S.photoBg}>
          {PHOTO_BGS.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={bg === b}
              className={`photo__bg photo__bg--${b} ${bg === b ? 'is-active' : ''}`}
              onClick={() => setBg(b)}
              data-bg={b}
            >
              {BG_LABEL[b]}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
