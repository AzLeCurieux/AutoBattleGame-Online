import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '../../legacy/css/main.css';
import '../../legacy/css/page-login.css';
import '../../legacy/css/root.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LoginPage } from './LoginPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoginPage />
  </StrictMode>,
);
