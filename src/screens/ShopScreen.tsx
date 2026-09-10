import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playSound } from '../audio/soundManager';
import { iconUrl } from '../assets';
import { Button } from '../components/Button/Button';
import { Toast } from '../components/Toast/Toast';
import { COSMETICS } from '../data/cosmetics';
import { ownsBg, SHOP_ITEMS, STAGE_BG_LABEL, type ShopItem } from '../data/shop';
import { S } from '../data/strings';
import { usePlayerStars } from '../hooks/usePlayerStars';
import { buyItem } from '../storage/players';
import { useSession } from '../state/SessionContext';
import '../styles/layout.css';
import './ShopScreen.css';

/** Κατάστημα: τα νομίσματα του Σαλονιού αγοράζουν χρώματα και σκηνικά (όλα από κώδικα). */
export function ShopScreen() {
  const nav = useNavigate();
  const session = useSession();
  const player = session.modelName || S.gamePlayerA;
  const { coins, owned } = usePlayerStars(session.modelName);
  const [toast, setToast] = useState<string | null>(null);

  const buy = (item: ShopItem) => {
    const r = buyItem(session.modelName, item.id, item.price);
    if (!r) { playSound('boing'); setToast(S.shopNeed(item.price - coins)); return; }
    playSound('save');
    setToast(S.shopBought(item.labelEl));
    if (item.kind === 'bg') session.setStageBg(item.bg);
  };

  const colors = SHOP_ITEMS.filter((i): i is Extract<ShopItem, { kind: 'color' }> => i.kind === 'color');
  const bgs = SHOP_ITEMS.filter((i): i is Extract<ShopItem, { kind: 'bg' }> => i.kind === 'bg');

  const renderBuy = (item: ShopItem) => {
    const has = owned.includes(item.id);
    if (has && item.kind === 'bg') {
      const inUse = session.stageBg === item.bg;
      return inUse
        ? <span className="shop__owned" data-inuse>✓ {S.shopInUse}</span>
        : <Button variant="mint" onClick={() => { session.setStageBg(item.bg); playSound('pop'); }} data-action="use">{S.shopUse}</Button>;
    }
    if (has) return <span className="shop__owned">✓ {S.shopOwned}</span>;
    const can = coins >= item.price;
    return (
      <Button variant={can ? 'primary' : 'ghost'} onClick={() => buy(item)} disabled={!can} data-action="buy" title={can ? undefined : S.shopNeed(item.price - coins)}>
        {item.price} 💰
      </Button>
    );
  };

  return (
    <main className="screen screen--scroll shop" data-coins={coins}>
      <div className="shop__head">
        <Button variant="ghost" icon="←" onClick={() => nav(-1)} data-action="shop-back">{S.back}</Button>
        <h1 className="screen__title">{S.shopTitle}</h1>
        <div className="shop__wallet" data-wallet>
          <span className="shop__who">{player}</span>
          <span className="shop__coins">💰 {coins}</span>
        </div>
      </div>
      <p className="screen__sub">{coins === 0 && owned.length === 0 ? S.shopEmptyCoins : S.shopIntro}</p>

      <h2 className="shop__section">🎨 {S.shopColors}</h2>
      <div className="shop__grid">
        {colors.map((item) => (
          <article key={item.id} className={`shop__card ${owned.includes(item.id) ? 'is-owned' : ''}`} data-item={item.id}>
            <div className="shop__art">
              <span className="shop__swatch" style={{ background: item.color }} />
              {iconUrl(item.category) && <img className="shop__icon pixelated" src={iconUrl(item.category)} alt="" />}
            </div>
            <h3 className="shop__label">{item.labelEl}</h3>
            <p className="shop__meta">{COSMETICS[item.category].labelEl}{item.keys.length > 1 ? ' + Τούφα' : ''}</p>
            {renderBuy(item)}
          </article>
        ))}
      </div>

      <h2 className="shop__section">🖼️ {S.shopBgs}</h2>
      <div className="shop__grid">
        <article className={`shop__card is-owned ${session.stageBg === 'classic' ? 'is-inuse' : ''}`} data-item="bg-classic">
          <div className="shop__art"><span className="shop__bg face-stage__frame" data-bg="classic" /></div>
          <h3 className="shop__label">{STAGE_BG_LABEL.classic}</h3>
          <p className="shop__meta">{S.shopBgs}</p>
          {session.stageBg === 'classic'
            ? <span className="shop__owned" data-inuse>✓ {S.shopInUse}</span>
            : <Button variant="mint" onClick={() => { session.setStageBg('classic'); playSound('pop'); }} data-action="use">{S.shopUse}</Button>}
        </article>
        {bgs.map((item) => (
          <article key={item.id} className={`shop__card ${ownsBg(owned, item.bg) ? 'is-owned' : ''} ${session.stageBg === item.bg ? 'is-inuse' : ''}`} data-item={item.id}>
            <div className="shop__art"><span className="shop__bg face-stage__frame" data-bg={item.bg} /></div>
            <h3 className="shop__label">{item.emoji} {STAGE_BG_LABEL[item.bg]}</h3>
            <p className="shop__meta">{S.shopBgs}</p>
            {renderBuy(item)}
          </article>
        ))}
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
