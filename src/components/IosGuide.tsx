import { ChevronDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { dayKey } from '../lib/utils';
import { Hint } from './Hint';

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-2">
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">{n}</span>
    <span>{children}</span>
  </li>
);

const Fold = ({ id, title, open, setOpen, children }: { id: string; title: string; open: string | null; setOpen: (v: string | null) => void; children: React.ReactNode }) => (
  <div className="rounded-xl bg-slate-800">
    <button className="flex w-full items-center justify-between gap-2 p-3 text-left font-semibold text-white" aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
      <span>{title}</span>
      <ChevronDown size={16} className={open === id ? 'rotate-180 transition-transform' : 'transition-transform'} />
    </button>
    {open === id && <div className="px-3 pb-3">{children}</div>}
  </div>
);

/** Guía para sincronizar el sueño con el modo «No molestar» mediante Atajos de iOS. */
export function IosGuide() {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const base = window.location.origin;
  const url = `${base}/?logSleep=HORAS&date=AAAA-MM-DD`;
  const stepsUrl = `${base}/?logSteps=PASOS&date=AAAA-MM-DD`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* portapapeles no disponible */
    }
  };
  const test = () => {
    window.location.href = `${window.location.origin}/?logSleep=7.5&date=${dayKey()}`;
  };

  return (
    <div className="space-y-3 text-sm text-slate-300">
      <p className="font-semibold text-white">Sincroniza pasos y sueño con Apple Salud (Atajos)</p>
      <Hint className="text-xs text-slate-400">En iPhone una web no puede leer el sueño sola, pero Atajos puede avisar a la app cuando termina «No molestar» y esta registra las horas.</Hint>

      <Fold id="f0" title="Paso 1 · Al activar «No molestar» (noche)" open={open} setOpen={setOpen}>
        <Hint className="mb-2 text-xs text-slate-400">Se dispara con «No molestar» o «Descanso» (Concentración).</Hint>

        <ol className="space-y-1.5 text-xs">
          <Step n={1}>Atajos → <b>Automatización</b> → <b>+</b> → <b>Concentración</b> → «No molestar» (o «Dormir») → <b>Se activa</b> → «Ejecutar inmediatamente».</Step>
          <Step n={2}>Acción <b>Obtener fecha actual</b>.</Step>
          <Step n={3}>Acción <b>Guardar archivo</b> en Atajos con nombre <code>dnd_inicio.txt</code> y «Sobrescribir si existe» activado.</Step>
        </ol>
      </Fold>

      <Fold id="f1" title="Paso 2 · Al desactivarlo (mañana)" open={open} setOpen={setOpen}>

        <ol className="space-y-1.5 text-xs">
          <Step n={1}>Nueva automatización de Concentración → <b>Se desactiva</b> → «Ejecutar inmediatamente».</Step>
          <Step n={2}><b>Obtener archivo</b> <code>dnd_inicio.txt</code> → <b>Obtener texto del archivo</b> → <b>Obtener fechas del texto</b>.</Step>
          <Step n={3}><b>Obtener tiempo entre fechas</b> (inicio y fecha actual) en <b>Horas</b>, y <b>Redondear</b> a 1 decimal.</Step>
          <Step n={4}>Acción <b>URL</b> con el enlace de abajo, sustituyendo HORAS por el resultado y la fecha por la actual (formato AAAA-MM-DD), y <b>Abrir URL</b>.</Step>
        </ol>
        <div className="mt-2 break-all rounded-lg bg-slate-900 p-2 font-mono text-[11px] text-emerald-400">{url}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="btn btn-ghost !py-2" onClick={() => void copy()}>{copied ? '¡Copiado!' : 'Copiar enlace'}</button>
          <button className="btn btn-ghost !py-2" onClick={test}><ExternalLink size={14} /> Probar (7,5 h)</button>
        </div>
      </Fold>
      <Fold id="f2" title="Automatización de pasos (a última hora del día)" open={open} setOpen={setOpen}>

        <ol className="space-y-1.5 text-xs">
          <Step n={1}>Atajos → <b>Automatización</b> → <b>+</b> → <b>Hora del día</b> (p. ej. 22:30, a diario) → «Ejecutar inmediatamente».</Step>
          <Step n={2}>Acción <b>Buscar muestras de Salud</b>: tipo <b>Pasos</b>, fecha de inicio «es hoy», agrupar por <b>Día</b>.</Step>
          <Step n={3}>Acción <b>Calcular estadísticas</b> → <b>Suma</b> (o usa el valor del grupo).</Step>
          <Step n={4}>Acción <b>URL</b> con el enlace de abajo, sustituyendo PASOS por el resultado, y <b>Abrir URL</b>.</Step>
        </ol>
        <div className="mt-2 break-all rounded-lg bg-slate-900 p-2 font-mono text-[11px] text-emerald-400">{stepsUrl}</div>
        <button className="btn btn-ghost mt-2 w-full !py-2" onClick={() => { window.location.href = `${base}/?logSteps=8500&date=${dayKey()}`; }}><ExternalLink size={14} /> Probar (8.500 pasos)</button>
      </Fold>

      <Fold id="f3" title="Lista de la compra: Recordatorios → despensa" open={open} setOpen={setOpen}>

        <ol className="space-y-1.5 text-xs">
          <Step n={1}>Atajos → <b>+</b> (nuevo atajo) → acción <b>Buscar recordatorios</b>: lista «Compra», «Está completado: no».</Step>
          <Step n={2}>Acción <b>Obtener nombres</b> de los recordatorios y <b>Combinar texto</b> con «Nueva línea».</Step>
          <Step n={3}>Acción <b>Codificar URL</b> y luego <b>URL</b> con el enlace de abajo (sustituye TEXTO por el resultado) → <b>Abrir URL</b>.</Step>
          <Step n={4}>La app abre una pantalla para revisar: desmarca lo que no quieras y pulsa «Añadir a la despensa».</Step>
        </ol>
        <div className="mt-2 break-all rounded-lg bg-slate-900 p-2 font-mono text-[11px] text-emerald-400">{base}/?importList=TEXTO</div>
        <Hint className="mt-2 text-xs text-slate-400">Si el Atajo no funciona, usa Despensa → Lista de la compra → Importar: pega el texto o sube capturas de la lista.</Hint>
      </Fold>

      <Fold id="f4" title="Lista de la compra: app → Recordatorios" open={open} setOpen={setOpen}>

        <ol className="space-y-1.5 text-xs">
          <Step n={1}>Crea un atajo llamado exactamente <b>Compra a Recordatorios</b>.</Step>
          <Step n={2}>Acciones: <b>Recibir texto como entrada</b> → <b>Dividir texto</b> (nueva línea) → <b>Repetir con cada elemento</b> → <b>Añadir recordatorio</b> (lista «Compra»).</Step>
          <Step n={3}>En la app, el botón «A Recordatorios» de la lista de la compra ejecuta ese atajo.</Step>
        </ol>
      </Fold>

      <Hint className="text-xs text-slate-500">Consejo: abre la app instalada desde su icono la primera vez. Si no usas Atajos, registra el sueño a mano en Hoy («Ir a dormir» / «Despertar»).</Hint>
    </div>
  );
}
