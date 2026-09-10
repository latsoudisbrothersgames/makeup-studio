import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { StarBoard } from '../components/StarBoard/StarBoard';
import { S } from '../data/strings';
import { useSession } from '../state/SessionContext';
import { uiUrl } from '../assets';
import '../styles/layout.css';
import './StartScreen.css';

export function StartScreen() {
  const nav = useNavigate();
  const session = useSession();
  const [fs, setFs] = useState(!!document.fullscreenElement);
  const title = uiUrl('title_art');

  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  return (
    <main className="screen screen--scroll start">
      <div className="start__hero">
        {title ? <img className="start__art pixelated" src={title} alt="" /> : <div className="start__emoji" aria-hidden="true">💄✨👩</div>}
        <h1 className="screen__title">{S.appTitle}</h1>
      </div>
      <div className="start__actions">
        <Button size="xl" onClick={() => nav('/choose')} data-action="play">{S.play}</Button>
        <Button size="lg" variant="mint" icon="💇" onClick={() => nav('/salon')} data-action="salon">{S.salon}</Button>
        <Button size="lg" variant="sun" icon="🏆" onClick={() => nav('/choose?mode=game')} data-action="game">{S.game}</Button>
        <div className="start__row">
          <Button size="lg" variant="lilac" icon="🛒" onClick={() => nav('/shop')} data-action="shop">{S.shop}</Button>
          <Button size="lg" variant="secondary" icon="🖼️" onClick={() => nav('/gallery')} data-action="gallery">{S.gallery}</Button>
        </div>
      </div>
      <StarBoard current={session.modelName} />
      <div className="start__footer">
        {document.fullscreenEnabled && (
          <Button variant="ghost" onClick={toggleFs}>{fs ? S.exitFullscreen : S.fullscreen}</Button>
        )}
        <Button variant="ghost" onClick={() => session.setSound(!session.soundEnabled)}>
          {session.soundEnabled ? S.soundOn : S.soundOff}
        </Button>
      </div>
    </main>
  );
}
