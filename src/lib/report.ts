import { epley } from './exercises';
import { dayBalance } from './metabolic';
import type { AppState } from './types';
import { drawGoalBox, goalSummary } from './goalSummary';
import { weekStart } from './streaks';
import { dayKey, fmtDuration } from './utils';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const BLUE: [number, number, number] = [37, 99, 235];
const GREEN: [number, number, number] = [5, 150, 105];
const ORANGE: [number, number, number] = [234, 88, 12];
const GRAY: [number, number, number] = [100, 116, 139];
const INK: [number, number, number] = [15, 23, 42];

interface Doc {
  setFont: (f: string, s?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (w: number) => void;
  text: (t: string | string[], x: number, y: number, o?: { align?: 'left' | 'center' | 'right' }) => void;
  getTextWidth: (t: string) => number;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string) => void;
  circle: (x: number, y: number, r: number, style?: string) => void;
  addPage: () => void;
  getNumberOfPages: () => number;
  setPage: (n: number) => void;
  output: (t: 'blob') => Blob;
  save: (name: string) => void;
}

const num = (n: number): string => n.toLocaleString('es-ES');

function kpi(d: Doc, x: number, y: number, w: number, label: string, value: string, color = INK): void {
  d.setFillColor(241, 245, 249);
  d.roundedRect(x, y, w, 19, 2, 2, 'F');
  d.setFont('helvetica', 'bold');
  d.setFontSize(14);
  d.setTextColor(...color);
  d.text(value, x + w / 2, y + 9, { align: 'center' });
  d.setFont('helvetica', 'normal');
  d.setFontSize(7.5);
  d.setTextColor(...GRAY);
  d.text(label.toUpperCase(), x + w / 2, y + 15, { align: 'center' });
}

function lineChart(d: Doc, x: number, y: number, w: number, h: number, title: string, unit: string, pts: { label: string; v: number }[], color = BLUE): void {
  d.setFont('helvetica', 'bold');
  d.setFontSize(9);
  d.setTextColor(...INK);
  d.text(title, x, y);
  const top = y + 3;
  d.setDrawColor(226, 232, 240);
  d.setLineWidth(0.2);
  d.rect(x, top, w, h);
  if (pts.length < 2) {
    d.setFont('helvetica', 'italic');
    d.setFontSize(8);
    d.setTextColor(...GRAY);
    d.text('Sin datos suficientes este mes', x + w / 2, top + h / 2, { align: 'center' });
    return;
  }
  const vals = pts.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const px = (i: number) => x + 6 + (i / (pts.length - 1)) * (w - 12);
  const py = (v: number) => top + h - 6 - ((v - min) / span) * (h - 14);
  d.setDrawColor(...color);
  d.setLineWidth(0.7);
  for (let i = 1; i < pts.length; i++) d.line(px(i - 1), py(pts[i - 1].v), px(i), py(pts[i].v));
  d.setFillColor(...color);
  pts.forEach((p, i) => d.circle(px(i), py(p.v), 0.9, 'F'));
  d.setFont('helvetica', 'normal');
  d.setFontSize(7);
  d.setTextColor(...GRAY);
  d.text(`${max} ${unit}`, x + 1.5, top + 4);
  d.text(`${min} ${unit}`, x + 1.5, top + h - 1.5);
  d.text(pts[0].label, x + 6, top + h + 3.5);
  d.text(pts[pts.length - 1].label, x + w - 6, top + h + 3.5, { align: 'right' });
  const delta = Math.round((vals[vals.length - 1] - vals[0]) * 10) / 10;
  d.setFont('helvetica', 'bold');
  d.setTextColor(...(delta <= 0 && unit === 'cm' ? GREEN : INK));
  d.text(`${delta > 0 ? '+' : ''}${delta} ${unit}`, x + w - 2, y, { align: 'right' });
}

function barChart(d: Doc, x: number, y: number, w: number, h: number, title: string, bars: { label: string; v: number }[], color = ORANGE): void {
  d.setFont('helvetica', 'bold');
  d.setFontSize(9);
  d.setTextColor(...INK);
  d.text(title, x, y);
  const top = y + 3;
  d.setDrawColor(226, 232, 240);
  d.setLineWidth(0.2);
  d.rect(x, top, w, h);
  const max = Math.max(...bars.map((b) => b.v), 1);
  const bw = (w - 8) / bars.length;
  bars.forEach((b, i) => {
    const bh = ((h - 10) * b.v) / max;
    d.setFillColor(...color);
    d.rect(x + 4 + i * bw + bw * 0.15, top + h - 6 - bh, bw * 0.7, bh, 'F');
    d.setFont('helvetica', 'normal');
    d.setFontSize(7);
    d.setTextColor(...GRAY);
    d.text(b.label, x + 4 + i * bw + bw / 2, top + h - 2, { align: 'center' });
    if (b.v > 0) d.text(num(b.v), x + 4 + i * bw + bw / 2, top + h - 7 - bh, { align: 'center' });
  });
}

/**
 * Informe mensual en PDF (se genera en el dispositivo; la librería se carga solo al pulsar el botón).
 * No incluye datos del ciclo menstrual.
 */
export async function downloadMonthlyReport(s: AppState, year: number, month: number, onFile?: (f: File) => void | Promise<void>): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'mm', format: 'a4' }) as unknown as Doc;
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const title = `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}`;

  const ws = s.workouts.filter((w) => Date.parse(w.startTime) >= start && Date.parse(w.startTime) < end).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const volume = ws.reduce((a, w) => a + w.totalVolumeKg, 0);
  const burned = ws.reduce((a, w) => a + w.caloriesBurned, 0);
  const sets = ws.reduce((a, w) => a + w.totalSets, 0);
  const prs = ws.reduce((a, w) => a + w.prsAchieved, 0);
  const trained = new Set(ws.map((w) => dayKey(Date.parse(w.startTime)))).size;

  const keys = Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(year, month, i + 1, 12).getTime()));
  const logged = keys.filter((k) => s.meals.some((m) => dayKey(m.ts) === k));
  const bal = logged.map((k) => ({ k, b: dayBalance(s, k) }));
  const avgEaten = bal.length ? Math.round(bal.reduce((a, x) => a + x.b.eaten, 0) / bal.length) : 0;
  const avgTarget = bal.length ? Math.round(bal.reduce((a, x) => a + x.b.target, 0) / bal.length) : 0;
  const avgProt = bal.length ? Math.round(bal.reduce((a, x) => a + x.b.proteinEaten, 0) / bal.length) : 0;
  const protTarget = bal[0]?.b.proteinTarget ?? dayBalance(s).proteinTarget;

  const ms = s.measurements.filter((m) => m.ts >= start && m.ts < end).sort((a, b) => a.ts - b.ts);
  const label = (ts: number) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const waistPts = ms.filter((m) => m.waist).map((m) => ({ label: label(m.ts), v: m.waist as number }));
  const bellyPts = ms.filter((m) => m.belly).map((m) => ({ label: label(m.ts), v: m.belly as number }));
  const weightPts = ms.filter((m) => m.weight).map((m) => ({ label: label(m.ts), v: m.weight as number }));

  // Volumen por semana del mes
  const weeks = Math.ceil(daysInMonth / 7);
  const weekBars = Array.from({ length: weeks }, (_, i) => ({ label: `Sem ${i + 1}`, v: 0 }));
  ws.forEach((w) => {
    const day = new Date(w.startTime).getDate();
    weekBars[Math.min(weeks - 1, Math.floor((day - 1) / 7))].v += Math.round(w.totalVolumeKg);
  });

  // Cabecera
  d.setFillColor(...BLUE);
  d.rect(0, 0, 210, 30, 'F');
  d.setTextColor(255, 255, 255);
  d.setFont('helvetica', 'bold');
  d.setFontSize(20);
  d.text('Informe mensual', 14, 15);
  d.setFont('helvetica', 'normal');
  d.setFontSize(11);
  d.text(`${title} · Apex Coach`, 14, 23);
  d.setFontSize(9);
  d.text(`Objetivo: recomposición (menos grasa abdominal, más tono) · ${s.profile.weight} kg`, 196, 23, { align: 'right' });

  // KPIs
  const kw = 43.5;
  const items: [string, string, [number, number, number]][] = [
    ['Entrenos', `${ws.length}`, BLUE],
    ['Días entrenados', `${trained}`, BLUE],
    ['Volumen (kg)', num(Math.round(volume)), INK],
    ['Series', num(sets), INK],
    ['kcal quemadas', num(Math.round(burned)), ORANGE],
    ['PRs', `${prs}`, [245, 158, 11]],
    ['kcal medias / meta', bal.length ? `${num(avgEaten)} / ${num(avgTarget)}` : '-', GREEN],
    ['Proteína media (g)', bal.length ? `${avgProt} / ${protTarget}` : '-', GREEN],
  ];
  items.forEach(([l, v, c], i) => kpi(d, 14 + (i % 4) * (kw + 2.5), 38 + Math.floor(i / 4) * 22, kw, l, v, c));

  // Gráficas
  lineChart(d, 14, 88, 58, 34, 'Cintura', 'cm', waistPts, GREEN);
  lineChart(d, 76, 88, 58, 34, 'Barriga baja', 'cm', bellyPts, ORANGE);
  lineChart(d, 138, 88, 58, 34, 'Peso', 'kg', weightPts, BLUE);
  barChart(d, 14, 134, 88, 36, 'Volumen por semana (kg)', weekBars);
  lineChart(d, 108, 134, 88, 36, 'Calorías diarias comidas', 'kcal', bal.map((x) => ({ label: x.k.slice(8) + '/' + x.k.slice(5, 7), v: x.b.eaten })), ORANGE);

  // ¿Se cumplen los objetivos? (texto breve) y lectura del mes
  const boxH = drawGoalBox(d, 14, 178, 182, goalSummary(s, start, end - 1));
  const ly = 178 + boxH + 9;
  d.setFont('helvetica', 'bold');
  d.setFontSize(10);
  d.setTextColor(...INK);
  d.text('Lectura del mes', 14, ly);
  d.setFont('helvetica', 'normal');
  d.setFontSize(9);
  d.setTextColor(...GRAY);
  const wd = waistPts.length >= 2 ? Math.round((waistPts[waistPts.length - 1].v - waistPts[0].v) * 10) / 10 : null;
  const gd = weightPts.length >= 2 ? Math.round((weightPts[weightPts.length - 1].v - weightPts[0].v) * 10) / 10 : null;
  const lines: string[] = [];
  if (wd !== null) lines.push(`Cintura: ${wd > 0 ? '+' : ''}${wd} cm` + (gd !== null ? ` con ${gd > 0 ? '+' : ''}${gd} kg de peso.` : '.') + (wd <= -0.5 && (gd ?? 0) >= -0.5 ? ' Señal de recomposición: menos grasa abdominal sin perder masa.' : ''));
  else lines.push('Registra tu cintura cada semana para ver la evolución de la grasa abdominal.');
  const bd = bellyPts.length >= 2 ? Math.round((bellyPts[bellyPts.length - 1].v - bellyPts[0].v) * 10) / 10 : null;
  if (bd !== null) lines.push(`Barriga baja: ${bd > 0 ? '+' : ''}${bd} cm` + (bd <= -0.5 ? ' (va en la dirección buena).' : bd >= 0.5 ? ' (sube: conviene vigilarla).' : ' (estable).'));
  else lines.push('Mide tu barriga baja (unos 4 cm bajo el ombligo) para seguir la zona que más quieres reducir.');
  lines.push(`Entrenaste ${trained} día${trained === 1 ? '' : 's'} (objetivo: ${s.settings.weeklyGoal} por semana). ${prs} récord${prs === 1 ? '' : 's'} personal${prs === 1 ? '' : 'es'}.`);
  if (bal.length) lines.push(`Nutrición registrada ${bal.length} de ${daysInMonth} días: media de ${num(avgEaten)} kcal (meta ${num(avgTarget)}) y ${avgProt} g de proteína (meta ${protTarget}).`);
  let y = ly + 6;
  lines.forEach((l) => {
    d.text(l, 14, y);
    y += 5.5;
  });

  // Tabla de entrenos
  y += 4;
  const header = (yy: number) => {
    d.setFillColor(241, 245, 249);
    d.rect(14, yy - 4.5, 182, 6.5, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(8);
    d.setTextColor(...INK);
    ['Fecha', 'Entreno', 'Dónde', 'Duración', 'Volumen', 'kcal', 'PRs'].forEach((h, i) => d.text(h, [16, 38, 100, 124, 146, 170, 188][i], yy, { align: i >= 4 ? 'right' : 'left' }));
  };
  d.setFont('helvetica', 'bold');
  d.setFontSize(10);
  d.setTextColor(...INK);
  d.text('Entrenos del mes', 14, y);
  y += 7;
  header(y);
  y += 6;
  d.setFont('helvetica', 'normal');
  d.setFontSize(8);
  ws.forEach((w) => {
    if (y > 280) {
      d.addPage();
      y = 20;
      header(y);
      y += 6;
      d.setFont('helvetica', 'normal');
      d.setFontSize(8);
    }
    d.setTextColor(...INK);
    const cells = [label(Date.parse(w.startTime)), w.title.slice(0, 32), (w.location ?? 'gym') === 'home' ? 'Casa' : 'Gimnasio', fmtDuration(w.durationSeconds), `${num(Math.round(w.totalVolumeKg))} kg`, `${w.caloriesBurned}`, `${w.prsAchieved}`];
    cells.forEach((c, i) => d.text(c, [16, 38, 100, 124, 146, 170, 188][i], y, { align: i >= 4 ? 'right' : 'left' }));
    y += 5.2;
  });
  if (ws.length === 0) {
    d.setTextColor(...GRAY);
    d.text('Sin entrenos registrados este mes.', 16, y);
    y += 6;
  }

  // Mejores marcas del mes
  const best = new Map<string, { name: string; e1: number; w: number; r: number }>();
  ws.forEach((w) => w.exercises.forEach((e) => e.sets.forEach((st) => {
    if (st.type === 'warmup' || st.weight <= 0 || st.reps <= 0) return;
    const e1 = epley(st.weight, st.reps);
    const cur = best.get(e.exerciseId);
    if (!cur || e1 > cur.e1) best.set(e.exerciseId, { name: e.name, e1, w: st.weight, r: st.reps });
  })));
  const top = [...best.values()].sort((a, b) => b.e1 - a.e1).slice(0, 8);
  if (top.length) {
    y += 6;
    if (y > 255) {
      d.addPage();
      y = 20;
    }
    d.setFont('helvetica', 'bold');
    d.setFontSize(10);
    d.setTextColor(...INK);
    d.text('Mejores marcas del mes (1RM estimado)', 14, y);
    y += 6;
    d.setFont('helvetica', 'normal');
    d.setFontSize(8.5);
    top.forEach((t) => {
      d.setTextColor(...INK);
      d.text(t.name.slice(0, 48), 16, y);
      d.setTextColor(...GRAY);
      d.text(`${t.w} kg x ${t.r}  ·  1RM est. ${t.e1} kg`, 196, y, { align: 'right' });
      y += 5.2;
    });
  }

  // Pie y numeración
  const pages = d.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    d.setPage(p);
    d.setFont('helvetica', 'normal');
    d.setFontSize(7);
    d.setTextColor(...GRAY);
    d.text('Estimaciones calculadas por la app a partir de tus registros; no sustituyen el consejo de un profesional.', 14, 290);
    d.text(`Página ${p} de ${pages}`, 196, 290, { align: 'right' });
  }

  const name = `informe-${year}-${String(month + 1).padStart(2, '0')}.pdf`;
  const file = new File([d.output('blob')], name, { type: 'application/pdf' });
  await onFile?.(file);
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Informe ${title}` });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
  }
  d.save(name);
}

/** Primera y última marca (1RM estimado) de cada ejercicio en un periodo: sirve para ver cuánto has subido en el año. */
export const liftProgress = (ws: AppState['workouts']): { name: string; from: number; to: number; pct: number }[] => {
  const per = new Map<string, { name: string; first: number; best: number }>();
  const sorted = [...ws].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  for (const w of sorted) {
    const top = new Map<string, { name: string; e1: number }>();
    for (const e of w.exercises) {
      for (const st of e.sets) {
        if (st.type === 'warmup' || st.weight <= 0 || st.reps <= 0) continue;
        const v = epley(st.weight, st.reps);
        if (v > (top.get(e.exerciseId)?.e1 ?? 0)) top.set(e.exerciseId, { name: e.name, e1: v });
      }
    }
    for (const [id, t] of top) {
      const cur = per.get(id);
      if (!cur) per.set(id, { name: t.name, first: t.e1, best: t.e1 });
      else cur.best = Math.max(cur.best, t.e1);
    }
  }
  return [...per.values()]
    .filter((p) => p.first > 0 && p.best > p.first)
    .map((p) => ({ name: p.name, from: p.first, to: p.best, pct: Math.round(((p.best - p.first) / p.first) * 100) }))
    .sort((a, b) => b.pct - a.pct);
};

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];

/** Anillo de progreso (jsPDF no dibuja arcos: se hace con tramos cortos y gruesos). */
function donut(d: Doc, cx: number, cy: number, r: number, pct: number, color: RGB, big: string, small: string): void {
  const N = 90;
  d.setLineWidth(3.4);
  d.setDrawColor(226, 232, 240);
  for (let i = 0; i < N; i++) {
    const a1 = (i / N) * 2 * Math.PI - Math.PI / 2;
    const a2 = ((i + 1.2) / N) * 2 * Math.PI - Math.PI / 2;
    d.line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2));
  }
  d.setDrawColor(...color);
  const upto = Math.round(N * Math.max(0, Math.min(1, pct)));
  for (let i = 0; i < upto; i++) {
    const a1 = (i / N) * 2 * Math.PI - Math.PI / 2;
    const a2 = ((i + 1.2) / N) * 2 * Math.PI - Math.PI / 2;
    d.line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2));
  }
  d.setFont('helvetica', 'bold');
  d.setFontSize(15);
  d.setTextColor(...INK);
  d.text(big, cx, cy + 2, { align: 'center' });
  d.setFont('helvetica', 'normal');
  d.setFontSize(7.5);
  d.setTextColor(...GRAY);
  d.text(small, cx, cy + r + 8, { align: 'center' });
}

/** Gráfica de área: línea con relleno suave debajo (se rellena con líneas verticales finas). */
function areaChart(d: Doc, x: number, y: number, w: number, h: number, title: string, unit: string, pts: { label: string; v: number }[], color: RGB): void {
  d.setFont('helvetica', 'bold');
  d.setFontSize(10);
  d.setTextColor(...INK);
  d.text(title, x, y);
  const top = y + 4;
  d.setFillColor(248, 250, 252);
  d.roundedRect(x, top, w, h, 2, 2, 'F');
  if (pts.length < 2) {
    d.setFont('helvetica', 'italic');
    d.setFontSize(8);
    d.setTextColor(...GRAY);
    d.text('Sin datos suficientes', x + w / 2, top + h / 2, { align: 'center' });
    return;
  }
  const vals = pts.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const px = (i: number) => x + 8 + (i / (pts.length - 1)) * (w - 16);
  const py = (v: number) => top + h - 9 - ((v - min) / span) * (h - 22);
  const base = top + h - 7;
  const fill = mix([255, 255, 255], color, 0.18);
  d.setDrawColor(...fill);
  d.setLineWidth(0.7);
  for (let X = px(0); X <= px(pts.length - 1); X += 0.7) {
    const t = ((X - px(0)) / (px(pts.length - 1) - px(0))) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(t));
    const yy = py(vals[i] + (vals[i + 1] - vals[i]) * (t - i));
    d.line(X, yy, X, base);
  }
  d.setDrawColor(...color);
  d.setLineWidth(1);
  for (let i = 1; i < pts.length; i++) d.line(px(i - 1), py(vals[i - 1]), px(i), py(vals[i]));
  d.setFillColor(255, 255, 255);
  d.setLineWidth(0.8);
  pts.forEach((_, i) => d.circle(px(i), py(vals[i]), 1.1, 'FD'));
  d.setFont('helvetica', 'normal');
  d.setFontSize(7);
  d.setTextColor(...GRAY);
  d.text(pts[0].label, px(0), top + h - 2, { align: 'center' });
  d.text(pts[pts.length - 1].label, px(pts.length - 1), top + h - 2, { align: 'center' });
  d.setFont('helvetica', 'bold');
  d.setTextColor(...INK);
  d.text(`${vals[0]}`, px(0), py(vals[0]) - 2.5, { align: 'center' });
  d.text(`${vals[vals.length - 1]}`, px(pts.length - 1), py(vals[vals.length - 1]) - 2.5, { align: 'center' });
  const delta = Math.round((vals[vals.length - 1] - vals[0]) * 10) / 10;
  d.setFillColor(...(delta <= 0 ? GREEN : ORANGE));
  d.roundedRect(x + w - 24, y - 4.5, 24, 6.5, 3, 3, 'F');
  d.setTextColor(255, 255, 255);
  d.setFontSize(8);
  d.text(`${delta > 0 ? '+' : ''}${String(delta).replace('.', ',')} ${unit}`, x + w - 12, y - 0.2, { align: 'center' });
}

/** Barras mensuales con color según la altura y el valor encima. */
function monthBars(d: Doc, x: number, y: number, w: number, h: number, title: string, vals: number[], labels: string[], lo: RGB, hi: RGB, fmtV: (n: number) => string): void {
  d.setFont('helvetica', 'bold');
  d.setFontSize(10);
  d.setTextColor(...INK);
  d.text(title, x, y);
  const top = y + 4;
  d.setFillColor(248, 250, 252);
  d.roundedRect(x, top, w, h, 2, 2, 'F');
  const max = Math.max(...vals, 1);
  const bw = (w - 8) / vals.length;
  vals.forEach((v, i) => {
    const bh = ((h - 16) * v) / max;
    d.setFillColor(...mix(lo, hi, v / max));
    if (bh > 0.6) d.roundedRect(x + 4 + i * bw + bw * 0.14, top + h - 8 - bh, bw * 0.72, bh, 1, 1, 'F');
    d.setFont('helvetica', 'normal');
    d.setFontSize(6.5);
    d.setTextColor(...GRAY);
    d.text(labels[i], x + 4 + i * bw + bw / 2, top + h - 3, { align: 'center' });
    if (v > 0) {
      d.setTextColor(...INK);
      d.text(fmtV(v), x + 4 + i * bw + bw / 2, top + h - 9.5 - bh, { align: 'center' });
    }
  });
}

/** Barras horizontales etiquetadas. */
function hBars(d: Doc, x: number, y: number, w: number, rows: { label: string; v: number; right: string; color: RGB }[]): number {
  const max = Math.max(...rows.map((r) => r.v), 1);
  rows.forEach((r, i) => {
    const yy = y + i * 9;
    d.setFont('helvetica', 'normal');
    d.setFontSize(8.5);
    d.setTextColor(...INK);
    d.text(r.label.slice(0, 30), x, yy);
    d.setFillColor(241, 245, 249);
    d.roundedRect(x + 52, yy - 3.6, w - 52 - 34, 4.6, 2.3, 2.3, 'F');
    d.setFillColor(...r.color);
    d.roundedRect(x + 52, yy - 3.6, Math.max(3, ((w - 52 - 34) * r.v) / max), 4.6, 2.3, 2.3, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(8);
    d.setTextColor(...INK);
    d.text(r.right, x + w, yy, { align: 'right' });
  });
  return y + rows.length * 9;
}

const sectionTitle = (d: Doc, y: number, title: string, color: RGB = BLUE): void => {
  d.setFillColor(...color);
  d.roundedRect(14, y - 4.5, 2.4, 6, 1, 1, 'F');
  d.setFont('helvetica', 'bold');
  d.setFontSize(12);
  d.setTextColor(...INK);
  d.text(title, 19, y);
};

/**
 * Informe anual en PDF, visual: portada con cifras grandes, mapa de constancia del año (un cuadro por día), anillos de objetivos,
 * gráficas de área de peso y cintura, barras mensuales de color, fuerza ganada y reparto del trabajo por músculo, y la tabla mes a mes.
 * Se genera en el dispositivo; sin datos del ciclo.
 */
export async function downloadYearlyReport(s: AppState, year: number, onFile?: (f: File) => void | Promise<void>): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'mm', format: 'a4' }) as unknown as Doc;
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const nowTs = Date.now();
  const lastDay = year === new Date(nowTs).getFullYear() ? nowTs : end - 1;
  const ws = s.workouts.filter((w) => Date.parse(w.startTime) >= start && Date.parse(w.startTime) < end);
  const monthOf = (ts: number) => new Date(ts).getMonth();
  const MS3 = MONTHS.map((m) => m.slice(0, 3));
  const perDay = new Map<string, number>();
  for (const w of ws) perDay.set(dayKey(Date.parse(w.startTime)), (perDay.get(dayKey(Date.parse(w.startTime))) ?? 0) + 1);

  const perMonth = Array.from({ length: 12 }, (_, m) => {
    const w = ws.filter((x) => monthOf(Date.parse(x.startTime)) === m);
    const days = new Set(w.map((x) => dayKey(Date.parse(x.startTime)))).size;
    const nDays = new Date(year, m + 1, 0).getDate();
    const keys = Array.from({ length: nDays }, (_, i) => dayKey(new Date(year, m, i + 1, 12).getTime()));
    const logged = keys.filter((k) => s.meals.some((x) => dayKey(x.ts) === k));
    const bal = logged.map((k) => dayBalance(s, k));
    const mean = (f: (b: ReturnType<typeof dayBalance>) => number) => (bal.length ? Math.round(bal.reduce((a, b) => a + f(b), 0) / bal.length) : 0);
    const ms = s.measurements.filter((x) => x.ts >= new Date(year, m, 1).getTime() && x.ts < new Date(year, m + 1, 1).getTime()).sort((a, b) => a.ts - b.ts);
    const lastOf = (f: 'weight' | 'waist' | 'belly') => [...ms].reverse().find((x) => (x[f] ?? 0) > 0)?.[f];
    return {
      n: w.length,
      days,
      volume: Math.round(w.reduce((a, x) => a + x.totalVolumeKg, 0)),
      burned: Math.round(w.reduce((a, x) => a + x.caloriesBurned, 0)),
      prs: w.reduce((a, x) => a + x.prsAchieved, 0),
      kcal: mean((b) => b.eaten),
      prot: mean((b) => b.proteinEaten),
      protOk: bal.filter((b) => b.proteinEaten >= b.proteinTarget).length,
      loggedDays: logged.length,
      weight: lastOf('weight'),
      waist: lastOf('waist'),
      belly: lastOf('belly'),
    };
  });
  const total = (f: (m: (typeof perMonth)[number]) => number) => perMonth.reduce((a, m) => a + f(m), 0);
  const trainedDays = total((m) => m.days);
  const loggedDays = total((m) => m.loggedDays);
  const protOk = total((m) => m.protOk);
  const byWeek = new Map<number, Set<string>>();
  for (const w of ws) {
    const k = weekStart(Date.parse(w.startTime));
    byWeek.set(k, (byWeek.get(k) ?? new Set()).add(dayKey(Date.parse(w.startTime))));
  }
  const goal = s.settings.weeklyGoal;
  const goodWeeks = [...byWeek.values()].filter((v) => v.size >= goal).length;
  const weeksElapsed = Math.max(1, Math.ceil((lastDay - start) / (7 * 86400000)));
  const daysElapsed = Math.max(1, Math.ceil((lastDay - start) / 86400000));
  const volume = total((m) => m.volume);

  // ---------- Página 1: portada y constancia ----------
  const C1: RGB = [30, 64, 175];
  const C2: RGB = [14, 165, 233];
  for (let i = 0; i < 48; i++) {
    d.setFillColor(...mix(C1, C2, i / 47));
    d.rect(0, i, 210, 1.1, 'F');
  }
  d.setTextColor(255, 255, 255);
  d.setFont('helvetica', 'bold');
  d.setFontSize(34);
  d.text(`Mi año ${year}`, 14, 24);
  d.setFont('helvetica', 'normal');
  d.setFontSize(11);
  d.text(`Informe de entreno y progreso · Apex Coach`, 14, 33);
  d.setFontSize(9);
  d.text(`Objetivo: recomposición · ${s.profile.weight} kg`, 14, 40);

  const cards: { label: string; value: string; sub: string; color: RGB }[] = [
    { label: 'Entrenos', value: `${ws.length}`, sub: `${(ws.length / weeksElapsed).toFixed(1).replace('.', ',')} por semana`, color: BLUE },
    { label: 'Días entrenados', value: `${trainedDays}`, sub: `${Math.round((trainedDays / daysElapsed) * 100)} % del año`, color: [14, 165, 233] },
    { label: 'Volumen levantado', value: `${(volume / 1000).toFixed(1).replace('.', ',')} t`, sub: `${num(volume)} kg`, color: [124, 58, 237] },
    { label: 'Calorías quemadas', value: num(total((m) => m.burned)), sub: 'kcal en sesiones', color: ORANGE },
  ];
  cards.forEach((c, i) => {
    const x = 14 + i * 46;
    d.setFillColor(255, 255, 255);
    d.setDrawColor(226, 232, 240);
    d.setLineWidth(0.3);
    d.roundedRect(x, 54, 43, 30, 3, 3, 'FD');
    d.setFillColor(...c.color);
    d.roundedRect(x, 54, 43, 3, 1.5, 1.5, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(17);
    d.setTextColor(...c.color);
    d.text(c.value, x + 21.5, 69, { align: 'center' });
    d.setFontSize(7.5);
    d.setTextColor(...INK);
    d.text(c.label.toUpperCase(), x + 21.5, 75, { align: 'center' });
    d.setFont('helvetica', 'normal');
    d.setTextColor(...GRAY);
    d.text(c.sub, x + 21.5, 80, { align: 'center' });
  });

  sectionTitle(d, 98, 'Tu constancia: un cuadro por día');
  const gridStart = weekStart(start);
  const cell = 3;
  const gap = 0.4;
  const weeks = Math.ceil((end - gridStart) / (7 * 86400000));
  const ramp: RGB[] = [[226, 232, 240], [147, 197, 253], [59, 130, 246], [29, 78, 216]];
  const gx = 15;
  const gy = 112;
  for (let wk = 0; wk < weeks; wk++) {
    for (let dow = 0; dow < 7; dow++) {
      const dt = new Date(gridStart);
      dt.setDate(dt.getDate() + wk * 7 + dow);
      if (dt.getTime() < start || dt.getTime() >= end) continue;
      const n = perDay.get(dayKey(dt.getTime() + 12 * 3600000)) ?? 0;
      const future = dt.getTime() > lastDay;
      const col: RGB = future ? [248, 250, 252] : ramp[Math.min(3, n)];
      d.setFillColor(...col);
      d.roundedRect(gx + wk * (cell + gap), gy + dow * (cell + gap), cell, cell, 0.6, 0.6, 'F');
    }
  }
  d.setFont('helvetica', 'normal');
  d.setFontSize(6.5);
  d.setTextColor(...GRAY);
  for (let m = 0; m < 12; m++) {
    const wk = Math.floor((new Date(year, m, 1).getTime() - gridStart) / (7 * 86400000));
    d.text(MS3[m], gx + wk * (cell + gap), gy - 2);
  }
  d.text('Menos', 15, gy + 7 * (cell + gap) + 5);
  ramp.forEach((c, i) => {
    d.setFillColor(...c);
    d.roundedRect(27 + i * 5, gy + 7 * (cell + gap) + 2.5, 3.6, 3.6, 0.6, 0.6, 'F');
  });
  d.text('Más', 49, gy + 7 * (cell + gap) + 5);

  sectionTitle(d, 150, 'Objetivos cumplidos', GREEN);
  donut(d, 38, 176, 15, Math.min(1, goodWeeks / weeksElapsed), GREEN, `${goodWeeks}/${weeksElapsed}`, `semanas con ${goal}+ días`);
  donut(d, 105, 176, 15, Math.min(1, loggedDays / daysElapsed), BLUE, `${Math.round((loggedDays / daysElapsed) * 100)} %`, 'días con comidas anotadas');
  donut(d, 172, 176, 15, loggedDays ? Math.min(1, protOk / loggedDays) : 0, ORANGE, loggedDays ? `${Math.round((protOk / loggedDays) * 100)} %` : '-', 'días con proteína en el mínimo');

  const top = liftProgress(ws)[0];
  d.setFillColor(254, 243, 199);
  d.roundedRect(14, 206, 182, 20, 3, 3, 'F');
  d.setFont('helvetica', 'bold');
  d.setFontSize(11);
  d.setTextColor(146, 64, 14);
  d.text(`${total((m) => m.prs)} récords personales este año`, 20, 215);
  d.setFont('helvetica', 'normal');
  d.setFontSize(9);
  d.text(top ? `Tu mayor salto: ${top.name} (+${top.pct} %, de ${num(top.from)} a ${num(top.to)} kg de 1RM estimado).` : 'Sigue registrando tus series para ver cuánto subes.', 20, 221);

  const goalH = drawGoalBox(d, 14, 230, 182, goalSummary(s, start, lastDay));

  // Destacados del año: mejor mes, mayor volumen y racha más larga de días seguidos.
  let streak = 0;
  let best = 0;
  for (let t = start; t <= lastDay; t += 86400000) {
    if (perDay.has(dayKey(t + 12 * 3600000))) best = Math.max(best, ++streak);
    else streak = 0;
  }
  const bestMonth = perMonth.reduce((bi, m, i) => (m.n > perMonth[bi].n ? i : bi), 0);
  const volMonth = perMonth.reduce((bi, m, i) => (m.volume > perMonth[bi].volume ? i : bi), 0);
  const hi: { label: string; value: string; sub: string; color: RGB }[] = [
    { label: 'Tu mejor mes', value: MONTHS[bestMonth][0].toUpperCase() + MONTHS[bestMonth].slice(1), sub: `${perMonth[bestMonth].n} entrenos`, color: BLUE },
    { label: 'Mes de más volumen', value: MONTHS[volMonth][0].toUpperCase() + MONTHS[volMonth].slice(1), sub: `${(perMonth[volMonth].volume / 1000).toFixed(1).replace('.', ',')} t levantadas`, color: [124, 58, 237] },
    { label: 'Racha más larga', value: `${best} día${best === 1 ? '' : 's'}`, sub: 'entrenando seguidos', color: ORANGE },
  ];
  const hy = Math.min(266, 230 + goalH + 5);
  hi.forEach((c, i) => {
    const x = 14 + i * 61;
    d.setFillColor(248, 250, 252);
    d.roundedRect(x, hy, 58, 22, 3, 3, 'F');
    d.setFillColor(...c.color);
    d.roundedRect(x, hy, 2.6, 22, 1.3, 1.3, 'F');
    d.setFont('helvetica', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(...GRAY);
    d.text(c.label.toUpperCase(), x + 7, hy + 6.5);
    d.setFont('helvetica', 'bold');
    d.setFontSize(13);
    d.setTextColor(...c.color);
    d.text(c.value, x + 7, hy + 14.5);
    d.setFont('helvetica', 'normal');
    d.setFontSize(8);
    d.setTextColor(...GRAY);
    d.text(c.sub, x + 7, hy + 19.5);
  });

  // ---------- Página 2: evolución ----------
  d.addPage();
  sectionTitle(d, 20, 'Tu evolución');
  areaChart(d, 14, 32, 182, 52, 'Peso (último de cada mes)', 'kg', perMonth.flatMap((m, i) => (m.weight ? [{ label: MS3[i], v: m.weight }] : [])), BLUE);
  areaChart(d, 14, 94, 88, 52, 'Cintura (última de cada mes)', 'cm', perMonth.flatMap((m, i) => (m.waist ? [{ label: MS3[i], v: m.waist }] : [])), GREEN);
  areaChart(d, 108, 94, 88, 52, 'Barriga baja (última de cada mes)', 'cm', perMonth.flatMap((m, i) => (m.belly ? [{ label: MS3[i], v: m.belly }] : [])), ORANGE);
  monthBars(d, 14, 158, 88, 46, 'Entrenos por mes', perMonth.map((m) => m.n), MS3, [147, 197, 253], [29, 78, 216], (n) => String(n));
  monthBars(d, 108, 158, 88, 46, 'Volumen por mes (t)', perMonth.map((m) => Math.round(m.volume / 100) / 10), MS3, [216, 180, 254], [109, 40, 217], (n) => String(n).replace('.', ','));
  areaChart(d, 14, 216, 88, 46, 'Calorías medias por mes', 'kcal', perMonth.flatMap((m, i) => (m.loggedDays ? [{ label: MS3[i], v: m.kcal }] : [])), ORANGE);
  areaChart(d, 108, 216, 88, 46, 'Proteína media por mes', 'g', perMonth.flatMap((m, i) => (m.loggedDays ? [{ label: MS3[i], v: m.prot }] : [])), GREEN);

  // ---------- Página 3: fuerza y reparto ----------
  d.addPage();
  sectionTitle(d, 20, 'Lo que más has subido en fuerza', GREEN);
  const gains = liftProgress(ws).slice(0, 8);
  let y = 32;
  if (gains.length === 0) {
    d.setFont('helvetica', 'normal');
    d.setFontSize(9);
    d.setTextColor(...GRAY);
    d.text('Aún no hay suficientes sesiones para comparar tus marcas.', 14, y);
    y += 8;
  } else {
    y = hBars(d, 14, y, 182, gains.map((g) => ({ label: g.name, v: g.pct, right: `+${g.pct} %  (${num(g.from)} a ${num(g.to)} kg)`, color: GREEN })));
  }
  y += 12;
  sectionTitle(d, y, 'Dónde has puesto el trabajo', [124, 58, 237]);
  const byMuscle = new Map<string, number>();
  for (const w of ws) for (const e of w.exercises) byMuscle.set(e.muscleGroup, (byMuscle.get(e.muscleGroup) ?? 0) + e.sets.filter((x) => x.type !== 'warmup').reduce((a, x) => a + x.weight * x.reps, 0));
  const muscles = [...byMuscle.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 9);
  const mTotal = muscles.reduce((a, [, v]) => a + v, 0) || 1;
  const PAL: RGB[] = [[37, 99, 235], [14, 165, 233], [5, 150, 105], [245, 158, 11], [234, 88, 12], [225, 29, 72], [124, 58, 237], [219, 39, 119], [100, 116, 139]];
  y += 10;
  if (muscles.length === 0) {
    d.setFont('helvetica', 'normal');
    d.setFontSize(9);
    d.setTextColor(...GRAY);
    d.text('Sin series con peso registradas este año.', 14, y);
    y += 8;
  } else {
    y = hBars(d, 14, y, 182, muscles.map(([name, v], i) => ({ label: name, v, right: `${Math.round((v / mTotal) * 100)} %`, color: PAL[i % PAL.length] })));
  }

  // Tabla mes a mes
  y += 12;
  sectionTitle(d, y, 'Mes a mes');
  y += 9;
  const cols = [14, 33, 46, 68, 90, 102, 121, 139, 157, 177];
  d.setFillColor(241, 245, 249);
  d.roundedRect(12, y - 4.5, 186, 6.5, 2, 2, 'F');
  d.setFont('helvetica', 'bold');
  d.setFontSize(8);
  d.setTextColor(...INK);
  ['Mes', 'Entrenos', 'Volumen kg', 'kcal quem.', 'PRs', 'kcal com.', 'Proteína', 'Peso', 'Cintura', 'Barriga'].forEach((h, i) => d.text(h, cols[i], y));
  y += 7;
  d.setFont('helvetica', 'normal');
  perMonth.forEach((m, i) => {
    if (i % 2 === 0) {
      d.setFillColor(248, 250, 252);
      d.rect(12, y - 4.2, 186, 5.6, 'F');
    }
    d.setTextColor(...INK);
    [MONTHS[i][0].toUpperCase() + MONTHS[i].slice(1), `${m.n}`, num(m.volume), num(m.burned), `${m.prs}`, m.loggedDays ? num(m.kcal) : '-', m.loggedDays ? `${m.prot} g` : '-', m.weight ? `${m.weight} kg` : '-', m.waist ? `${m.waist} cm` : '-', m.belly ? `${m.belly} cm` : '-'].forEach((c, k) => d.text(c, cols[k], y));
    y += 5.6;
  });

  const pages = d.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    d.setPage(p);
    d.setFont('helvetica', 'normal');
    d.setFontSize(7);
    d.setTextColor(...GRAY);
    d.text('Estimaciones calculadas por la app a partir de tus registros; no sustituyen el consejo de un profesional.', 14, 290);
    d.text(`Página ${p} de ${pages}`, 196, 290, { align: 'right' });
  }
  const name = `informe-anual-${year}.pdf`;
  const file = new File([d.output('blob')], name, { type: 'application/pdf' });
  await onFile?.(file);
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Informe ${year}` });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
  }
  d.save(name);
}
