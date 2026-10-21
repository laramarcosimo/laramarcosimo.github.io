/** Sintetizador de avisos con Web Audio (sin archivos externos). */
class SoundAlert {
  private ctx: AudioContext | null = null;

  /** Debe llamarse dentro de un gesto táctil para desbloquear el audio en iOS/Safari. */
  unlock(): void {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx ??= new AC();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* sin audio */
    }
  }

  private tone(freq: number, at: number, dur: number, peak: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  /** Pitido corto y sutil para la cuenta atrás (3, 2, 1). */
  tick(): void {
    this.tone(1000, 0, 0.09, 0.12);
  }

  /** Doble pitido de fin de descanso: 880 Hz + 1200 Hz. */
  done(): void {
    this.tone(880, 0, 0.22, 0.45);
    this.tone(1200, 0.26, 0.34, 0.45);
  }
}

export const soundAlert = new SoundAlert();

/** iPhone: Safari no tiene navigator.vibrate. Se usa el truco del interruptor nativo (input switch), que da un toque háptico en iOS 17.4+. */
let hapticLabel: HTMLLabelElement | null = null;
const tapHaptic = (): void => {
  try {
    if (!hapticLabel) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'apex-haptic';
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none';
      label.setAttribute('aria-hidden', 'true');
      label.appendChild(input);
      document.body.appendChild(label);
      hapticLabel = label;
    }
    hapticLabel.click();
  } catch {
    /* sin háptico */
  }
};

export const vibrate = (pattern: number | readonly number[]): void => {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(typeof pattern === 'number' ? pattern : [...pattern]);
      return;
    }
    // Sin Vibration API (iPhone): un toque por cada tramo de vibración del patrón.
    const p: readonly number[] = typeof pattern === 'number' ? [pattern] : pattern;
    p.forEach((_ms, i) => {
      if (i % 2 === 0) window.setTimeout(tapHaptic, p.slice(0, i).reduce((a, x) => a + x, 0));
    });
  } catch {
    /* sin vibración */
  }
};

/** Patrones distinguibles al tacto: fin de ejercicio (2 largos), empieza el siguiente (3 cortos) y cambio de lado (3 medios). */
export const BUZZ = {
  end: [250, 120, 250],
  start: [70, 60, 70, 60, 70],
  side: [130, 90, 130, 90, 130],
  /** Fin de un ejercicio y, tras una pausa, arranque del siguiente. */
  endThenStart: [250, 120, 250, 350, 70, 60, 70, 60, 70],
} as const;
