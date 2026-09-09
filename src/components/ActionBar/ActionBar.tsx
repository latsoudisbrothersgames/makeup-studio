import { S } from '../../data/strings';
import { Button } from '../Button/Button';
import './ActionBar.css';

interface Props {
  faceName: string;
  modelName: string;
  canUndo: boolean;
  canClear: boolean;
  onUndo(): void;
  onClear(): void;
  onSave(): void;
  onGallery(): void;
  onChangeFace(): void;
  onPhoto(): void;
  onIdeas(): void;
  /** Έχει επιλεγεί κάρτα έμπνευσης; (τονίζει το κουμπί) */
  ideasActive?: boolean;
}

export function ActionBar(p: Props) {
  return (
    <header className="actionbar">
      <div className="actionbar__top">
        <div className="actionbar__who">
          <span className="actionbar__label">{S.model}</span>
          <strong className="actionbar__name">{p.modelName ? `${p.faceName} · ${p.modelName}` : p.faceName}</strong>
        </div>
        <div className="actionbar__nav">
          <Button variant="secondary" icon="🖼️" onClick={p.onGallery} data-action="gallery">{S.gallery}</Button>
          <Button variant="sun" icon="👩" onClick={p.onChangeFace} data-action="change-face">{S.changeFace}</Button>
        </div>
      </div>
      <div className="actionbar__btns">
        <Button variant="lilac" icon="↩" onClick={p.onUndo} disabled={!p.canUndo} data-action="undo">{S.undo}</Button>
        <Button variant="ghost" icon="🧼" onClick={p.onClear} disabled={!p.canClear} data-action="clear">{S.clear}</Button>
        <Button variant="mint" icon="💾" onClick={p.onSave} data-action="save">{S.save}</Button>
        <Button variant="primary" icon="📸" onClick={p.onPhoto} data-action="photo">{S.photo}</Button>
        <Button variant={p.ideasActive ? 'sun' : 'ghost'} icon="💡" onClick={p.onIdeas} data-action="ideas">{S.ideas}</Button>
      </div>
    </header>
  );
}
