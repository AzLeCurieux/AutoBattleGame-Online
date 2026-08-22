import type { ClientToServerEvents, ServerToClientEvents } from '@autobattle/shared';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

/** Push channel only (leaderboard, multi-tab sync). Auth = the httpOnly session cookie. */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  withCredentials: true,
});

export function useSocketEvent<E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const listener = ((...args: Parameters<ServerToClientEvents[E]>) =>
      (ref.current as (...a: unknown[]) => void)(...args)) as unknown as ServerToClientEvents[E];
    // Socket.IO's typed `on` cannot express a generic event key.
    (socket.on as (e: string, l: unknown) => void)(event, listener);
    return () => {
      (socket.off as (e: string, l: unknown) => void)(event, listener);
    };
  }, [event]);
}
