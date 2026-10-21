import { Cloud, Download, FileText, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { isConnected } from '../lib/cloud';
import { autoDeletePhotos, deletePhotosOf, deleteReport, deleteReportCloud, enforceRetention, listReports, restoreReports, setAutoDeletePhotos, type ReportRec } from '../lib/reports';
import { cx } from '../lib/utils';

const kb = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1000))} kB`);
const KIND: Record<ReportRec['kind'], string> = { mes: 'Mes', anio: 'Año', fotos: 'Fotos' };

/** Archivo de informes PDF: los guarda la app al generarlos y los borra según su caducidad. */
export function ReportsArchive() {
  const [list, setList] = useState<ReportRec[]>([]);
  const [auto, setAuto] = useState(autoDeletePhotos());
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setList(await listReports().catch(() => [])), []);
  useEffect(() => {
    void load();
  }, [load]);

  const open = async (r: ReportRec) => {
    const file = new File([r.blob], `${r.id}.pdf`, { type: 'application/pdf' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: r.label });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const remove = async (r: ReportRec) => {
    if (!confirm(`¿Borrar «${r.label}»? Se quita del móvil${r.cloud ? ' y de la nube' : ''}.`)) return;
    await deleteReport(r.id);
    if (r.cloud && isConnected()) await deleteReportCloud(r.id).catch(() => undefined);
    await load();
  };
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg('');
    try {
      setMsg(await fn());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo completar.');
    } finally {
      setBusy(false);
      await load();
    }
  };
  const total = list.reduce((a, r) => a + r.bytes, 0);

  return (
    <div className="space-y-2 border-t border-slate-800 pt-3">
      <div className="label">Archivo de informes PDF</div>
      <p className="text-xs text-slate-400">Al generar un informe se guarda aquí solo. El del <b>mes</b> se conserva durante ese año; el del <b>año</b> y el <b>PDF de fotos</b>, 3 años (también en tu nube, en trozos pequeños y sin gastar casi espacio). Los caducados se borran solos.</p>
      {list.length === 0 && <p className="text-xs text-slate-500">Aún no hay informes guardados. Genera uno desde Entreno (informe del mes o del año) o desde Progreso (PDF de fotos).</p>}
      {list.map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2">
          <FileText size={16} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{r.label}</div>
            <div className="text-[11px] text-slate-400">{KIND[r.kind]} · {kb(r.bytes)} · {new Date(r.ts).toLocaleDateString('es-ES')} {r.cloud && <Cloud size={11} className="inline text-emerald-500" aria-label="Copia en la nube" />}</div>
          </div>
          <button className="rounded-lg bg-slate-700 p-2 text-slate-100 active:scale-95" onClick={() => void open(r)} aria-label={`Abrir o compartir ${r.label}`}><Download size={15} /></button>
          <button className="p-2 text-slate-500" onClick={() => void remove(r)} aria-label={`Borrar ${r.label}`}><Trash2 size={15} /></button>
        </div>
      ))}
      {list.filter((r) => r.kind === 'fotos' && r.from !== undefined).map((r) => (
        <button key={`del-${r.id}`} className="btn btn-ghost w-full !py-2 text-xs text-red-400" disabled={busy} onClick={() => run(async () => { if (!confirm(`¿Borrar del móvil y de la nube las fotos incluidas en «${r.label}»? Quedan solo en el PDF.`)) return ''; const n = await deletePhotosOf(r); return `${n} foto${n === 1 ? '' : 's'} borrada${n === 1 ? '' : 's'}. Quedan en el PDF guardado.`; })}>
          Borrar las fotos incluidas en «{r.label}» (quedan en el PDF)
        </button>
      ))}
      <label className="flex items-start justify-between gap-3 text-sm">
        <span>Borrar solas las fotos de años anteriores cuando su PDF esté guardado<span className="block text-[11px] text-slate-500">Libera espacio en el móvil y en la nube. Los PDF se quedan 3 años.</span></span>
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={auto} onChange={(e) => { setAuto(e.target.checked); setAutoDeletePhotos(e.target.checked); if (e.target.checked) void enforceRetention().then(load); }} />
      </label>
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{list.length} informe{list.length === 1 ? '' : 's'} · {kb(total)} en el móvil</span>
        <button className={cx('font-semibold text-accent', busy && 'opacity-40')} disabled={busy || !isConnected()} onClick={() => void run(async () => { const n = await restoreReports(); return n ? `${n} informe${n === 1 ? '' : 's'} recuperado${n === 1 ? '' : 's'} de la nube.` : 'No hay informes nuevos en la nube.'; })}>Recuperar de la nube</button>
      </div>
      {msg && <p className="text-xs text-slate-300">{msg}</p>}
    </div>
  );
}
