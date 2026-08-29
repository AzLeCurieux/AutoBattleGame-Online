import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '../../ui/theme.css';
import '../../legacy/css/navbar.css';
import './game.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootProtectedPage } from '../../common/session';
import { ShaderBackground } from '../../common/shader';
import { CardHoverProvider } from '../../ui/CardHover';
import { ToastProvider } from '../../ui/components';
import { GamePage } from './GamePage';

document.body.classList.add('protected');
// The background only moves during fights (as in v1).
const shader = new ShaderBackground(false);
shader.start();

void bootProtectedPage((user) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ToastProvider>
        <CardHoverProvider>
          <GamePage initialUser={user} shader={shader} />
        </CardHoverProvider>
      </ToastProvider>
    </StrictMode>,
  );
});
