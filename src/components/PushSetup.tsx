import { BellRing, Check, Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { isConnected, readCloud } from '../lib/cloud';
import { disablePush, enablePush, pushEnabled, pushSchedule, pushSupported } from '../lib/push';
import { PUSH_FUNCTION, pushCronSql, pushSql, slugFromUrl } from '../lib/pushSetup';
import { ErrorBox } from './ui';
import { Hint } from './Hint';

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      <button
        className="btn btn-ghost w-full !py-2 text-xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setOk(true);
            setTimeout(() => setOk(false), 2500);
          } catch {
            /* sin portapapeles: se puede seleccionar el texto de abajo */
          }
        }}
      >
        {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? 'Copiado' : label}
      </button>
      <details className="mt-1"><summary className="cursor-pointer text-[11px] text-slate-500">Ver el texto</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-2 font-mono text-[10px] text-emerald-400">{text}</pre></details>
    </div>
  );
}

/** Avisos con la app cerrada (notificaciones push) a través de tu Supabase gratuito. */
export function PushSetup() {
  const [on, setOn] = useState(pushEnabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [test, setTest] = useState(false);
  const [fnUrl, setFnUrl] = useState('');
  const [jwtKey, setJwtKey] = useState('');
  const c = readCloud();
  const connected = isConnected();

  const enable = async () => {
    setBusy(true);
    setErr('');
    try {
      await enablePush();
      setOn(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo activar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl bg-slate-800/60 p-3">
      <div className="flex items-center gap-2 text-sm font-bold text-white"><BellRing size={16} className="text-accent" /> Avisos con la app cerrada</div>
      <Hint className="text-xs text-slate-400">En iPhone una app no puede avisarte sola cuando está cerrada: lo hace un servidor. Usa tu Supabase gratuito (el mismo de la copia en la nube) y sirve para el fin de descanso, la cena tras entrenar, las medidas, la proteína de la tarde y las caducidades.</Hint>
      {!pushSupported() && <p className="text-xs text-amber-500">Aquí no están disponibles. En iPhone: instala la app («Añadir a pantalla de inicio», iOS 16.4+) y ábrela desde el icono.</p>}
      {!connected && <p className="text-xs text-amber-500">Primero configura la copia en la nube (URL y clave pública) en Ajustes → «Copias de seguridad y datos».</p>}
      {connected && !on && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Guía paso a paso (una sola vez)</div>
          <div className="space-y-2 text-xs text-slate-400">
            <p><b className="text-slate-200">Paso 1 · Entra en Supabase.</b> Abre supabase.com, inicia sesión y pulsa en tu proyecto (el mismo que usas para la copia en la nube).</p>
            <p><b className="text-slate-200">Paso 2 · El SQL.</b> 1) Pulsa aquí abajo «1 · Copiar el SQL». 2) En Supabase, en el menú de la izquierda, entra en <b>SQL Editor</b> y pulsa <b>New query</b>. 3) Pega el texto en el cuadro grande (mantén pulsado → Pegar). 4) Pulsa el botón verde <b>Run</b>. Debe decir «Success». Si dice error de «extension», ve a <b>Database → Extensions</b>, activa <b>pg_cron</b> y <b>pg_net</b> y vuelve a pulsar Run.</p>
          </div>
          <CopyBlock label="1 · Copiar el SQL" text={pushSql(c.url, c.anonKey)} />
          <div className="space-y-2 text-xs text-slate-400">
            <p><b className="text-slate-200">Paso 3 · La función.</b> 1) Pulsa aquí abajo «2 · Copiar el código de la función». 2) En Supabase, menú de la izquierda → <b>Edge Functions</b> → <b>Deploy a new function</b> (o «Create a new function») → <b>Via Editor</b>. 3) En el nombre escribe exactamente <b>apex-push</b>. 4) Borra el texto de ejemplo, pega el código copiado y pulsa <b>Deploy function</b>. Espera a que termine. 5) <b>Importante:</b> abre la función y, en su configuración (<b>Details</b> / <b>Function configuration</b>), apaga el interruptor <b>Verify JWT</b> y guarda. Si no, Supabase rechaza las llamadas con «401 UNUSABLE_CREDENTIAL».</p>
          </div>
          <CopyBlock label="2 · Copiar el código de la función" text={PUSH_FUNCTION} />
          <div className="space-y-1.5 rounded-lg bg-slate-900/60 p-2 text-xs text-slate-400">
            <p><b className="text-slate-200">Paso 3b · Dirección de la función.</b> Supabase le pone a la función una dirección propia (por ejemplo «quick-handler») aunque la hayas llamado apex-push. En Edge Functions pulsa el icono de copiar junto a la URL de tu función y pégala aquí:</p>
            <input className="field !py-2 text-xs" placeholder="https://…supabase.co/functions/v1/…" value={fnUrl} onChange={(e) => setFnUrl(e.target.value)} autoCapitalize="none" aria-label="URL de la función" />
            {fnUrl && !slugFromUrl(fnUrl) && <p className="text-amber-500">No encuentro «/functions/v1/…» en ese texto: pega la URL completa.</p>}
            <p>Si en la comprobación sale <b>401</b>, Supabase no acepta tu clave nueva para llamar a la función. Solución segura: en Supabase → <b>Project Settings → API Keys</b> → pestaña <b>«Legacy anon, service_role API keys»</b> → copia la clave <b>anon</b> (empieza por <b>eyJ</b>) y pégala aquí (solo se usa para generar el SQL):</p>
            <input className="field !py-2 text-xs" placeholder="eyJ… (clave anon antigua, opcional)" value={jwtKey} onChange={(e) => setJwtKey(e.target.value)} autoCapitalize="none" aria-label="Clave anon antigua" />
            {slugFromUrl(fnUrl) && <><p>Dirección de tu función: «{slugFromUrl(fnUrl)}». Copia este SQL y ejecútalo (SQL Editor → New query → Run); sustituye al programador.</p><CopyBlock label="3b · Copiar el SQL del programador" text={pushCronSql(c.url, jwtKey.trim() || c.anonKey, slugFromUrl(fnUrl))} /></>}
          </div>
          <p className="text-xs text-slate-400"><b className="text-slate-200">Paso 4 · Actívalo.</b> Espera unos 20 segundos, vuelve a esta pantalla (abierta desde el icono de la app en tu iPhone) y pulsa «Activar avisos». Cuando iOS pregunte, pulsa <b>Permitir</b>. Después podrás enviar un aviso de prueba.</p>
          <button className="btn btn-blue w-full" disabled={busy} onClick={() => void enable()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />} Activar avisos</button>
        </div>
      )}
      {on && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-fuel"><Check size={15} /> Activados en este iPhone</p>
          <button className="btn btn-ghost w-full !py-2 text-xs" disabled={test} onClick={() => { setTest(true); void pushSchedule('test', 'Prueba de aviso', 'Si lo ves, los avisos con la app cerrada funcionan.', Date.now() + 60000); }}>{test ? 'Aviso de prueba en 1 minuto: cierra la app y espera' : 'Enviar aviso de prueba (llega en 1 minuto)'}</button>
          <button className="w-full text-center text-xs text-slate-500 underline" onClick={() => { disablePush(); setOn(false); }}>Desactivar en este dispositivo</button>
        </div>
      )}
      {err && <ErrorBox msg={err} />}
    </div>
  );
}
