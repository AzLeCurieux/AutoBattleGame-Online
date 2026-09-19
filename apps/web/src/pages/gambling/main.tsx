import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '../../ui/theme.css';
import '../../legacy/css/navbar.css';
import './gambling.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootProtectedPage } from '../../common/session';
import { ShaderBackground } from '../../common/shader';
import { ToastProvider } from '../../ui/components';
import { GamblingPage } from './GamblingPage';

document.body.classList.add('protected');
// Gambling page: the background always moves (as in v1).
const shader = new ShaderBackground(true);
shader.start();

void bootProtectedPage(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ToastProvider>
        <GamblingPage shader={shader} />
      </ToastProvider>
    </StrictMode>,
  );
});
