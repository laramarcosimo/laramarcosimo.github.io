import type { Measurement } from './types';
import { drawGoalBox, type GoalSummary } from './goalSummary';
import { ANGLES, compressPhoto, viewOf, type PhotoKind, type PhotoRec, type PhotoView } from './photos';

interface PdfDoc {
  setFont: (f: string, s?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  text: (t: string | string[], x: number, y: number, o?: { align?: 'left' | 'center' | 'right' }) => void;
  getTextWidth: (t: string) => number;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string) => void;
  circle: (x: number, y: number, r: number, style?: string) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (w: number) => void;
  addPage: () => void;
  addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void;
  getNumberOfPages: () => number;
  setPage: (n: number) => void;
  output: (t: 'blob') => Blob;
  save: (name: string) => void;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const key = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
};
const fmt = (t: number): string => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

/** Una foto por mes y tipo (la primera de cada mes), ordenadas de más antigua a más reciente. */
export const pickMonthly = (photos: PhotoRec[]): { month: string; cuerpo?: PhotoRec; cara?: PhotoRec }[] => {
  const by = new Map<string, { month: string; cuerpo?: PhotoRec; cara?: PhotoRec }>();
  for (const p of [...photos].sort((a, b) => a.ts - b.ts)) {
    const k = key(p.ts);
    const row = by.get(k) ?? { month: k };
    if (!row[p.kind]) row[p.kind] = p; // la primera del mes
    by.set(k, row);
  }
  return [...by.values()];
};

const dataUrl = (b: Blob): Promise<{ url: string; w: number; h: number }> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      const i = new Image();
      i.onload = () => res({ url, w: i.naturalWidth, h: i.naturalHeight });
      i.onerror = () => rej(new Error('No se pudo leer una foto'));
      i.src = url;
    };
    r.onerror = () => rej(new Error('No se pudo leer una foto'));
    r.readAsDataURL(b);
  });

/** Una foto por mes de un ángulo concreto (la primera de cada mes), de la más antigua a la más reciente. */
export const pickMonthlyView = (photos: PhotoRec[], kind: PhotoKind, view: PhotoView): { month: string; p: PhotoRec }[] => {
  const by = new Map<string, PhotoRec>();
  for (const p of [...photos].sort((x, y) => x.ts - y.ts)) {
    if (p.kind !== kind || viewOf(p) !== view) continue;
    const k = key(p.ts);
    if (!by.has(k)) by.set(k, p);
  }
  return [...by.entries()].map(([month, p]) => ({ month, p }));
};

const COLS = 4;
const CW = 43;
const CH = 57;
const GAP = 3.3;
const PER_PAGE = 12;

const dayStr = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
/** Medidas y peso tomados el MISMO día que la foto (la última de ese día); undefined si no hay. */
export const measureOnDay = (measurements: Measurement[], ts: number): Measurement | undefined => measurements.filter((m) => dayStr(m.ts) === dayStr(ts)).sort((a, b) => b.ts - a.ts)[0];
const num1 = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');
/** Líneas cortas con lo medido ese día (hasta 3), para ponerlas bajo la foto. */
export const measureLines = (m: Measurement | undefined): string[] => {
  if (!m) return [];
  const part = (l: string, v: number | undefined, u: string): string | null => (v !== undefined && v > 0 ? `${l} ${num1(v)} ${u}` : null);
  const rows = [[part('Peso', m.weight, 'kg'), part('Cintura', m.waist, 'cm')], [part('Cadera', m.hip, 'cm'), part('Muslo', m.thigh, 'cm')], [part('Brazo', m.arm, 'cm'), part('Pecho', m.chest, 'cm')]];
  return rows.map((r) => r.filter(Boolean).join('  ·  ')).filter(Boolean);
};

export interface YearRow {
  label: string;
  unit: string;
  first: number;
  last: number;
  /** Cambio total (última − primera) y cambio medio por mes. */
  change: number;
  perMonth: number;
  /** Mes de la primera y de la última medida y meses entre ambas. */
  months: number;
  /** En peso, cintura y cadera, bajar cuenta como mejora. */
  lowerIsBetter: boolean;
}
const MEASURE_ROWS = [['Peso', 'weight', 'kg', true], ['Cintura', 'waist', 'cm', true], ['Cadera', 'hip', 'cm', true], ['Muslo', 'thigh', 'cm', false], ['Brazo', 'arm', 'cm', false], ['Pecho', 'chest', 'cm', false]] as const;
const monthIndex = (k: string): number => {
  const [y, m] = k.split('-').map(Number);
  return y * 12 + m;
};
/** Cómo has cambiado entre la primera y la última medida del periodo (una por mes: la última de cada mes) y el cambio medio al mes. */
export const yearSummary = (measurements: Measurement[], fromTs: number, toTs: number): YearRow[] => {
  const lo = monthIndex(key(fromTs));
  const hi = monthIndex(key(toTs));
  const rows: YearRow[] = [];
  for (const [label, field, unit, lowerIsBetter] of MEASURE_ROWS) {
    const perMonth = new Map<string, number>();
    for (const m of [...measurements].sort((a, b) => a.ts - b.ts)) {
      const v = m[field];
      const idx = monthIndex(key(m.ts));
      if (v !== undefined && v > 0 && idx >= lo && idx <= hi) perMonth.set(key(m.ts), v);
    }
    const ks = [...perMonth.keys()].sort();
    if (ks.length < 2) continue;
    const first = perMonth.get(ks[0]) as number;
    const last = perMonth.get(ks[ks.length - 1]) as number;
    const months = Math.max(1, monthIndex(ks[ks.length - 1]) - monthIndex(ks[0]));
    rows.push({ label, unit, first, last, change: Math.round((last - first) * 10) / 10, perMonth: Math.round(((last - first) / months) * 100) / 100, months, lowerIsBetter });
  }
  return rows;
};

type Sec = { kind: PhotoKind; a: { id: PhotoView; label: string; long: string }; cells: { month: string; p: PhotoRec }[] };
const cap = (t: string): string => `${t[0].toUpperCase()}${t.slice(1)}`;

/**
 * PDF del proceso: portada; una hoja por mes con el cuerpo (frente, lado y espalda) y la cara (frente, perfil y cuello) de ese mes;
 * y la vista del año, con una hoja por ángulo (todas las de frente juntas, todas las de lado…) y el mes escrito debajo.
 */
export async function monthlyPhotosPdf(photos: PhotoRec[], measurements: Measurement[], goal?: GoalSummary, onFile?: (f: File) => void | Promise<void>): Promise<boolean> {
  const sections: Sec[] = (['cuerpo', 'cara'] as const).flatMap((kind) => ANGLES[kind].map((a) => ({ kind, a, cells: pickMonthlyView(photos, kind, a.id) }))).filter((x) => x.cells.length > 0);
  if (sections.length === 0) throw new Error('Aún no hay fotos para el PDF.');
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'mm', format: 'a4' }) as unknown as PdfDoc;
  const all = sections.flatMap((x) => x.cells.map((c) => c.p)).sort((x, y) => x.ts - y.ts);
  const first = all[0];
  const last = all[all.length - 1];
  const months = [...new Set(sections.flatMap((x) => x.cells.map((c) => c.month)))].sort();

  // ---------- Estilo ----------
  type RGB = [number, number, number];
  const C1: RGB = [30, 64, 175];
  const C2: RGB = [14, 165, 233];
  const INK: RGB = [15, 23, 42];
  const GRAYC: RGB = [100, 116, 139];
  const mix = (p: RGB, q: RGB, t: number): RGB => [Math.round(p[0] + (q[0] - p[0]) * t), Math.round(p[1] + (q[1] - p[1]) * t), Math.round(p[2] + (q[2] - p[2]) * t)];
  const ACOL: Record<string, RGB> = { 'cuerpo-frente': [37, 99, 235], 'cuerpo-lado': [124, 58, 237], 'cuerpo-espalda': [14, 165, 233], 'cara-frente': [225, 29, 72], 'cara-perfil': [245, 158, 11], 'cara-cuello': [20, 184, 166] };
  const colOf = (kind: PhotoKind, v: PhotoView): RGB => ACOL[`${kind}-${v}`] ?? C1;
  const band = (h: number): void => {
    for (let i = 0; i < h; i += 1) {
      d.setFillColor(...mix(C1, C2, i / Math.max(1, h - 1)));
      d.rect(0, i, 210, 1.2, 'F');
    }
  };
  const bar = (x: number, y: number, c: RGB): void => {
    d.setFillColor(...c);
    d.roundedRect(x, y, 2.4, 6, 1.1, 1.1, 'F');
  };

  // ---------- Portada ----------
  band(62);
  d.setTextColor(255, 255, 255);
  d.setFont('helvetica', 'bold');
  d.setFontSize(32);
  d.text('Mi proceso', 14, 30);
  d.setFont('helvetica', 'normal');
  d.setFontSize(12);
  d.text(`${fmt(first.ts)} ${new Date(first.ts).getFullYear()} - ${fmt(last.ts)} ${new Date(last.ts).getFullYear()} · ${months.length} mes${months.length === 1 ? '' : 'es'}`, 14, 42);
  d.setFontSize(9);
  d.text('Apex Coach · fotos de progreso', 14, 48);
  const nPhotos = all.length;
  const sum = yearSummary(measurements, first.ts, last.ts);
  const w0 = sum.find((r) => r.label === 'Peso');
  const c0 = sum.find((r) => r.label === 'Cintura');
  const cards: { label: string; value: string; sub: string; c: RGB }[] = [
    { label: 'Fotos', value: String(nPhotos), sub: `en ${months.length} mes${months.length === 1 ? '' : 'es'}`, c: C1 },
    { label: 'Ángulos', value: String(sections.length), sub: 'cuerpo y cara', c: [124, 58, 237] },
    { label: 'Peso', value: w0 ? `${w0.change > 0 ? '+' : ''}${num1(w0.change)} kg` : '-', sub: w0 ? `${num1(w0.first)} a ${num1(w0.last)} kg` : 'sin medidas', c: [5, 150, 105] },
    { label: 'Cintura', value: c0 ? `${c0.change > 0 ? '+' : ''}${num1(c0.change)} cm` : '-', sub: c0 ? `${num1(c0.first)} a ${num1(c0.last)} cm` : 'sin medidas', c: [234, 88, 12] },
  ];
  cards.forEach((c, i) => {
    const x = 14 + i * 46;
    d.setFillColor(255, 255, 255);
    d.setDrawColor(226, 232, 240);
    d.setLineWidth(0.3);
    d.roundedRect(x, 52, 43, 28, 3, 3, 'FD');
    d.setFillColor(...c.c);
    d.roundedRect(x, 52, 43, 3, 1.5, 1.5, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(15);
    d.setTextColor(...c.c);
    d.text(c.value, x + 21.5, 66, { align: 'center' });
    d.setFontSize(7.5);
    d.setTextColor(...INK);
    d.text(c.label.toUpperCase(), x + 21.5, 72, { align: 'center' });
    d.setFont('helvetica', 'normal');
    d.setTextColor(...GRAYC);
    d.text(c.sub, x + 21.5, 77, { align: 'center' });
  });
  // Mapa de registro: una fila por ángulo, un punto por mes con foto.
  bar(14, 92, C1);
  d.setFont('helvetica', 'bold');
  d.setFontSize(12);
  d.setTextColor(...INK);
  d.text('Tu registro de fotos', 19, 97);
  const shown = months.slice(-18);
  const step = Math.min(8.5, 120 / Math.max(1, shown.length));
  sections.forEach((sec, r) => {
    const yy = 109 + r * 11;
    const col = colOf(sec.kind, sec.a.id);
    d.setFont('helvetica', 'normal');
    d.setFontSize(8.5);
    d.setTextColor(...INK);
    d.text(cap(sec.a.long), 14, yy + 1);
    shown.forEach((mo, i) => {
      const has = sec.cells.some((c) => c.month === mo);
      d.setFillColor(...(has ? col : ([226, 232, 240] as RGB)));
      d.circle(76 + i * step, yy, has ? 2.4 : 1.4, 'F');
    });
  });
  d.setFontSize(7);
  d.setTextColor(...GRAYC);
  shown.forEach((mo, i) => {
    const [yy, mm] = mo.split('-').map(Number);
    if (shown.length <= 12 || i % 2 === 0) d.text(`${MONTHS[mm].slice(0, 3)} ${String(yy).slice(2)}`, 76 + i * step, 109 + sections.length * 11 + 1, { align: 'center' });
  });
  d.setFontSize(10);
  d.setTextColor(...INK);
  d.text(['Una hoja por mes: cuerpo (frente, lado y espalda) y cara (frente, perfil y cuello).', 'Después, la vista del año: una hoja por ángulo, mes a mes, y el resumen de tu evolución.'], 14, 109 + sections.length * 11 + 14);
  if (goal) drawGoalBox(d, 14, 109 + sections.length * 11 + 30, 182, goal);

  // ---------- Fotos con marco ----------
  const put = async (p: PhotoRec | undefined, x: number, y: number, w: number, h: number, frame: RGB = [203, 213, 225]): Promise<void> => {
    d.setFillColor(...frame);
    d.roundedRect(x - 0.9, y - 0.9, w + 1.8, h + 1.8, 2, 2, 'F');
    d.setFillColor(241, 245, 249);
    d.rect(x, y, w, h, 'F');
    if (!p) {
      d.setFont('helvetica', 'normal');
      d.setFontSize(8);
      d.setTextColor(148, 163, 184);
      d.text('Sin foto', x + w / 2, y + h / 2, { align: 'center' });
      return;
    }
    const im = await dataUrl(await compressPhoto(p.blob, 560, 30_000).catch(() => p.blob));
    const sc = Math.min(w / im.w, h / im.h);
    d.addImage(im.url, 'JPEG', x + (w - im.w * sc) / 2, y + (h - im.h * sc) / 2, im.w * sc, im.h * sc);
  };
  const pick = (kind: PhotoKind, view: PhotoView, month: string): PhotoRec | undefined => sections.find((x) => x.kind === kind && x.a.id === view)?.cells.find((c) => c.month === month)?.p;

  // ---------- Una hoja por mes ----------
  for (const month of months) {
    d.addPage();
    const [y, m] = month.split('-').map(Number);
    band(24);
    d.setTextColor(255, 255, 255);
    d.setFont('helvetica', 'bold');
    d.setFontSize(20);
    d.text(`${cap(MONTHS[m])} ${y}`, 14, 16);
    const block = async (title: string, kind: PhotoKind, top: number, h: number): Promise<void> => {
      const views = ANGLES[kind];
      const w = views.length === 3 ? 58 : 89;
      const gap = views.length === 3 ? 4 : 4;
      bar(14, top - 4.6, kind === 'cuerpo' ? C1 : [225, 29, 72]);
      d.setFont('helvetica', 'bold');
      d.setFontSize(11);
      d.setTextColor(...INK);
      d.text(title, 19, top);
      for (let i = 0; i < views.length; i++) {
        const x = 14 + i * (w + gap);
        const p = pick(kind, views[i].id, month);
        const col = colOf(kind, views[i].id);
        await put(p, x, top + 9, w, h, mix([255, 255, 255], col, 0.35));
        d.setFont('helvetica', 'bold');
        d.setFontSize(8);
        d.setTextColor(...col);
        d.text(views[i].label, x + w / 2 - (p ? 5 : 0), top + h + 13, { align: 'center' });
        if (p) {
          d.setFont('helvetica', 'normal');
          d.setTextColor(...GRAYC);
          d.text(` · ${fmt(p.ts)}`, x + w / 2 + 4.5, top + h + 13);
        }
        // Solo en el cuerpo: peso y medidas de ese mismo día debajo de la foto.
        if (kind === 'cuerpo' && p) {
          const lines = measureLines(measureOnDay(measurements, p.ts));
          d.setFillColor(248, 250, 252);
          d.roundedRect(x, top + h + 15, w, Math.max(5.5, lines.length * 3.6 + 2), 1.5, 1.5, 'F');
          d.setFont('helvetica', 'normal');
          d.setFontSize(7);
          d.setTextColor(...GRAYC);
          if (lines.length === 0) d.text('Sin medidas ese día', x + w / 2, top + h + 17.5, { align: 'center' });
          lines.forEach((ln, k) => d.text(ln, x + w / 2, top + h + 17.5 + k * 3.6, { align: 'center' }));
        }
      }
    };
    await block('Cuerpo', 'cuerpo', 30, 78);
    await block('Cara', 'cara', 146, 78);
    const ms = measurements.filter((m2) => key(m2.ts) === month).sort((p, q) => q.ts - p.ts)[0];
    if (ms) {
      const parts = ([['Peso', ms.weight, 'kg'], ['Cintura', ms.waist, 'cm'], ['Cadera', ms.hip, 'cm'], ['Muslo', ms.thigh, 'cm'], ['Brazo', ms.arm, 'cm'], ['Pecho', ms.chest, 'cm']] as const).filter(([, v]) => v !== undefined).map(([l, v, u]) => `${l}: ${v} ${u}`);
      if (parts.length) {
        d.setFillColor(241, 245, 249);
        d.roundedRect(14, 272, 182, 9, 3, 3, 'F');
        d.setFont('helvetica', 'normal');
        d.setFontSize(9);
        d.setTextColor(...INK);
        d.text(parts.join('   ·   '), 105, 277.7, { align: 'center' });
      }
    }
  }

  // ---------- Vista del año: una hoja por ángulo ----------
  for (const sec of sections) {
    const col = colOf(sec.kind, sec.a.id);
    for (let from = 0; from < sec.cells.length; from += PER_PAGE) {
      d.addPage();
      const title = cap(sec.a.long);
      for (let i = 0; i < 29; i += 1) {
        d.setFillColor(...mix(col, mix(col, [255, 255, 255], 0.35), i / 28));
        d.rect(0, i, 210, 1.2, 'F');
      }
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.setFontSize(18);
      d.text(from === 0 ? `Año · ${title}` : `Año · ${title} (continuación)`, 14, 17);
      d.setFont('helvetica', 'normal');
      d.setFontSize(9);
      d.text('Primera foto de cada mes, de la más antigua a la más reciente.', 14, 24);
      const page = sec.cells.slice(from, from + PER_PAGE);
      for (let i = 0; i < page.length; i++) {
        const x = 14 + (i % COLS) * (CW + GAP);
        const y = 33 + Math.floor(i / COLS) * (CH + 21);
        await put(page[i].p, x, y, CW, CH, mix([255, 255, 255], col, 0.35));
        const [yy, mm] = page[i].month.split('-').map(Number);
        d.setFillColor(...col);
        d.roundedRect(x + 8, y + CH + 1.4, CW - 16, 4.6, 2.3, 2.3, 'F');
        d.setFont('helvetica', 'bold');
        d.setFontSize(7.5);
        d.setTextColor(255, 255, 255);
        d.text(`${MONTHS[mm].slice(0, 3)} ${String(yy).slice(2)}`, x + CW / 2, y + CH + 4.6, { align: 'center' });
        if (sec.kind === 'cuerpo') {
          const lines = measureLines(measureOnDay(measurements, page[i].p.ts));
          d.setFont('helvetica', 'normal');
          d.setFontSize(5.5);
          d.setTextColor(...GRAYC);
          if (lines.length === 0) d.text('Sin medidas ese día', x + CW / 2, y + CH + 9, { align: 'center' });
          lines.forEach((ln, k) => d.text(ln, x + CW / 2, y + CH + 9 + k * 2.8, { align: 'center' }));
        }
      }
    }
  }

  // ---------- Resumen del año ----------
  {
    const rows = yearSummary(measurements, first.ts, last.ts);
    d.addPage();
    band(30);
    d.setTextColor(255, 255, 255);
    d.setFont('helvetica', 'bold');
    d.setFontSize(20);
    d.text('Resumen del año', 14, 17);
    d.setFont('helvetica', 'normal');
    d.setFontSize(9);
    d.text(`De ${fmt(first.ts)} ${new Date(first.ts).getFullYear()} a ${fmt(last.ts)} ${new Date(last.ts).getFullYear()} · primera y última medida de cada mes`, 14, 25);
    if (rows.length === 0) {
      d.setFontSize(11);
      d.setTextColor(...INK);
      d.text('Aún no hay medidas de al menos dos meses para calcular tu evolución.', 14, 48);
    } else {
      const sign = (n: number): string => `${n > 0 ? '+' : ''}${num1(n)}`;
      rows.forEach((r, i) => {
        const y = 40 + i * 24;
        const better = r.lowerIsBetter ? r.change < 0 : r.change > 0;
        const tone: RGB = r.change === 0 ? [148, 163, 184] : better ? [5, 150, 105] : [217, 119, 6];
        d.setFillColor(248, 250, 252);
        d.roundedRect(14, y, 182, 20, 3, 3, 'F');
        d.setFillColor(...tone);
        d.roundedRect(14, y, 3, 20, 1.5, 1.5, 'F');
        d.setFont('helvetica', 'bold');
        d.setFontSize(12);
        d.setTextColor(...INK);
        d.text(r.label, 22, y + 8);
        d.setFont('helvetica', 'normal');
        d.setFontSize(8.5);
        d.setTextColor(...GRAYC);
        d.text(`${num1(r.first)} a ${num1(r.last)} ${r.unit}`, 22, y + 14.5);
        // Barras: al empezar (gris) y ahora (color), a la misma escala.
        const mx = Math.max(r.first, r.last);
        const bw = 62;
        d.setFillColor(203, 213, 225);
        d.roundedRect(70, y + 4.5, (bw * r.first) / mx, 4, 2, 2, 'F');
        d.setFillColor(...tone);
        d.roundedRect(70, y + 11, (bw * r.last) / mx, 4, 2, 2, 'F');
        d.setFontSize(6.5);
        d.setTextColor(...GRAYC);
        d.text('antes', 134, y + 8);
        d.text('ahora', 134, y + 14.5);
        d.setFillColor(...tone);
        d.roundedRect(150, y + 4, 40, 8.5, 4.2, 4.2, 'F');
        d.setFont('helvetica', 'bold');
        d.setFontSize(10);
        d.setTextColor(255, 255, 255);
        d.text(`${sign(r.change)} ${r.unit}`, 170, y + 9.8, { align: 'center' });
        d.setFont('helvetica', 'normal');
        d.setFontSize(7.5);
        d.setTextColor(...GRAYC);
        d.text(`${sign(r.perMonth)} ${r.unit} al mes`, 170, y + 16.5, { align: 'center' });
      });
      d.setFont('helvetica', 'normal');
      d.setFontSize(8);
      d.setTextColor(...GRAYC);
      if (goal) drawGoalBox(d, 14, 40 + rows.length * 24 + 12, 182, goal);
      d.text('Verde: bajar peso, cintura o cadera. Ámbar: cambio en sentido contrario. En muslo, brazo y pecho verde = aumento; interprétalo según tu objetivo.', 14, 40 + rows.length * 24 + 4);
    }
  }

  const pages = d.getNumberOfPages();
  for (let p = 2; p <= pages; p++) {
    d.setPage(p);
    d.setFont('helvetica', 'normal');
    d.setFontSize(7);
    d.setTextColor(100, 116, 139);
    d.text(`Página ${p} de ${pages}`, 196, 290, { align: 'right' });
  }

  const name = `mi-proceso-${new Date().toISOString().slice(0, 10)}.pdf`;
  const file = new File([d.output('blob')], name, { type: 'application/pdf' });
  await onFile?.(file);
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Mi proceso' });
      return true;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
  }
  d.save(name);
  return true;
}
