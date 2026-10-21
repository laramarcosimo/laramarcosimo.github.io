import { useCallback, useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'apex-theme';
const CHANGE = 'apex-theme-change';

const readPref = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

const systemLight = (): boolean => window.matchMedia('(prefers-color-scheme: light)').matches;

const apply = (pref: ThemePref): boolean => {
  const light = pref === 'light' || (pref === 'system' && systemLight());
  document.documentElement.classList.toggle('light', light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f2f4f8' : '#020617');
  return light;
};

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [light, setLight] = useState<boolean>(() => document.documentElement.classList.contains('light'));

  useEffect(() => {
    const sync = () => setPrefState(readPref());
    window.addEventListener(CHANGE, sync);
    return () => window.removeEventListener(CHANGE, sync);
  }, []);

  useEffect(() => {
    setLight(apply(pref));
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => setLight(apply('system'));
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* sin almacenamiento */
    }
    window.dispatchEvent(new Event(CHANGE));
  }, []);

  /** Alterna claro/oscuro de forma explícita. */
  const toggle = useCallback(() => setPref(light ? 'dark' : 'light'), [light, setPref]);
  return { pref, light, setPref, toggle };
}
