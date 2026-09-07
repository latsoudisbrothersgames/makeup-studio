import type { Ref } from 'react';
import { createPortal } from 'react-dom';
import type { DragGhostState } from '../../hooks/useDragCosmetic';
import { iconUrl } from '../../assets';
import './DragGhost.css';

interface Props {
  ghost: DragGhostState | null;
  ref: Ref<HTMLDivElement>;
}

/** Το εικονίδιο που ακολουθεί το δάχτυλο/ποντίκι όσο σέρνεται ένα καλλυντικό. */
export function DragGhost({ ghost, ref }: Props) {
  if (!ghost) return null;
  const url = iconUrl(ghost.cosmetic.category);
  return createPortal(
    <div ref={ref} className="drag-ghost" aria-hidden="true">
      <span className="drag-ghost__blob" style={{ background: ghost.color || '#fff' }} />
      {url ? <img className="drag-ghost__img pixelated" src={url} alt="" /> : <span className="drag-ghost__emoji">{ghost.cosmetic.emoji}</span>}
    </div>,
    document.body,
  );
}
