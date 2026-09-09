import { useMemo } from 'react';
import { playSound } from '../../audio/soundManager';
import { categoriesOf, COSMETICS, GROUPS, VARIANT_LABELS } from '../../data/cosmetics';
import { accessoryUrl, iconUrl, stickerUrl } from '../../assets';
import { unlockKey } from '../../data/unlocks';
import type { DragPayload } from '../../hooks/useDragCosmetic';
import type { Cosmetic, CosmeticCategory, CosmeticGroup } from '../../types/cosmetic';
import type { Face } from '../../types/face';
import './CosmeticsPanel.css';

export interface PanelSelection {
  group: CosmeticGroup;
  category: CosmeticCategory;
  color: string;
  variant?: string;
}

interface Props {
  face: Face;
  sel: PanelSelection;
  onSel(next: PanelSelection): void;
  onStartDrag(e: React.PointerEvent, payload: DragPayload): void;
  /** Κλειδιά (unlockKey) που είναι ακόμη κλειδωμένα → 🔒, δεν σέρνονται. */
  locked?: ReadonlySet<string>;
  onLocked?(key: string): void;
}

export function paletteFor(c: Cosmetic, face: Face): string[] {
  if (c.category === 'foundation') return face.foundationShades;
  if (c.category === 'concealer') return face.foundationShades.slice(0, 3).map((h) => lighten(h, 1.06));
  return c.palette;
}

function lighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.min(255, Math.round(c * k));
  return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Προεπιλεγμένη επιλογή για μια κατηγορία. */
export function defaultSelection(category: CosmeticCategory, face: Face): PanelSelection {
  const c = COSMETICS[category];
  const palette = paletteFor(c, face);
  return { group: c.group, category, color: palette[Math.min(2, palette.length - 1)] ?? palette[0] ?? '', variant: c.variants?.[0] };
}

export function CosmeticsPanel({ face, sel, onSel, onStartDrag, locked, onLocked }: Props) {
  const cats = useMemo(() => categoriesOf(sel.group), [sel.group]);
  const cosmetic = COSMETICS[sel.category];
  const isLocked = (v: string) => !!locked?.has(unlockKey(cosmetic.category, v));
  const palette = paletteFor(cosmetic, face);
  const isStickers = cosmetic.category === 'sticker';
  const isAccessory = cosmetic.category === 'accessory';
  // Μάσκα και μπογιές: επιλέγονται μόνο παραλλαγές (κάθε παραλλαγή έχει το χρώμα της), όχι swatches.
  const isMask = cosmetic.category === 'mask' || cosmetic.category === 'facePaint';
  const showSwatches = !isMask && palette.length > 1;

  const payload = (color: string, variant?: string): DragPayload => ({ cosmetic, color, variant });

  return (
    <aside className="panel" aria-label="Καλλυντικά" onDragStart={(e) => e.preventDefault()}>
      <nav className="panel__groups" aria-label="Ομάδες">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`panel__group ${sel.group === g.id ? 'is-active' : ''}`}
            onClick={() => {
              playSound('click');
              const first = categoriesOf(g.id)[0];
              onSel(defaultSelection(first.category, face));
            }}
          >
            <span className="panel__group-emoji" aria-hidden="true">{g.emoji}</span>
            <span>{g.labelEl}</span>
          </button>
        ))}
      </nav>

      <div className="panel__cats" role="list">
        {cats.map((c) => {
          const url = iconUrl(c.category) ?? (c.category === 'accessory' ? accessoryUrl('bow') : undefined);
          const active = c.category === sel.category;
          return (
            <button
              key={c.category}
              type="button"
              role="listitem"
              className={`panel__cat ${active ? 'is-active' : ''}`}
              data-category={c.category}
              onClick={() => {
                if (!active) {
                  playSound('click');
                  onSel(defaultSelection(c.category, face));
                }
              }}
              onPointerDown={(e) => {
                const s = active ? sel : defaultSelection(c.category, face);
                if (!active) onSel(s);
                onStartDrag(e, { cosmetic: c, color: s.color, variant: s.variant });
              }}
            >
              {url ? <img className="panel__cat-img pixelated" src={url} alt="" draggable={false} /> : <span className="panel__cat-emoji" aria-hidden="true">{c.emoji}</span>}
              <span className="panel__cat-label">{c.labelEl}</span>
            </button>
          );
        })}
      </div>

      <div className="panel__swatches-wrap">
        <p className="panel__hint">{cosmetic.hintEl}</p>
        {(isStickers || isMask || isAccessory) && cosmetic.variants && (
          <div className="panel__variants">
            {cosmetic.variants.map((v, i) => {
              const color = isMask ? cosmetic.palette[i] ?? sel.color : sel.color;
              const st = isStickers ? stickerUrl(v) : isAccessory ? accessoryUrl(v) : undefined;
              const lockedV = isLocked(v);
              return (
                <button
                  key={v}
                  type="button"
                  className={`swatch swatch--variant ${sel.variant === v ? 'is-active' : ''} ${lockedV ? 'is-locked' : ''}`}
                  data-swatch={`${cosmetic.category}:${v}`}
                  data-locked={lockedV ? '1' : undefined}
                  style={{ background: isMask ? color : undefined }}
                  onClick={() => (lockedV ? onLocked?.(unlockKey(cosmetic.category, v)) : onSel({ ...sel, variant: v, color: isMask ? color : sel.color }))}
                  onPointerDown={(e) => {
                    if (lockedV) return;
                    onSel({ ...sel, variant: v, color: isMask ? color : sel.color });
                    onStartDrag(e, payload(isMask ? color : sel.color, v));
                  }}
                  aria-label={VARIANT_LABELS[v] ?? v}
                  title={VARIANT_LABELS[v] ?? v}
                >
                  {st ? <img src={st} alt="" className="pixelated" draggable={false} /> : <span className="swatch__glyph" style={{ color: isStickers ? sel.color : undefined }}>{variantGlyph(v)}</span>}
                  {lockedV && <span className="swatch__lock" aria-hidden="true">🔒</span>}
                </button>
              );
            })}
          </div>
        )}
        {showSwatches && (
          <div className="panel__swatches">
            {palette.map((color) => {
              const lockedC = isLocked(color);
              return (
                <button
                  key={color}
                  type="button"
                  className={`swatch ${sel.color === color ? 'is-active' : ''} ${lockedC ? 'is-locked' : ''}`}
                  data-swatch={`${cosmetic.category}:${color}`}
                  data-locked={lockedC ? '1' : undefined}
                  style={{ background: color }}
                  onClick={() => (lockedC ? onLocked?.(unlockKey(cosmetic.category, color)) : onSel({ ...sel, color }))}
                  onPointerDown={(e) => {
                    if (lockedC) return;
                    onSel({ ...sel, color });
                    onStartDrag(e, payload(color, sel.variant));
                  }}
                  aria-label={`${cosmetic.labelEl} ${color}`}
                >
                  <span className="swatch__emoji" aria-hidden="true">{lockedC ? '🔒' : cosmetic.emoji}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function variantGlyph(v: string): string {
  switch (v) {
    case 'heart': return '❤';
    case 'star': return '★';
    case 'gem': return '◆';
    case 'flower': return '✿';
    case 'butterfly': return '🦋';
    case 'cat': return '🐱';
    case 'rainbow': return '🌈';
    case 'sheet': return '🧻';
    case 'cream': return '🧴';
    case 'clay': return '🪨';
    default: return '●';
  }
}
