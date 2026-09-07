/** Χάρτες URL για τα PixelLab assets — αρκεί να πέσει ένα PNG στον φάκελο. */
const icons = import.meta.glob('./icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const stickers = import.meta.glob('./stickers/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const ui = import.meta.glob('./ui/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function stem(path: string): string {
  return path.split('/').pop()!.replace(/\.png$/, '');
}

const ICONS = new Map(Object.entries(icons).map(([p, u]) => [stem(p), u]));
const STICKERS = new Map(Object.entries(stickers).map(([p, u]) => [stem(p), u]));
const UI = new Map(Object.entries(ui).map(([p, u]) => [stem(p), u]));

/** π.χ. iconUrl('lipstick') → src/assets/icons/ic_lipstick.png */
export function iconUrl(category: string): string | undefined {
  return ICONS.get(`ic_${category}`);
}

export function stickerUrl(variant: string): string | undefined {
  return STICKERS.get(`st_${variant}`);
}

export function uiUrl(name: string): string | undefined {
  return UI.get(name);
}

export function stickerUrls(): Record<string, string> {
  return Object.fromEntries(STICKERS);
}
