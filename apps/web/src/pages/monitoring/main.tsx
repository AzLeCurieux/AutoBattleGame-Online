import '@fortawesome/fontawesome-free/css/all.min.css';
import '../../legacy/css/main.css';
import '../../legacy/css/page-monitoring.css';
import '../../legacy/css/root.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootProtectedPage } from '../../common/session';
import { MonitoringPage } from './MonitoringPage';

void bootProtectedPage((user) => {
  // v1 had a separate admin password; admins are now normal accounts with a role.
  if (user.role !== 'admin') {
    window.location.replace('/');
    return;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MonitoringPage />
    </StrictMode>,
  );
});
