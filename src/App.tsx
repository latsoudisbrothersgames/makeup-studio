import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { unlockAudio } from './audio/soundManager';
import { SessionProvider } from './state/SessionContext';
import { StartScreen } from './screens/StartScreen';
import { ChooseFaceScreen } from './screens/ChooseFaceScreen';
import { StudioScreen } from './screens/StudioScreen';
import { GalleryScreen } from './screens/GalleryScreen';
import { GameScreen } from './screens/GameScreen';
import { RegionEditor } from './dev/RegionEditor';

export default function App() {
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  return (
    <SessionProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<StartScreen />} />
          <Route path="/choose" element={<ChooseFaceScreen />} />
          <Route path="/studio" element={<StudioScreen />} />
          <Route path="/gallery" element={<GalleryScreen />} />
          <Route path="/game" element={<GameScreen />} />
          <Route path="/dev/regions" element={<RegionEditor />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </SessionProvider>
  );
}
