import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '../../ui/theme.css';
import '../../legacy/css/navbar.css';
import './inventory.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootProtectedPage } from '../../common/session';
import { ShaderBackground } from '../../common/shader';
import { InventoryPage } from './InventoryPage';

document.body.classList.add('protected');
new ShaderBackground(false).start();

void bootProtectedPage(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <InventoryPage />
    </StrictMode>,
  );
});
