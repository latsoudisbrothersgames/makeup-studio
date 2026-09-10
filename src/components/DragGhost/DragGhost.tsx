import type { Ref } from 'react';
import { createPortal } from 'react-dom';
import { GHOST_LIFT, type DragGhostState } from '../../hooks/useDragCosmetic';
import { accessoryUrl, iconUrl, stickerUrl } from '../../assets';
import './DragGhost.css';

interface Props {
  ghost: DragGhostState | null;
  ref: Ref<HTMLDivElement>;
}

/** Το εικονίδιο που ακολουθεί το δάχτυλο/ποντίκι όσο σέρνεται ένα καλλυντικό. */
export function DragGhost({ ghost, ref }: Props) {
  if (!ghost) return null;
  // Αυτοκόλλητα/αξεσουάρ: το φάντασμα δείχνει την επιλεγμένη παραλλαγή (λουλούδι, φιόγκος), όχι το γενικό εικονίδιο.
  const url =
    (ghost.cosmetic.category === 'sticker' && ghost.variant ? stickerUrl(ghost.variant) : undefined) ??
    (ghost.cosmetic.category === 'accessory' && ghost.variant ? accessoryUrl(ghost.variant) : undefined) ??
    iconUrl(ghost.cosmetic.category);
  return createPortal(
    <div
      ref={ref}
      className="drag-ghost"
      aria-hidden="true"
      style={{ transform: `translate3d(${ghost.x}px, ${ghost.y - (ghost.pointerType === 'touch' ? GHOST_LIFT : 0)}px, 0) translate(-50%, -50%)`, opacity: 1 }}
    >
      <span className="drag-ghost__blob" style={{ background: ghost.color || '#fff' }} />
      {url ? <img className="drag-ghost__img pixelated" src={url} alt="" draggable={false} /> : <span className="drag-ghost__emoji">{ghost.cosmetic.emoji}</span>}
    </div>,
    document.body,
  );
}
