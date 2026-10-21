import { useEffect, useState } from 'react';
import { pushEnabled } from './push';

export const PUSH_EVENT = 'apex-push-change';

/** Estado de los avisos push que se actualiza solo: al activarlos o desactivarlos, al volver a la app y al cambiar el permiso en iOS. */
export function usePushEnabled(): boolean {
  const [on, setOn] = useState(pushEnabled);
  useEffect(() => {
    const refresh = () => setOn(pushEnabled());
    const vis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(PUSH_EVENT, refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener(PUSH_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return on;
}
