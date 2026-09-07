import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/comfortaa/400.css';
import '@fontsource/comfortaa/700.css';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
