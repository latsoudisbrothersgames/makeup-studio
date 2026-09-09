import { CARDS } from '../../data/cards';
import { S } from '../../data/strings';
import type { AppliedLayer } from '../../types/cosmetic';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import './CardsDialog.css';

interface Props {
  activeId: string | null;
  layers: AppliedLayer[];
  onPick(id: string | null): void;
  onClose(): void;
}

/** Επιλογή κάρτας έμπνευσης: 4 κάρτες με 2 αιτήματα η καθεμία, δείχνουν τι έχει ήδη γίνει. */
export function CardsDialog({ activeId, layers, onPick, onClose }: Props) {
  return (
    <Dialog
      title={S.cardsTitle}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" size="lg" onClick={() => { onPick(null); onClose(); }} data-action="card-none">{S.cardsNone}</Button>
          <Button variant="primary" size="lg" onClick={onClose} data-autofocus>{S.back}</Button>
        </>
      }
    >
      <div className="cards">
        {CARDS.map((c) => {
          const done = c.goals.map((g) => g.done(layers));
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              className={`card ${active ? 'is-active' : ''}`}
              data-card={c.id}
              onClick={() => { onPick(c.id); onClose(); }}
            >
              <span className="card__emoji" aria-hidden="true">{c.emoji}</span>
              <span className="card__title">{c.titleEl}</span>
              <span className="card__goals">
                {c.goals.map((g, i) => (
                  <span key={g.id} className={`card__goal ${done[i] ? 'is-done' : ''}`}>
                    <span aria-hidden="true">{done[i] ? '✓' : '○'}</span> {g.labelEl}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
