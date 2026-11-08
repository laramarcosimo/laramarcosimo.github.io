/** Dibujos originales de la rutina de rescate (SVG propio, sin imágenes externas). */
const C = '#0f766e';
const arrow = (x1: number, y1: number, x2: number, y2: number): string => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = (d: number): string => `${(x2 - 9 * Math.cos(a + d)).toFixed(1)},${(y2 - 9 * Math.sin(a + d)).toFixed(1)}`;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C}" stroke-width="4" stroke-linecap="round"/><polygon points="${x2},${y2} ${h(0.5)} ${h(-0.5)}" fill="${C}"/>`;
};
const zig = (x: number, y: number, w: number): string => {
  let p = `M${x},${y}`;
  for (let i = 1; i <= 6; i++) p += ` L${x + (w * i) / 6},${y + (i % 2 ? 7 : -7)}`;
  return `<path d="${p}" fill="none" stroke="${C}" stroke-width="3.5" stroke-linecap="round"/>`;
};
const dot = (x: number, y: number): string => `<circle cx="${x}" cy="${y}" r="5" fill="#f59e0b"/>`;
const face = `<ellipse cx="100" cy="82" rx="48" ry="62" fill="#fde4d0" stroke="#d6a98a" stroke-width="2"/><rect x="82" y="138" width="36" height="42" fill="#f6d3b8"/><path d="M20 200 Q30 170 82 172 L118 172 Q170 170 180 200Z" fill="#cbd5e1"/><path d="M80 66 Q90 60 98 66 M102 66 Q110 60 120 66" stroke="#7c5a45" stroke-width="3" fill="none"/><circle cx="88" cy="76" r="3.5" fill="#334155"/><circle cx="112" cy="76" r="3.5" fill="#334155"/><path d="M100 82 L96 100 L104 100" stroke="#d6a98a" fill="none" stroke-width="2"/><path d="M88 116 Q100 124 112 116" stroke="#c2410c" stroke-width="3" fill="none" stroke-linecap="round"/>`;
const side = (head: string): string => `<rect x="10" y="130" width="120" height="14" rx="4" fill="#94a3b8"/><rect x="10" y="144" width="8" height="30" fill="#64748b"/><rect x="122" y="144" width="8" height="30" fill="#64748b"/>${head}`;

const ART: Record<string, string> = {
  frente: face + zig(66, 40, 68) + arrow(100, 36, 100, 8),
  entrecejo: face + dot(100, 62) + arrow(98, 58, 62, 36) + arrow(102, 58, 138, 36),
  ocular: face + dot(80, 58) + dot(120, 58) + `<circle cx="88" cy="76" r="9" fill="none" stroke="${C}" stroke-width="3"/><circle cx="112" cy="76" r="9" fill="none" stroke="${C}" stroke-width="3"/>`,
  labio: face + arrow(100, 106, 78, 114) + arrow(100, 106, 122, 114),
  pomulo: face + arrow(86, 94, 56, 66) + arrow(114, 94, 144, 66) + `<circle cx="150" cy="150" r="14" fill="#14b8a6"/><rect x="146" y="164" width="8" height="26" fill="#0f766e"/>`,
  mandibula: face + arrow(100, 136, 64, 112) + arrow(100, 136, 136, 112),
  cuello: face + zig(84, 150, 32) + zig(84, 162, 32),
  rodillo: face + arrow(100, 178, 100, 134) + `<circle cx="150" cy="150" r="14" fill="#14b8a6"/><rect x="146" y="164" width="8" height="26" fill="#0f766e"/>`,
  drenaje: face + arrow(70, 112, 82, 168) + arrow(130, 112, 118, 168),
  besos: face + `<ellipse cx="100" cy="118" rx="9" ry="6" fill="#e11d48"/>` + arrow(100, 38, 100, 6) + dot(76, 176) + dot(124, 176),
  suspendida: side(`<circle cx="152" cy="150" r="20" fill="#fde4d0" stroke="#d6a98a" stroke-width="2"/><rect x="40" y="108" width="84" height="22" rx="10" fill="#cbd5e1"/>`) + arrow(160, 118, 160, 170),
  extension: side(`<circle cx="152" cy="112" r="20" fill="#fde4d0" stroke="#d6a98a" stroke-width="2"/><rect x="30" y="112" width="90" height="18" rx="9" fill="#cbd5e1"/>`) + arrow(165, 140, 165, 96),
};

export const faceArt = (k: keyof typeof ART | string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f8fafc"/>${ART[k] ?? ''}</svg>`)}`;
