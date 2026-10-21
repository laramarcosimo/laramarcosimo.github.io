/**
 * Pruebas de pantalla: abren la app compilada (dist) en un navegador de pruebas a 375 px de ancho, con letra normal y muy grande,
 * recorren cada pestaña, subpestaña y apartado de Ajustes y fallan si algo se desborda, da un error o un botón no tiene nombre.
 * Uso: npm run build && npm run test:ui     (necesita: npx playwright-core install chromium-headless-shell)
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4181;
const URL = `http://localhost:${PORT}/`;
const IGNORE = /openfoodfacts|net::ERR|Failed to load resource|CORS/i; // el navegador de pruebas bloquea Open Food Facts (CORS): no es un fallo de la app

const server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

const waitUp = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      /* aún no */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('El servidor de vista previa no arranca. ¿Has hecho npm run build?');
};

const failures = [];
let checks = 0;
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

const TOPS = [
  ['Hoy', ['Hoy', 'Progreso', 'Esta semana']],
  ['Entreno', []],
  ['Nutrición', ['Diario de hoy', 'Tuppers y recetas']],
  ['Despensa', ['Inventario', 'Menú y recetas', 'Compra y utensilios']],
  ['Ajustes', []],
];

async function audit(page, where) {
  checks++;
  // Autoprueba (UI_CHECK_BREAK=1): mete un elemento demasiado ancho para comprobar que la prueba lo detecta.
  if (process.env.UI_CHECK_BREAK) await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'width:600px;height:4px'; d.id = '__wide'; document.body.appendChild(d); });
  const r = await page.evaluate(() => {
    const vis = (e) => {
      const b = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return b.width > 1 && b.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    const noName = [...document.querySelectorAll('button,a,input,select,textarea,[role=tab]')]
      .filter((e) => vis(e) && !e.closest('[hidden]') && e.type !== 'hidden' && e.type !== 'file')
      .filter((e) => !((e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || e.getAttribute('placeholder') || '').trim() || e.closest('label')?.textContent?.trim() || (e.id && document.querySelector(`label[for="${e.id}"]`))))
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`);
    const wide = [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.overflow-x-auto,.overflow-auto,pre,nav,[class*="overflow"]')).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)} «${(e.textContent || '').trim().slice(0, 30)}»`);
    // Contraste de texto (WCAG AA: 4,5:1; 3:1 si es grande). Se ignoran los controles desactivados y los atenuados.
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const blend = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
    const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { st.push(c); if (c.a >= 1) break; } } let cur = parse(getComputedStyle(document.body).backgroundColor); if (!cur || cur.a === 0) cur = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length - 1; i >= 0; i--) cur = blend(st[i], cur); return cur; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const lowContrast = [];
    document.querySelectorAll('body *').forEach((e) => {
      const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1).map((n) => n.textContent.trim()).join(' ');
      if (!own || !vis(e)) return;
      const cs = getComputedStyle(e);
      if (cs.fontSize === '0px') return;
      for (let a = e; a; a = a.parentElement) { if (a.disabled || a.getAttribute('aria-disabled') === 'true' || (parseFloat(getComputedStyle(a).opacity) || 1) < 0.9) return; }
      const fg = parse(cs.color); if (!fg) return;
      const bg = bgOf(e); const f = blend(fg, bg);
      const l1 = lum(f), l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize); const large = size >= 18.6 || (size >= 14 && +cs.fontWeight >= 700);
      if (ratio < (large ? 3 : 4.5)) lowContrast.push(`${ratio.toFixed(1)}:1 «${own.slice(0, 28)}» (${e.tagName.toLowerCase()}.${String(e.className).split(/\s+/).filter((x) => /^(text-|bg-)/.test(x)).join('.').slice(0, 40)})`);
    });
    return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, noName, wide, lowContrast: [...new Set(lowContrast)].slice(0, 4) };
  });
  if (process.env.UI_CHECK_BREAK) await page.evaluate(() => document.getElementById('__wide')?.remove());
  // La app recorta el desborde (overflow-x oculto), así que scrollWidth no basta: se mira también si algún elemento visible sobresale por la derecha.
  if (r.scrollW > r.innerW || r.wide.length) fail(where, `desborde horizontal (${r.scrollW} > ${r.innerW}) por ${r.wide.join(' | ') || 'un elemento sin identificar'}`);
  if (r.lowContrast.length) fail(where, `contraste bajo: ${r.lowContrast.join(' | ')}`);
  if (r.noName.length) fail(where, `botones sin nombre: ${[...new Set(r.noName)].slice(0, 4).join(', ')}`);
}

async function click(page, text, exact = false) {
  return page.evaluate(({ text, exact }) => {
    const b = [...document.querySelectorAll('button,[role=tab]')].find((x) => (exact ? x.textContent.trim() === text : x.textContent.trim().startsWith(text)));
    b?.click();
    return !!b;
  }, { text, exact });
}

async function sweep(page, label) {
  for (const [top, subs] of TOPS) {
    if (!(await click(page, top))) {
      fail(label, `no encuentro la pestaña «${top}»`);
      continue;
    }
    await page.waitForTimeout(700);
    await audit(page, `${label} · ${top}`);
    for (const s of subs) {
      if (!(await click(page, s))) {
        fail(label, `no encuentro «${top} › ${s}»`);
        continue;
      }
      await page.waitForTimeout(450);
      await audit(page, `${label} · ${top} › ${s}`);
    }
    if (top === 'Ajustes') {
      const titles = await page.evaluate(() => [...document.querySelectorAll('button[aria-expanded]')].map((b) => b.textContent.trim().slice(0, 30)));
      for (const t of titles) {
        await page.evaluate((t) => {
          const b = [...document.querySelectorAll('button[aria-expanded]')].find((x) => x.textContent.trim().startsWith(t));
          if (b && b.getAttribute('aria-expanded') !== 'true') b.click();
        }, t);
        await page.waitForTimeout(300);
        await audit(page, `${label} · Ajustes › ${t}`);
      }
    }
  }
}


/** Escenarios con acciones reales (Gemini y Supabase simulados): cada uno falla si lo esperado no ocurre. */
async function scenarios(browser) {
  const ok = (name, cond, detail = '') => { checks++; if (!cond) fail(`escenario «${name}»`, detail || 'no ocurrió lo esperado'); };
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail('escenarios', `error de la página: ${e.message}`));
  const ai = { menu: 0, meal: 0 };
  await ctx.route(/generativelanguage\.googleapis\.com/, async (route) => {
    const body = route.request().postData() || '';
    const isMenu = body.includes('CARTA');
    isMenu ? ai.menu++ : ai.meal++;
    const payload = isMenu
      ? { opciones: [{ nombre: 'Merluza a la plancha', calorias: 380, proteinas: 34, carbs: 12, grasas: 18, motivo: 'Mucha proteína.', pedir: 'Aliño aparte.' }, { nombre: 'Pollo al ajillo', calorias: 520, proteinas: 38, carbs: 8, grasas: 34, motivo: 'Algo graso.', pedir: 'Sin patatas.' }, { nombre: 'Ensalada César', calorias: 450, proteinas: 25, carbs: 20, grasas: 30, motivo: 'Aceptable.', pedir: 'Salsa aparte.' }], evitar: ['Fritura mixta'], consejo: 'Cena ligera.' }
      : { plato: 'Tostada con huevo', calorias: 320, proteinas: 18, carbs: 25, grasas: 15, ingredientesDetectados: ['huevo'], coincidenciasDespensa: [], consejo: 'Buena toma.' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) });
  });
  await page.goto(URL);
  await page.waitForTimeout(1500);
  await click(page, 'Hoy');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('250 ml'))?.click());
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('apex-coach-v2'));
    st.settings.geminiKey = 'TEST';
    st.settings.geminiModel = 'gemini-test';
    localStorage.setItem('apex-coach-v2', JSON.stringify(st));
  });
  await page.reload();
  await page.waitForTimeout(1500);
  const jpg = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 500; const x = c.getContext('2d'); for (let i = 0; i < 40; i++) { x.fillStyle = `hsl(${i * 37 % 360},60%,50%)`; x.fillRect(Math.random() * 400, Math.random() * 500, 90, 90); } return c.toDataURL('image/jpeg', 0.9).split(',')[1]; }), 'base64');
  const file = { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: jpg };
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('apex-coach-v2')));
  const text = () => page.evaluate(() => document.body.innerText);

  // 1) Buscador de Ajustes: escribir, pulsar el resultado y ver el apartado abierto
  await click(page, 'Ajustes');
  await page.waitForTimeout(600);
  await page.fill('input[aria-label="Buscar en Ajustes"]', 'cifrad');
  await page.waitForTimeout(300);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Cifrado con contraseña') && b.textContent.includes('Copias de seguridad'))?.click());
  await page.waitForTimeout(700);
  ok('buscar en Ajustes abre el apartado', await page.evaluate(() => [...document.querySelectorAll('button[aria-expanded]')].find((b) => b.textContent.includes('Copias de seguridad y datos'))?.getAttribute('aria-expanded') === 'true'));

  // 2) Modo vacaciones: activar, ver la tarjeta, cambiar minutos y circuito, empezar
  await page.evaluate(() => [...document.querySelectorAll('button[aria-expanded]')].find((b) => b.textContent.startsWith('Entrenamiento'))?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('input[aria-label="Modo vacaciones"]')?.click());
  await click(page, 'Hoy');
  await page.waitForTimeout(700);
  await click(page, 'Hoy', true);
  await page.waitForTimeout(500);
  ok('modo vacaciones muestra su tarjeta', (await text()).includes('MODO VACACIONES'));
  const circuit = () => page.evaluate(() => document.body.innerText.match(/Circuito: ([^\n]+)/)?.[1]);
  const c1 = await circuit();
  await click(page, '5 min', true);
  await page.waitForTimeout(250);
  ok('cambiar a 5 minutos', (await text()).includes('Hoy ≈ 5 minutos'));
  await click(page, 'Otro circuito', true);
  await page.waitForTimeout(250);
  ok('«Otro circuito» cambia el circuito', (await circuit()) !== c1, `${c1} → ${await circuit()}`);

  // 3) Foto de comida (galería) en vacaciones: pregunta dónde, suma «fuera de casa»
  await page.locator('input[type=file]:not([capture])').first().setInputFiles(file);
  await page.waitForFunction(() => document.body.innerText.includes('¿Dónde la comiste?'), null, { timeout: 8000 }).catch(() => {});
  ok('la foto de comida pregunta dónde la comiste', (await text()).includes('¿Dónde la comiste?'));
  await click(page, 'Fuera de casa', true);
  await page.waitForTimeout(500);
  const m = (await state()).meals;
  ok('«Fuera de casa» suma la comida marcada como fuera', m.length === 1 && m[0].out === true && m[0].calorias === 320, JSON.stringify(m.map((x) => [x.plato, x.out])));

  // 4) Foto de la carta en Nutrición
  await click(page, 'Nutrición');
  await page.waitForTimeout(700);
  await click(page, 'Diario de hoy');
  await page.waitForTimeout(400);
  const menuCard = page.locator('.card', { hasText: 'Comer fuera: foto de la carta' }).first();
  await menuCard.locator('input[type=file]:not([capture])').setInputFiles(file);
  await page.waitForFunction(() => document.body.innerText.includes('Merluza a la plancha'), null, { timeout: 8000 }).catch(() => {});
  ok('la carta propone 3 platos', (await text()).includes('Merluza a la plancha') && ai.menu === 1);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Lo pido'))?.click());
  await page.waitForTimeout(400);
  ok('«Lo pido» añade al diario como comida fuera', (await state()).meals.filter((x) => x.out).length === 2);

  // 5) Fotos de progreso: subir, abrir, borrar (papelera) y restaurar
  await click(page, 'Hoy');
  await page.waitForTimeout(700);
  await click(page, 'Progreso');
  await page.waitForTimeout(500);
  const photos = page.locator('.card', { hasText: 'Fotos de progreso' }).first();
  await photos.locator('input[type=file]').setInputFiles(file);
  await page.waitForTimeout(2500);
  const thumbs = () => photos.locator('button[aria-label^="Ver foto"]').count();
  ok('la foto de progreso se guarda', (await thumbs()) === 1);
  await photos.locator('button[aria-label^="Ver foto"]').first().click();
  await page.waitForTimeout(300);
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Borrar')?.click());
  await page.waitForTimeout(900);
  ok('borrar la foto la manda a la papelera', (await thumbs()) === 0 && (await photos.innerText()).includes('Papelera (1)'));
  await photos.getByRole('button', { name: /Papelera/ }).click();
  await photos.getByRole('button', { name: 'Restaurar' }).click();
  await page.waitForTimeout(700);
  ok('restaurar la devuelve a la galería', (await thumbs()) === 1);

  // 6) Sin conexión: la foto espera, y al volver internet se analiza sola
  await click(page, 'Nutrición');
  await page.waitForTimeout(700);
  await click(page, 'Diario de hoy');
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.locator('input[type=file]:not([capture])').first().setInputFiles(file);
  await page.waitForTimeout(1500);
  ok('sin conexión la foto queda en espera', (await text()).includes('esperando conexión'));
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => document.body.innerText.includes('Sumar (fuera)'), null, { timeout: 10000 }).catch(() => {});
  ok('al volver internet se analiza sola y la foto se borra', (await text()).includes('Sumar (fuera)') && (await page.evaluate(() => new Promise((r) => { const q = indexedDB.open('apex-mealqueue'); q.onsuccess = () => { const g = q.result.transaction('q').objectStore('q').getAll(); g.onsuccess = () => r(g.result.every((x) => !x.b64)); }; }))));
  await ctx.close();
}

try {
  await waitUp();
  const browser = await chromium.launch();
  const matrix = [
    ['normal, letra 16 px', { fontPx: 16, simple: false, vacation: false, light: true }],
    ['letra muy grande (21 px)', { fontPx: 21, simple: false, vacation: false, light: true }],
    ['modo oscuro + vacaciones + modo simple', { fontPx: 16, simple: true, vacation: true, light: false }],
  ];
  for (const [label, cfg] of matrix) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fail(label, `error de la página: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORE.test(m.text())) fail(label, `consola: ${m.text().slice(0, 140)}`);
    });
    await page.goto(URL);
    await page.waitForTimeout(1500);
    // Crea el estado y ajusta las opciones de la prueba
    await click(page, 'Hoy');
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('250 ml'))?.click());
    await page.waitForTimeout(900);
    await page.evaluate((cfg) => {
      const st = JSON.parse(localStorage.getItem('apex-coach-v2') || 'null');
      if (st) {
        st.settings.hideHints = cfg.simple;
        st.settings.iconOnly = cfg.simple;
        st.settings.vacation = cfg.vacation;
        if (cfg.vacation) st.settings.vacationLog = [{ from: Date.now() - 86400000 }];
        st.settings.fontScale = 'normal';
        localStorage.setItem('apex-coach-v2', JSON.stringify(st));
      }
      localStorage.setItem('apex-theme', cfg.light ? 'light' : 'dark');
    }, cfg);
    await page.reload();
    await page.waitForTimeout(1500);
    await page.evaluate((px) => { document.documentElement.style.fontSize = `${px}px`; }, cfg.fontPx);
    await sweep(page, label);
    await ctx.close();
  }
  await scenarios(browser);
  await browser.close();
} finally {
  stop();
}

console.log(`\n${checks} pantallas revisadas en 3 configuraciones.`);
if (failures.length) {
  console.log(`\n✗ ${failures.length} problema(s):`);
  for (const f of [...new Set(failures)]) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('✓ Sin desbordes, sin errores y todos los botones con nombre.');
