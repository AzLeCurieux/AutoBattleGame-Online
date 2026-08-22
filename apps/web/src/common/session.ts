import type { PublicUser } from '@autobattle/shared';
import { api, ApiError } from './api';
import { socket } from './socket';

/**
 * Same behaviour as the v1 pages: the body stays hidden until the session is
 * confirmed, then fades in. Without a session we go to /login. (In production
 * the server already redirects before sending the page.)
 */
export async function bootProtectedPage(render: (user: PublicUser) => void) {
  try {
    const user = await api.me();
    socket.connect();
    render(user);
    document.body.style.visibility = 'visible';
    document.body.style.opacity = '1';
    document.body.classList.add('ready');
  } catch (err) {
    if (!(err instanceof ApiError) || err.status === 401) window.location.replace('/login');
    else throw err;
  }
}

export async function logout() {
  await api.logout().catch(() => undefined);
  socket.disconnect();
  window.location.href = '/login';
}
