import { accessoryUrl, iconUrl, stickerUrl } from '../../assets';
import { S } from '../../data/strings';
import { nextUnlock, UNLOCKS, type Unlock } from '../../data/unlocks';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import './UnlocksDialog.css';

interface Props {
  name: string;
  stars: number;
  onClose(): void;
}

function Art({ u }: { u: Unlock }) {
  const { kind, ids } = u.art;
  return (
    <span className="unlock__art" aria-hidden="true">
      {ids.map((id) => {
        if (kind === 'swatch') return <span key={id} className="unlock__swatch" style={{ background: id }} />;
        const url = kind === 'accessory' ? accessoryUrl(id) : kind === 'sticker' ? stickerUrl(id) : iconUrl(id);
        return url ? <img key={id} className={`unlock__img pixelated ${kind === 'icon' ? 'unlock__img--rainbow' : ''}`} src={url} alt="" /> : <span key={id}>{u.emoji}</span>;
      })}
    </span>
  );
}

/** «Τι ξεκλειδώνουν τα αστέρια;» — οι βαθμίδες με τα πραγματικά εικαστικά, και πού βρίσκεται το παιδί. */
export function UnlocksDialog({ name, stars, onClose }: Props) {
  const next = nextUnlock(stars);
  const prev = [...UNLOCKS].reverse().find((u) => stars >= u.stars)?.stars ?? 0;
  const pct = next ? Math.round(((stars - prev) / (next.stars - prev)) * 100) : 100;
  return (
    <Dialog title={S.unlocksButton} onClose={onClose} actions={<Button variant="primary" size="lg" onClick={onClose} data-autofocus data-action="unlocks-ok">{S.ok}</Button>}>
      <p className="unlocks__how">{S.unlocksHow}</p>
      <ol className="unlocks" data-unlocks>
        {UNLOCKS.map((u) => {
          const open = stars >= u.stars;
          return (
            <li key={u.stars} className={`unlock ${open ? 'is-open' : 'is-locked'}`} data-tier={u.stars} data-open={open ? '1' : '0'}>
              <Art u={u} />
              <span className="unlock__body">
                <span className="unlock__label">{u.emoji} {u.labelEl}</span>
                <span className="unlock__status">{open ? `✓ ${S.unlocksOpen}` : `🔒 ${S.unlocksNeed(u.stars - stars)}`}</span>
              </span>
              <span className="unlock__stars">{u.stars} ★</span>
            </li>
          );
        })}
      </ol>
      <div className="unlocks__me">
        <span className="unlocks__you">⭐ {S.unlocksYou(name || S.gamePlayerA, stars)}</span>
        <span className="unlocks__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span className="unlocks__fill" style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} /></span>
        <span className="unlocks__next">{next ? `${next.emoji} ${S.boardNext(next.stars, next.labelEl)}` : `🏆 ${S.boardAllUnlocked}`}</span>
      </div>
      <p className="unlocks__coins">{S.unlocksCoins}</p>
    </Dialog>
  );
}
