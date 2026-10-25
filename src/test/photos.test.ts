import { describe, expect, it } from 'vitest';
import { pickMonthly } from '../lib/photosPdf';
import type { PhotoRec } from '../lib/photos';

const ph = (id: string, date: string, kind: 'cuerpo' | 'cara'): PhotoRec => ({ id, ts: new Date(date).getTime(), kind, blob: new Blob(), bytes: 1 });

describe('PDF mensual', () => {
  it('elige una foto por mes y tipo (la primera) y ordena por fecha', () => {
    const rows = pickMonthly([ph('c', '2026-02-20T10:00:00', 'cuerpo'), ph('a', '2026-01-05T10:00:00', 'cuerpo'), ph('b', '2026-01-25T10:00:00', 'cuerpo'), ph('d', '2026-01-10T10:00:00', 'cara')]);
    expect(rows).toHaveLength(2);
    expect(rows[0].cuerpo?.id).toBe('a');
    expect(rows[0].cara?.id).toBe('d');
    expect(rows[1].cuerpo?.id).toBe('c');
    expect(rows[1].cara).toBeUndefined();
  });
});

import { photoDueAt } from '../lib/reminders';
import { mkState } from './fixtures';

describe('recordatorio mensual de foto', () => {
  const at = (s: Parameters<typeof mkState>[0], now: string) => photoDueAt(mkState(s), new Date(now).getTime());
  const cfg = { photoRemind: true, photoDay: 10, photoTime: '09:00' };
  it('desactivado no avisa', () => {
    expect(at({ settings: {} }, '2026-10-05T12:00:00')).toBeNull();
  });
  it('antes del día elegido programa ese día; si ya la hiciste este mes, el mes siguiente', () => {
    expect(new Date(at({ settings: cfg }, '2026-10-05T12:00:00')!).getDate()).toBe(10);
    const taken = at({ settings: { ...cfg, lastPhotoTs: new Date('2026-10-02T10:00:00').getTime() } }, '2026-10-12T12:00:00')!;
    expect(new Date(taken).getMonth()).toBe(10);
  });
  it('si se pasó el día y no la hiciste, insiste cada día a esa hora', () => {
    const t = new Date(at({ settings: cfg }, '2026-10-15T12:00:00')!);
    expect(t.getDate()).toBe(16);
    expect(t.getHours()).toBe(9);
  });
});

import { syncWith } from '../lib/photosCloud';

describe('subida automática de fotos', () => {
  const mk = (id: string, cloud = false): PhotoRec => ({ id, ts: 1, kind: 'cuerpo', blob: new Blob(['x']), bytes: 1, cloud });
  it('sube solo las pendientes y las marca', async () => {
    const up: string[] = [];
    const mark: string[] = [];
    const r = await syncWith([mk('a'), mk('b', true), mk('c')], { shrink: async (p) => p.blob, encode: async () => 'DATA', upload: async (p) => void up.push(p.id), markCloud: async (p) => void mark.push(p.id) });
    expect(r).toEqual({ uploaded: 2, pending: 0, error: '' });
    expect(up).toEqual(['a', 'c']);
    expect(mark).toEqual(['a', 'c']);
  });
  it('si falla una, se detiene y deja el resto pendiente con el error', async () => {
    const mark: string[] = [];
    const r = await syncWith([mk('a'), mk('b'), mk('c')], { shrink: async (p) => p.blob, encode: async () => 'D', upload: async (p) => { if (p.id === 'b') throw new Error('Falta ejecutar el script de fotos en Supabase (SQL Editor).'); }, markCloud: async (p) => void mark.push(p.id) });
    expect(r.uploaded).toBe(1);
    expect(r.pending).toBe(2);
    expect(r.error).toContain('script de fotos');
    expect(mark).toEqual(['a']);
  });
  it('sin pendientes no hace nada', async () => {
    expect(await syncWith([mk('a', true)], { shrink: async (p) => p.blob, encode: async () => '', upload: async () => { throw new Error('no debería'); }, markCloud: async () => {} })).toEqual({ uploaded: 0, pending: 0, error: '' });
  });
});

import { grayStats } from '../lib/photos';

describe('calidad de la foto', () => {
  it('detecta oscura, plana y con detalle', () => {
    const w = 20;
    const h = 20;
    const dark = new Uint8Array(w * h).fill(10);
    expect(grayStats(dark, w, h).mean).toBeLessThan(45);
    expect(grayStats(dark, w, h).sharp).toBe(0); // sin detalle: se considerará borrosa
    const checker = new Uint8Array(w * h).map((_, i) => ((i % w) + Math.floor(i / w)) % 2 === 0 ? 220 : 40);
    const st = grayStats(checker, w, h);
    expect(st.mean).toBeGreaterThan(100);
    expect(st.sharp).toBeGreaterThan(1000);
  });
});

import { isNetworkError } from '../lib/mealQueue';
import { trashExpired } from '../lib/photos';

describe('cola sin conexión y papelera', () => {
  it('distingue fallos de conexión de otros', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('Load failed'))).toBe(true);
    expect(isNetworkError(new Error('Falta la API Key de Gemini (Ajustes).'))).toBe(false);
  });
  it('la papelera expira a los 3 días', () => {
    const p = { id: 'a', ts: 1, kind: 'cuerpo' as const, blob: new Blob(), bytes: 1, deletedAt: 1000 };
    expect(trashExpired(p, 1000 + 2 * 86_400_000)).toBe(false);
    expect(trashExpired(p, 1000 + 3 * 86_400_000)).toBe(true);
    expect(trashExpired({ ...p, deletedAt: undefined }, 1e15)).toBe(false);
  });
});

describe('ángulos de las fotos', () => {
  const v = (id: string, date: string, kind: 'cuerpo' | 'cara', view?: 'frente' | 'lado' | 'espalda' | 'perfil'): PhotoRec => ({ id, ts: new Date(date).getTime(), kind, view, blob: new Blob(), bytes: 1 });
  it('una foto por mes y ángulo; las antiguas sin ángulo cuentan como de frente', async () => {
    const { pickMonthlyView } = await import('../lib/photosPdf');
    const fotos = [v('a', '2026-01-05T10:00:00', 'cuerpo'), v('b', '2026-01-09T10:00:00', 'cuerpo', 'frente'), v('c', '2026-01-06T10:00:00', 'cuerpo', 'lado'), v('d', '2026-02-02T10:00:00', 'cuerpo', 'frente'), v('e', '2026-01-06T10:00:00', 'cara', 'perfil')];
    expect(pickMonthlyView(fotos, 'cuerpo', 'frente').map((x) => x.p.id)).toEqual(['a', 'd']);
    expect(pickMonthlyView(fotos, 'cuerpo', 'lado').map((x) => x.p.id)).toEqual(['c']);
    expect(pickMonthlyView(fotos, 'cuerpo', 'espalda')).toEqual([]);
    expect(pickMonthlyView(fotos, 'cara', 'perfil').map((x) => x.p.id)).toEqual(['e']);
  });
  it('el ángulo viaja a la nube dentro del tipo y se recupera', async () => {
    const { kindWire, parseKindWire } = await import('../lib/photos');
    expect(kindWire({ kind: 'cuerpo', view: 'lado' })).toBe('cuerpo:lado');
    expect(kindWire({ kind: 'cara' })).toBe('cara');
    expect(parseKindWire('cuerpo:espalda')).toEqual({ kind: 'cuerpo', view: 'espalda' });
    expect(parseKindWire('cara')).toEqual({ kind: 'cara', view: undefined });
    expect(parseKindWire('cara:cuello')).toEqual({ kind: 'cara', view: 'cuello' });
    expect(kindWire({ kind: 'cara', view: 'cuello' })).toBe('cara:cuello');
  });
});

describe('medidas del mismo día bajo la foto', () => {
  it('coge la medida de ese día (la última) y la resume en líneas cortas', async () => {
    const { measureOnDay, measureLines } = await import('../lib/photosPdf');
    const d = (h: number, day = 10) => new Date(2026, 6, day, h).getTime();
    const ms = [{ id: 'a', ts: d(8), weight: 61.5, waist: 70 }, { id: 'b', ts: d(20), weight: 61.2, waist: 69.5, hip: 95, arm: 28 }, { id: 'c', ts: d(8, 11), weight: 60 }];
    const m = measureOnDay(ms, d(12));
    expect(m?.id).toBe('b');
    expect(measureLines(m)).toEqual(['Peso 61,2 kg  ·  Cintura 69,5 cm', 'Cadera 95 cm', 'Brazo 28 cm']);
    expect(measureOnDay(ms, d(12, 12))).toBeUndefined();
    expect(measureLines(undefined)).toEqual([]);
  });
});

describe('resumen del año', () => {
  it('cambio total y media al mes entre la primera y la última medida (una por mes)', async () => {
    const { yearSummary } = await import('../lib/photosPdf');
    const m = (month: number, day: number, weight: number, waist?: number) => ({ id: `${month}${day}`, ts: new Date(2026, month, day, 9).getTime(), weight, waist });
    const rows = yearSummary([m(0, 5, 70, 80), m(0, 25, 69, 79), m(3, 10, 66, 76), m(6, 12, 64, 74)], new Date(2026, 0, 1).getTime(), new Date(2026, 6, 30).getTime());
    const peso = rows.find((r) => r.label === 'Peso')!;
    expect(peso).toMatchObject({ first: 69, last: 64, change: -5, months: 6, lowerIsBetter: true });
    expect(peso.perMonth).toBeCloseTo(-0.83, 2);
    expect(rows.find((r) => r.label === 'Cintura')?.change).toBe(-5);
    expect(rows.find((r) => r.label === 'Muslo')).toBeUndefined();
    expect(yearSummary([m(0, 5, 70)], 0, Date.now())).toEqual([]);
  });
});

describe('caducidad del archivo de informes', () => {
  it('mes: solo el año en curso; año y fotos: 3 años (actual y 2 anteriores)', async () => {
    const { keepReport, reportId } = await import('../lib/reports');
    const now = new Date(2026, 5, 1).getTime();
    expect(keepReport({ kind: 'mes', year: 2026 }, now)).toBe(true);
    expect(keepReport({ kind: 'mes', year: 2025 }, now)).toBe(false);
    expect(keepReport({ kind: 'anio', year: 2024 }, now)).toBe(true);
    expect(keepReport({ kind: 'anio', year: 2023 }, now)).toBe(false);
    expect(keepReport({ kind: 'fotos', year: 2024 }, now)).toBe(true);
    expect(keepReport({ kind: 'fotos', year: 2023 }, now)).toBe(false);
    expect(reportId('mes', 2026, 0)).toBe('mes-2026-01');
    expect(reportId('anio', 2026)).toBe('anio-2026');
  });
});
