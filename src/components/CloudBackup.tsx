import { Cloud, CloudDownload, CloudUpload, Copy, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { backupNow, fetchBackup, lastBackupAt, readCloud, SQL_SETUP, writeCloud, type CloudConfig } from '../lib/cloud';
import { verifyBackup, type BackupCheck } from '../lib/backupCheck';
import { encryptionOn, getPassphrase, setEncryption, setPassphrase } from '../lib/crypto';
import { cloudPhotosOn, resetCloudFlags, restorePhotos, setCloudPhotos, SQL_PHOTOS, syncPhotos } from '../lib/photosCloud';
import { SQL_SLEEP } from '../lib/sleepCloud';
import { SQL_STEPS } from '../lib/stepsCloud';
import { defaultState, useStore } from '../lib/store';
import type { AppState } from '../lib/types';
import { ErrorBox } from './ui';
import { Hint } from './Hint';

const fmt = (t: number): string => (t ? new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'nunca');

/** Copia de seguridad en la nube sin cuentas ni contraseñas: un código anónimo por dispositivo. */
export function CloudBackup() {
  const { state, replace } = useStore();
  const [cfg, setCfg] = useState<CloudConfig>(readCloud);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [last, setLast] = useState(lastBackupAt());
  const [copied, setCopied] = useState('');
  const [pass, setPass] = useState(getPassphrase);
  const [encOn, setEncOn] = useState(encryptionOn);
  const restored = useRef(false);
  const [photosOn, setPhotosOn] = useState(cloudPhotosOn);
  const [check, setCheck] = useState<BackupCheck | null>(null);

  const save = (c: CloudConfig) => {
    setCfg(c);
    writeCloud(c);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  };
  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      /* sin portapapeles */
    }
  };

  const upload = () =>
    run(async () => {
      setLast(await backupNow(state));
      setMsg('Copia subida a la nube. La anterior se ha sobrescrito.');
    });

  /** Guarda la contraseña y activa el cifrado: la próxima copia (y las fotos, que se vuelven a subir) irán cifradas. No sube nada ahora. */
  const turnOnEnc = () =>
    run(async () => {
      if (pass.trim().length < 8) throw new Error('Usa una contraseña de al menos 8 caracteres.');
      setPassphrase(pass.trim());
      setEncryption(true);
      setEncOn(true);
      await resetCloudFlags();
      setMsg('Cifrado activado. La próxima copia y las fotos se subirán cifradas. Apunta tu contraseña en un sitio seguro: sin ella no se puede recuperar nada.');
    });
  const turnOffEnc = () => {
    if (!confirm('Las próximas copias irán SIN cifrar. Las ya subidas siguen cifradas hasta que se sobrescriban. ¿Continuar?')) return;
    setEncryption(false);
    setEncOn(false);
  };
  /** Restaura los datos y, después, trae también las fotos de la nube que falten en este móvil. */
  const restoreAll = () =>
    run(async () => {
      restored.current = false;
      await restore();
      if (!restored.current) return; // canceló la restauración de datos
      const n = await restorePhotos();
      void syncPhotos();
      setMsg((m) => `${m} ${n} foto${n === 1 ? '' : 's'} recuperada${n === 1 ? '' : 's'} de la nube (versión reducida).`);
    });

  /** Descarga la copia y comprueba que se puede restaurar, sin tocar tus datos. */
  const checkNow = () =>
    run(async () => {
      setCheck(null);
      setCheck(await verifyBackup(state));
    });

  const restore = (code?: string) =>
    run(async () => {
      const r = await fetchBackup(code);
      if (!r) throw new Error('No hay ninguna copia con ese código.');
      if (!confirm(`Se sustituirán los datos de este dispositivo por la copia del ${new Date(r.updatedAt).toLocaleString('es-ES')}. ¿Continuar?`)) return;
      const d = defaultState();
      const j = r.data as Partial<AppState>;
      replace({ ...d, ...j, profile: { ...d.profile, ...j.profile }, settings: { ...d.settings, ...j.settings, geminiKey: state.settings.geminiKey } } as AppState);
      if (code) save({ ...cfg, deviceId: code.trim() }); // este dispositivo pasa a usar ese código
      restored.current = true;
      setMsg('Datos restaurados.');
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-semibold text-white"><Cloud size={18} strokeWidth={1.5} /> Copia de seguridad en la nube</div>
      <Hint className="text-xs text-slate-400">Sin cuentas ni contraseñas: la app funciona siempre en tu dispositivo y la nube es solo una copia, que se sobrescribe cada vez. Se sube sola al abrir la app si pasó 1 día y tras guardar un entreno.</Hint>

      <div className="space-y-2">
        <input className="field" placeholder="URL del proyecto (https://xxxx.supabase.co)" value={cfg.url} onChange={(e) => save({ ...cfg, url: e.target.value })} inputMode="url" autoCapitalize="none" />
        <input className="field" placeholder="Clave pública (anon)" value={cfg.anonKey} onChange={(e) => save({ ...cfg, anonKey: e.target.value })} autoCapitalize="none" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-blue" disabled={busy} onClick={() => void upload()}><CloudUpload size={16} strokeWidth={1.75} /> Subir copia a la nube</button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => void restore()}><CloudDownload size={16} strokeWidth={1.75} /> Restaurar datos</button>
      </div>
      <button className="btn btn-ghost w-full" disabled={busy} onClick={() => void checkNow()}><ShieldCheck size={16} strokeWidth={1.75} /> Comprobar que mi copia se puede restaurar</button>
      {check && (
        <div className={check.missing.length ? 'space-y-1 rounded-xl bg-amber-500/15 p-3 text-xs text-amber-500' : 'space-y-1 rounded-xl bg-emerald-500/15 p-3 text-xs text-emerald-400'}>
          <div className="font-bold">{check.missing.length ? 'La copia es válida, pero está desactualizada' : 'Copia válida y al día'}</div>
          <p className="text-slate-200">Del {new Date(check.updatedAt).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}: {check.cloud.workouts} entrenos, {check.cloud.meals} comidas, {check.cloud.templates} rutinas, {check.cloud.measurements} medidas. Se ha descargado y {encryptionOn() ? 'descifrado' : 'leído'} bien; tus datos no se han tocado.</p>
          {check.missing.length > 0 && <p>Tu móvil tiene más que la copia: {check.missing.join(', ')}. Pulsa «Subir copia a la nube».</p>}
          <p className="text-slate-200">Fotos de progreso: {check.photos.uploaded} de {check.photos.local} ya están en la nube.</p>
        </div>
      )}
      <button className="btn btn-ghost w-full" disabled={busy} onClick={() => void restoreAll()}><CloudDownload size={16} strokeWidth={1.75} /> Restaurar datos y fotos (móvil nuevo)</button>
      <div className="text-xs text-slate-400">Última copia guardada: <b className="text-slate-200">{fmt(last)}</b></div>
      <label className="flex items-center justify-between gap-3 text-sm"><span>Copia automática</span><input type="checkbox" className="h-5 w-5" checked={cfg.auto} onChange={(e) => save({ ...cfg, auto: e.target.checked })} /></label>
      {msg && <p className="text-sm text-emerald-500">{msg}</p>}
      {err && <ErrorBox msg={err} />}

      <div className="space-y-2 rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
        <div className="flex items-center gap-1.5 font-semibold text-white"><Lock size={13} /> Cifrado con tu contraseña {encOn && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">activado</span>}</div>
        <p className="text-slate-400">Cifra en tu móvil la copia de datos y las fotos antes de subirlas: Supabase solo ve datos ilegibles. Si pierdes la contraseña, esa copia no se puede recuperar. En un móvil nuevo, escríbela aquí ANTES de restaurar.</p>
        <input className="field !py-2 text-xs" type="password" autoComplete="off" placeholder="Contraseña de cifrado (mín. 8 caracteres)" value={pass} onChange={(e) => setPass(e.target.value)} aria-label="Contraseña de cifrado" />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-blue !py-2 text-xs" disabled={busy || pass.trim().length < 8} onClick={() => void turnOnEnc()}>{encOn ? 'Cambiar contraseña' : 'Activar cifrado'}</button>
          <button className="btn btn-ghost !py-2 text-xs" disabled={!encOn} onClick={turnOffEnc}>Desactivar</button>
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-white"><KeyRound size={13} /> Código de recuperación de este dispositivo</div>
        <Hint className="mb-2 text-slate-400">Guárdalo: con él recuperas tu copia si borras la app o cambias de móvil. No lo compartas: quien lo tenga puede leer tu copia.</Hint>
        <div className="break-all rounded-lg bg-slate-900 p-2 font-mono text-[11px] text-emerald-400">{cfg.deviceId}</div>
        <button className="btn btn-ghost mt-2 w-full !py-2" onClick={() => void copy(cfg.deviceId, 'id')}><Copy size={14} /> {copied === 'id' ? 'Copiado' : 'Copiar código'}</button>
        <div className="mt-3 flex gap-2">
          <input className="field !py-2 text-xs" placeholder="Restaurar con otro código" value={other} onChange={(e) => setOther(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          <button className="btn btn-ghost shrink-0 !py-2" disabled={busy || other.trim().length < 32} onClick={() => void restore(other)}>Usar</button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
        <label className="flex items-center justify-between gap-3 text-sm font-semibold text-white"><span>Copia de las fotos de progreso en mi Supabase</span><input type="checkbox" className="h-5 w-5 shrink-0" checked={photosOn} onChange={(e) => { setCloudPhotos(e.target.checked); setPhotosOn(e.target.checked); if (e.target.checked) void syncPhotos(); }} aria-label="Copia de las fotos de progreso en Supabase" /></label>
        <p className="text-slate-400">Cada foto se sube sola, reducida (≈ 20 kB) y cifrada si activaste el cifrado. No se sobrescribe con la copia de datos. Necesita ejecutar una vez el script de fotos (abajo). En Hoy → Progreso → Fotos puedes subir las pendientes a mano.</p>
        <details>
          <summary className="cursor-pointer font-semibold text-white">Configuración inicial de las fotos (una vez)</summary>
          <p className="mt-1">En el mismo proyecto de Supabase: <b>SQL Editor → New query</b>, pega este script y pulsa <b>Run</b>. Crea una tabla de fotos con un tope de seguridad de 120 MB (el plan gratuito da 500 MB por proyecto).</p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-2 font-mono text-[10px] text-emerald-400">{SQL_PHOTOS}</pre>
          <button className="btn btn-ghost mt-2 w-full !py-2" onClick={() => void copy(SQL_PHOTOS, 'sqlp')}><Copy size={14} /> {copied === 'sqlp' ? 'Copiado' : 'Copiar script de fotos'}</button>
        </details>
      </div>

      <details className="rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-semibold text-white">Sueño automático con un Atajo de iPhone</summary>
        <p className="mt-2">Al activar «No molestar» (o el modo Sueño) se anota que te duermes y al desactivarlo que te despiertas; las horas aparecen solas en Hoy → Sueño al abrir la app. Tramos de menos de 1,5 h se ignoran.</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4">
          <li>Necesitas la copia en la nube configurada arriba y ejecutar este script <b>una vez</b> en Supabase (SQL Editor → Run):</li>
        </ol>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-2 font-mono text-[10px] text-emerald-400">{SQL_SLEEP}</pre>
        <button className="btn btn-ghost mt-2 w-full !py-2" onClick={() => void copy(SQL_SLEEP, 'sqls')}><Copy size={14} /> {copied === 'sqls' ? 'Copiado' : 'Copiar script de sueño'}</button>
        <ol start={2} className="mt-2 list-decimal space-y-1.5 pl-4">
          <li>En la app <b>Atajos</b> → pestaña <b>Automatización</b> → <b>+</b> → <b>Modo de concentración</b> → No molestar → marca <b>Se activa</b> → <b>Ejecutar inmediatamente</b>.</li>
          <li>Añade la acción <b>Obtener contenido de URL</b> con: URL <span className="break-all font-mono text-emerald-400">{(cfg.url.trim().replace(/\/+$/, '') || 'TU_URL_SUPABASE') + '/rest/v1/rpc/apex_sleep_event'}</span>, Método <b>POST</b>.</li>
          <li>Encabezados (3): <span className="font-mono">apikey</span> = tu clave anon, <span className="font-mono">Authorization</span> = <span className="font-mono">Bearer</span> + espacio + tu clave anon, y <span className="font-mono">Content-Type</span> = <span className="font-mono">application/json</span>.</li>
          <li>Cuerpo de la solicitud: <b>JSON</b> con dos campos de texto: <span className="font-mono">p_device</span> = el código de abajo y <span className="font-mono">p_kind</span> = <span className="font-mono text-emerald-400">start</span>.</li>
          <li>Crea otra automatización igual pero con <b>Se desactiva</b> y <span className="font-mono">p_kind</span> = <span className="font-mono text-emerald-400">stop</span>.</li>
        </ol>
        <div className="mt-2 break-all rounded-lg bg-slate-900 p-2 font-mono text-[11px] text-emerald-400">{cfg.deviceId}</div>
        <button className="btn btn-ghost mt-2 w-full !py-2" onClick={() => void copy(cfg.deviceId, 'id2')}><Copy size={14} /> {copied === 'id2' ? 'Copiado' : 'Copiar código (p_device)'}</button>
        <p className="mt-2 text-slate-400">Consejo: si «No molestar» lo usas también de día, usa el modo <b>Sueño</b> en su lugar (mismo proceso, eligiendo ese modo).</p>
      </details>

      <details className="rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-semibold text-white">Pasos automáticos con un Atajo de iPhone</summary>
        <p className="mt-2">Un Atajo lee tus pasos de la app Salud (los mismos que ves en Fitness) y los manda a la nube; los pasos del día aparecen solos en Hoy → Pasos al abrir la app o volver a ella.</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4">
          <li>Necesitas la copia en la nube configurada arriba y ejecutar este script <b>una vez</b> en Supabase (SQL Editor → Run):</li>
        </ol>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-2 font-mono text-[10px] text-emerald-400">{SQL_STEPS}</pre>
        <button className="btn btn-ghost mt-2 w-full !py-2" onClick={() => void copy(SQL_STEPS, 'sqlpasos')}><Copy size={14} /> {copied === 'sqlpasos' ? 'Copiado' : 'Copiar script de pasos'}</button>
        <ol start={2} className="mt-2 list-decimal space-y-1.5 pl-4">
          <li>En <b>Atajos</b> crea un atajo nuevo con la acción <b>Buscar muestras de salud</b>: Tipo = <b>Pasos</b>, Fecha de inicio = <b>es hoy</b>.</li>
          <li>Añade <b>Calcular estadísticas</b> → <b>Suma</b> sobre las muestras encontradas.</li>
          <li>Añade <b>Dar formato a la fecha</b> sobre <b>Fecha actual</b>: formato <b>Personalizado</b> con <span className="font-mono text-emerald-400">yyyy-MM-dd</span>.</li>
          <li>Añade <b>Obtener contenido de URL</b>: URL <span className="break-all font-mono text-emerald-400">{(cfg.url.trim().replace(/\/+$/, '') || 'TU_URL_SUPABASE') + '/rest/v1/rpc/apex_steps_event'}</span>, Método <b>POST</b>, los mismos 3 encabezados que el atajo de sueño.</li>
          <li>Cuerpo <b>JSON</b>: <span className="font-mono">p_device</span> (texto) = el código de abajo, <span className="font-mono">p_day</span> (texto) = la fecha con formato, <span className="font-mono">p_steps</span> (<b>número</b>) = la suma de pasos.</li>
          <li>Aviso si el iPhone está bloqueado: iOS no deja leer Salud con el móvil bloqueado. Justo después de <b>Calcular estadísticas</b> añade <b>Si</b> → la suma <b>no tiene ningún valor</b> (o es 0) → dentro, <b>Mostrar notificación</b> con el texto «Desbloquea el iPhone para enviar tus pasos» y <b>Detener este atajo</b>; después <b>Fin Si</b>. Así, si el móvil está bloqueado te llega ese aviso en lugar de mandar un 0.</li>
          <li>Automatización a hora fija: en Atajos → <b>Automatización</b> → <b>+</b> → <b>Hora del día</b> (p. ej. 23:00, a diario) → <b>Ejecutar inmediatamente</b> → tu atajo. Crea otra igual a las 23:20 como segundo intento: si la primera te avisó y ya desbloqueaste, la segunda manda los pasos.</li>
        </ol>
        <div className="mt-2 break-all rounded-lg bg-slate-900 p-2 font-mono text-[11px] text-emerald-400">{cfg.deviceId}</div>
        <button className="btn btn-ghost mt-2 w-full !py-2" onClick={() => void copy(cfg.deviceId, 'id3')}><Copy size={14} /> {copied === 'id3' ? 'Copiado' : 'Copiar código (p_device)'}</button>
        <p className="mt-2 text-slate-400">Nota: iOS no permite elegir una app web instalada en la pantalla de inicio en la automatización «Se abre la app», por eso se usa la hora del día. Al abrir la app, muestra los pasos del momento en que se ejecutó el atajo; si vuelves a ejecutarlo, se actualizan.</p>
      </details>

      <details className="rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-semibold text-white">Configuración inicial (una vez)</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4">
          <li>Crea un proyecto gratuito en supabase.com.</li>
          <li>En <b>SQL Editor</b> ejecuta este script (crea la tabla y dos funciones; la tabla no se puede leer de otra forma):</li>
        </ol>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-2 font-mono text-[10px] text-emerald-400">{SQL_SETUP}</pre>
        <button className="btn btn-ghost mt-2 w-full !py-2" onClick={() => void copy(SQL_SETUP, 'sql')}><Copy size={14} /> {copied === 'sql' ? 'Copiado' : 'Copiar script'}</button>
        <ol start={3} className="mt-2 list-decimal space-y-1.5 pl-4">
          <li><b>Project Settings → API</b>: copia la <b>Project URL</b> y la clave <b>anon public</b> (es pública; nunca uses la service_role).</li>
          <li>Pégalas arriba y pulsa «Subir copia a la nube». No hace falta crear ninguna cuenta.</li>
        </ol>
      </details>
    </div>
  );
}
