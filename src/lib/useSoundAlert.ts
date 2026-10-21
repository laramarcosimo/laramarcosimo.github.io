import { useMemo } from 'react';
import { soundAlert } from './feedback';
import { useStore } from './store';

/** Hook de avisos acústicos: respeta el ajuste "sonido de fin de descanso". `unlock` siempre actúa. */
export function useSoundAlert() {
  const enabled = useStore().state.settings.restSound;
  return useMemo(
    () => ({
      unlock: () => soundAlert.unlock(),
      tick: () => enabled && soundAlert.tick(),
      done: () => enabled && soundAlert.done(),
    }),
    [enabled],
  );
}
