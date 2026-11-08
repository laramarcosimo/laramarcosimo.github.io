/** Ilustraciones realistas (SVG propio con degradados y sombras, sin imágenes externas) de la rutina de rescate. */
const T = '#0d9488';
const defs = `<defs>
<radialGradient id="sk" cx="50%" cy="42%" r="65%"><stop offset="0" stop-color="#fbdcc4"/><stop offset=".7" stop-color="#f1c4a3"/><stop offset="1" stop-color="#d9a283"/></radialGradient>
<linearGradient id="nk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98366"/><stop offset=".35" stop-color="#e8b998"/><stop offset="1" stop-color="#f1c4a3"/></linearGradient>
<linearGradient id="jd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a7e8c9"/><stop offset=".5" stop-color="#4fc3a1"/><stop offset="1" stop-color="#1f8f74"/></linearGradient>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4efe9"/><stop offset="1" stop-color="#e5ddd3"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-opacity=".35"/></filter>
</defs><rect width="240" height="240" fill="url(#bg)"/>`;

const face = `<path d="M62 96C52 20 100 2 120 2s70 18 58 94c-4-40-14-56-58-58S66 56 62 96Z" fill="#4a2f22"/>
<path d="M96 168 L92 222 L148 222 L144 168Z" fill="url(#nk)"/><path d="M96 170 Q120 196 144 170 L146 188 Q120 208 94 188Z" fill="#a8745a" opacity=".35"/>
<path d="M20 240Q28 206 92 208L148 208Q212 206 220 240Z" fill="#e7ecf2"/><path d="M92 210Q120 226 148 210" fill="none" stroke="#c4cdd8" stroke-width="2"/>
<path d="M98 214Q86 218 70 220M142 214Q154 218 170 220" stroke="#c9967a" stroke-width="2" fill="none" opacity=".55"/>
<ellipse cx="68" cy="98" rx="7" ry="13" fill="#e8b998"/><ellipse cx="172" cy="98" rx="7" ry="13" fill="#e8b998"/>
<path d="M120 24C160 24 174 60 172 95C170 132 152 170 120 174C88 170 70 132 68 95C66 60 80 24 120 24Z" fill="url(#sk)"/>
<path d="M120 24C160 24 174 60 172 95C170 132 152 170 120 174C88 170 70 132 68 95C66 60 80 24 120 24Z" fill="none" stroke="#c99476" stroke-width="1.2" opacity=".6"/>
<path d="M64 96C60 28 100 6 120 6s64 20 56 90c-2-34-12-52-56-54S66 62 64 96Z" fill="#4a2f22"/>
<path d="M90 74q12-8 24-2M126 72q12-6 24 2" stroke="#4a2f22" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M89 90q10-8 22 0q-10 7-22 0ZM129 90q10-8 22 0q-10 7-22 0Z" fill="#fff" stroke="#6b4a3a" stroke-width="1.5"/>
<circle cx="100" cy="90" r="4.2" fill="#5b3a29"/><circle cx="140" cy="90" r="4.2" fill="#5b3a29"/><circle cx="100" cy="90" r="1.8" fill="#111"/><circle cx="140" cy="90" r="1.8" fill="#111"/>
<path d="M118 92q-4 22-6 30q8 6 16 0q-2-8-4-30" fill="#e3b08f" opacity=".55"/><path d="M110 126q10 6 20 0" stroke="#b8805f" stroke-width="2" fill="none"/>
<path d="M102 146q10-6 18-2q8-4 18 2q-9 12-18 12t-18-12Z" fill="#c76b73"/><path d="M104 147q16 4 32 0" stroke="#9e4b55" stroke-width="1.6" fill="none"/>
<ellipse cx="86" cy="116" rx="12" ry="8" fill="#f0a08e" opacity=".25"/><ellipse cx="154" cy="116" rx="12" ry="8" fill="#f0a08e" opacity=".25"/>`;

const arrow = (x1: number, y1: number, x2: number, y2: number): string => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = (d: number): string => `${(x2 - 10 * Math.cos(a + d)).toFixed(1)},${(y2 - 10 * Math.sin(a + d)).toFixed(1)}`;
  return `<g opacity=".92"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="7" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${T}" stroke-width="3.5" stroke-linecap="round"/><polygon points="${x2},${y2} ${h(0.55)} ${h(-0.55)}" fill="${T}" stroke="#fff" stroke-width="1.5"/></g>`;
};
const zig = (x: number, y: number, w: number): string => {
  let p = `M${x},${y}`;
  for (let i = 1; i <= 8; i++) p += ` L${x + (w * i) / 8},${y + (i % 2 ? 6 : -6)}`;
  return `<path d="${p}" fill="none" stroke="${T}" stroke-width="3.2" stroke-linecap="round" opacity=".9"/>`;
};
const gua = (x: number, y: number, r: number): string => `<g transform="translate(${x} ${y}) rotate(${r})" filter="url(#sh)"><path d="M0-20C20-26 34-8 20 10C12 22 2 26-8 16C-26 2-18-18 0-20Z" fill="url(#jd)" stroke="#167a63" stroke-width="1.5"/><path d="M-6-10q8-6 16 0" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/></g>`;
const roll = (x: number, y: number, r: number): string => `<g transform="translate(${x} ${y}) rotate(${r})" filter="url(#sh)"><rect x="-2.5" y="-4" width="5" height="46" rx="2.5" fill="#d4b483"/><circle cx="0" cy="-8" r="13" fill="url(#jd)" stroke="#167a63" stroke-width="1.5"/><circle cx="-4" cy="-12" r="3.5" fill="#fff" opacity=".5"/></g>`;
const finger = (x: number, y: number, r: number, l = 22): string => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-4.5" y="0" width="9" height="${l}" rx="4.5" fill="#efbf9f" stroke="#c99476" stroke-width="1"/></g>`;
const palm = (x: number, y: number, r: number): string => `<g transform="translate(${x} ${y}) rotate(${r})" filter="url(#sh)"><rect x="-17" y="-12" width="34" height="26" rx="12" fill="#efbf9f" stroke="#c99476" stroke-width="1.2"/><path d="M-9-12v-8M-3-12v-10M3-12v-10M9-12v-8" stroke="#efbf9f" stroke-width="6" stroke-linecap="round"/></g>`;

const bed = (head: string): string => `<rect y="150" width="240" height="90" fill="#cfd8e3"/><rect x="0" y="146" width="240" height="14" rx="6" fill="#f8fafc" stroke="#cbd5e1"/><rect x="0" y="160" width="240" height="80" fill="#9fb3c8"/>${head}`;

const ART: Record<string, string> = {
  frente: face + zig(88, 50, 64) + zig(88, 58, 64) + arrow(120, 46, 120, 12) + gua(120, 40, -90),
  entrecejo: face + finger(66, 70, 160, 20) + arrow(118, 70, 84, 46) + gua(112, 66, 40),
  ocular: face + finger(94, 64, 175, 18) + finger(146, 64, 185, 18) + `<ellipse cx="100" cy="90" rx="14" ry="9" fill="none" stroke="${T}" stroke-width="3" stroke-dasharray="4 3"/><ellipse cx="140" cy="90" rx="14" ry="9" fill="none" stroke="${T}" stroke-width="3" stroke-dasharray="4 3"/>`,
  labio: face + arrow(120, 134, 96, 142) + arrow(120, 134, 144, 142) + gua(120, 134, 90),
  pomulo: face + arrow(116, 118, 84, 98) + arrow(138, 112, 174, 80) + roll(150, 112, 55),
  mandibula: face + arrow(120, 168, 82, 140) + arrow(120, 168, 158, 140) + gua(102, 160, 55),
  cuello: face + zig(94, 188, 52) + zig(94, 198, 52) + gua(150, 190, -25),
  rodillo: face + arrow(120, 218, 120, 176) + roll(120, 196, 180),
  drenaje: face + arrow(86, 120, 94, 200) + arrow(154, 120, 146, 200) + roll(88, 150, 10),
  besos: face + `<ellipse cx="120" cy="150" rx="10" ry="7" fill="#c04a5a"/>` + arrow(120, 22, 120, 4) + palm(88, 222, 100) + palm(152, 222, -100),
  suspendida: bed(`<ellipse cx="90" cy="134" rx="62" ry="16" fill="#e7ecf2" stroke="#c4cdd8"/><circle cx="178" cy="150" r="24" fill="url(#sk)" stroke="#c99476"/><path d="M164 128Q198 120 204 156Q196 140 164 138Z" fill="#4a2f22"/><path d="M150 140q-14 4-26 0" stroke="#d9a283" stroke-width="10" stroke-linecap="round"/>`) + arrow(196, 172, 196, 214),
  extension: bed(`<ellipse cx="80" cy="132" rx="60" ry="13" fill="#e7ecf2" stroke="#c4cdd8"/><circle cx="190" cy="104" r="22" fill="url(#sk)" stroke="#c99476"/><path d="M176 86Q210 80 212 112Q200 98 176 98Z" fill="#4a2f22"/><path d="M130 130q30-4 44-22" stroke="#e8b998" stroke-width="12" stroke-linecap="round" fill="none"/>`) + arrow(200, 134, 200, 70),
};

export const faceArt = (k: keyof typeof ART | string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${defs}${ART[k] ?? ''}</svg>`)}`;
