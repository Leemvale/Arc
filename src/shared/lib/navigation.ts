import { useSyncExternalStore } from 'react';
const subscribe = (fn: () => void) => {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
};
export const navigate = (path: string) => {
  window.location.hash = path;
};

export function useHashRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return hash.match(/^#\/(session|result)\/([a-f0-9-]+)(?:\?answer=([\w-]+))?$/);
}
