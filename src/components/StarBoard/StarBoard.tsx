import { useEffect, useState } from 'react';
import { S } from '../../data/strings';
import { nextUnlock, UNLOCKS } from '../../data/unlocks';
import { ANONYMOUS, playerStars, topPlayers, type PlayerStats } from '../../storage/players';
import { Button } from '../Button/Button';
import { UnlocksDialog } from './UnlocksDialog';
import './StarBoard.css';

interface Props {
  /** Όνομα του παιδιού που παίζει τώρα (τονίζεται στη λίστα). */
  current: string;
  max?: number;
}

/** Πίνακας αστεριών της συσκευής: ποιος έχει πόσα, και τι ξεκλειδώνει μετά. */
export function StarBoard({ current, max = 8 }: Props) {
  const [rows, setRows] = useState<PlayerStats[]>(() => topPlayers(max));
  const [mine, setMine] = useState(() => playerStars(current));
  const [showUnlocks, setShowUnlocks] = useState(false);
  useEffect(() => {
    const refresh = () => { setRows(topPlayers(max)); setMine(playerStars(current)); };
    refresh();
    window.addEventListener('makeup:players-changed', refresh);
    return () => window.removeEventListener('makeup:players-changed', refresh);
  }, [current, max]);

  const next = nextUnlock(mine);
  const me = (current || ANONYMOUS).trim().toLowerCase();

  return (
    <section className="board" aria-label={S.boardTitle} data-board>
      <h2 className="board__title">⭐ {S.boardTitle}</h2>
      {rows.length === 0 ? (
        <p className="board__empty">{S.boardEmpty}</p>
      ) : (
        <ol className="board__list">
          {rows.map((p, i) => (
            <li key={p.name} className={`board__row ${p.name.trim().toLowerCase() === me ? 'is-me' : ''}`}>
              <span className="board__rank">{i + 1}</span>
              <span className="board__name">{p.name}</span>
              <span className="board__stars">{p.stars} ★</span>
            </li>
          ))}
        </ol>
      )}
      <p className="board__next">
        {next ? `${next.emoji} ${S.boardNext(next.stars, next.labelEl)}` : `🏆 ${S.boardAllUnlocked}`}
        {current ? ` · ${current}: ${mine} ★` : ''}
      </p>
      <ul className="board__unlocks" aria-label={S.unlocksTitle}>
        {UNLOCKS.map((u) => (
          <li key={u.stars} className={`board__unlock ${mine >= u.stars ? 'is-open' : ''}`} title={u.labelEl}>
            <span aria-hidden="true">{mine >= u.stars ? u.emoji : '🔒'}</span> {u.stars}★
          </li>
        ))}
      </ul>
      <Button variant="sun" icon="⭐" onClick={() => setShowUnlocks(true)} data-action="unlocks">{S.unlocksButton}</Button>
      {showUnlocks && <UnlocksDialog name={current} stars={mine} onClose={() => setShowUnlocks(false)} />}
    </section>
  );
}
