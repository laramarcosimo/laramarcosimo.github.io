import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiGraceUntil, aiPending, cancelAi, weeklyCoach } from '../lib/gemini';
import type { Settings } from '../lib/types';

const settings = { geminiKey: 'k', geminiModel: 'gemini-test', aiGraceSec: 0 } as Settings;

afterEach(() => vi.unstubAllGlobals());

describe('cancelar la IA', () => {
  it('cancelar corta la consulta en curso con «Cancelado.» y limpia el contador', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError'))))));
    const p = weeklyCoach(settings, 'datos');
    const seen = Promise.race([p.then(() => 'ok', (e: Error) => e.message), new Promise((r) => setTimeout(() => r('pendiente'), 30))]);
    expect(await seen).toBe('pendiente'); // sigue en curso
    expect(aiPending()).toBe(1);
    cancelAi();
    await expect(p).rejects.toThrow('Cancelado.');
    expect(aiPending()).toBe(0);
  });
  it('cancelar durante el margen NO llega a enviar nada a Google', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const p = weeklyCoach({ ...settings, aiGraceSec: 3 } as Settings, 'x');
    await new Promise((r) => setTimeout(r, 20));
    expect(aiPending()).toBe(1);
    expect(aiGraceUntil()).toBeGreaterThan(Date.now());
    cancelAi();
    await expect(p).rejects.toThrow('Cancelado.');
    expect(f).not.toHaveBeenCalled();
    expect(aiGraceUntil()).toBe(0);
  });
  it('una respuesta normal no se ve afectada', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ puntos: ['a', 'b'] }) }] } }] }), { status: 200 })));
    expect(await weeklyCoach(settings, 'x')).toEqual(['a', 'b']);
    expect(aiPending()).toBe(0);
  });
});
