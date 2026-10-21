import { ArrowRight, Camera, Check, Lightbulb, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import { useScrollLock } from '../lib/scrollLock';
import { useEffect, useRef, useState } from 'react';
import { goalContext } from '../lib/coach';
import { askCoach, type CoachAnswer } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { dayBalance } from '../lib/metabolic';
import { useStore } from '../lib/store';
import { storeList } from '../lib/stores';
import { cx, uid } from '../lib/utils';
import { ErrorBox, MacroPill } from './ui';
import { Hint } from './Hint';

const VERDICT = {
  si: { label: 'Adelante: encaja perfecto', cls: 'bg-emerald-500/15 text-emerald-500' },
  ajustar: { label: 'Con moderación: ajusta la ración', cls: 'bg-amber-500/15 text-amber-500' },
  no: { label: 'No recomendado hoy', cls: 'bg-red-500/15 text-red-400' },
  info: { label: 'Consejo del Coach', cls: 'bg-accent/15 text-accent' },
} as const;

/** Consulta rápida «¿Puedo comer esto?» (parte superior de Hoy): texto, foto y envío. */
const CHAT_KEY = 'apex-coach-chat';
const CHAT_TTL = 12 * 3600000;

const loadTurns = (): Turn[] => {
  try {
    const v = JSON.parse(localStorage.getItem(CHAT_KEY) ?? 'null') as { ts: number; turns: Turn[] } | null;
    return v && Date.now() - v.ts < CHAT_TTL ? v.turns.filter((t) => t.ans || t.err) : [];
  } catch {
    return [];
  }
};

/** Consulta rápida «¿Puedo comer esto?» (parte superior de Hoy). La conversación se conserva hasta que pulses «Nueva conversación». */
export function AskCoachBar() {
  const [q, setQ] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ q: string; file: File | null } | null>(null);
  const [turns, setTurns] = useState<Turn[]>(loadTurns);
  const camRef = useRef<HTMLInputElement>(null);
  const can = q.trim().length > 0 || !!photo;

  useEffect(() => {
    try {
      if (turns.length === 0) localStorage.removeItem(CHAT_KEY);
      else localStorage.setItem(CHAT_KEY, JSON.stringify({ ts: Date.now(), turns: turns.filter((t) => t.ans || t.err) }));
    } catch {
      /* sin almacenamiento */
    }
  }, [turns]);

  const send = () => {
    if (!can) return;
    setPending({ q: q.trim(), file: photo });
    setOpen(true);
    setQ('');
    setPhoto(null);
  };

  return (
    <>
      <div className="card !p-2">
        <div className="flex items-center gap-2">
          <Sparkles size={20} strokeWidth={1.5} className="ml-2 shrink-0 text-accent" />
          <input
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base font-medium text-white outline-none placeholder:text-slate-500"
            placeholder={turns.length ? 'Sigue la conversación…' : '¿Puedo comer esto? (helado, 3 galletas, pizza…)'}
            value={q}
            enterKeyHint="send"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            aria-label="Pregunta al Coach"
          />
          <button className="shrink-0 rounded-xl bg-slate-800 p-2.5 text-slate-300 active:scale-95" onClick={() => camRef.current?.click()} aria-label="Adjuntar foto del producto o la carta">
            <Camera size={20} strokeWidth={1.75} />
          </button>
          <button className="shrink-0 rounded-xl bg-accent p-2.5 text-white active:scale-95 disabled:opacity-40" disabled={!can} onClick={send} aria-label="Enviar consulta">
            <ArrowRight size={20} strokeWidth={2} />
          </button>
        </div>
        {photo && (
          <div className="mx-2 mb-1 mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
            Foto adjunta <button onClick={() => setPhoto(null)} aria-label="Quitar foto"><X size={13} /></button>
          </div>
        )}
        {turns.length > 0 && (
          <div className="mx-2 mt-1 flex items-center justify-between border-t border-slate-800 pt-2 text-xs text-slate-400">
            <button className="font-semibold text-accent" onClick={() => { setPending(null); setOpen(true); }}>Conversación en curso · {turns.length} mensaje{turns.length === 1 ? '' : 's'}</button>
            <button className="flex items-center gap-1 text-slate-400" onClick={() => setTurns([])} aria-label="Nueva conversación"><RotateCcw size={12} strokeWidth={1.75} /> Nueva</button>
          </div>
        )}
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (camRef.current) camRef.current.value = ''; if (f) setPhoto(f); }} />
      </div>
      {open && <AnswerModal turns={turns} setTurns={setTurns} pending={pending} onClose={() => setOpen(false)} />}
    </>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Consultando al Coach">
      <div className="h-7 w-2/3 rounded-full bg-slate-800" />
      <div className="h-4 w-full rounded bg-slate-800" />
      <div className="h-4 w-5/6 rounded bg-slate-800" />
      <div className="h-16 w-full rounded-xl bg-slate-800" />
    </div>
  );
}

/** Área realmente visible (descontando el teclado de iOS) mediante la API visualViewport. */
function useVisualViewport(): { height: number; top: number; keyboard: boolean } {
  const read = () => {
    const v = window.visualViewport;
    return { height: v?.height ?? window.innerHeight, top: v?.offsetTop ?? 0 };
  };
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const v = window.visualViewport;
    const on = () => {
      setVp(read());
      window.scrollTo(0, 0); // iOS desplaza la página al enfocar un campo
    };
    v?.addEventListener('resize', on);
    v?.addEventListener('scroll', on);
    return () => {
      v?.removeEventListener('resize', on);
      v?.removeEventListener('scroll', on);
    };
  }, []);
  return { ...vp, keyboard: window.innerHeight - vp.height > 120 };
}

interface Turn {
  id: string;
  q: string;
  photo: boolean;
  ans?: CoachAnswer;
  err?: string;
  added?: boolean;
}

/** Conversación con el Coach: varias preguntas y respuestas seguidas, con memoria de lo dicho. */
function AnswerModal({ turns, setTurns, pending, onClose }: { turns: Turn[]; setTurns: React.Dispatch<React.SetStateAction<Turn[]>>; pending: { q: string; file: File | null } | null; onClose: () => void }) {
  const { state, update } = useStore();
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const b = dayBalance(state);
  const vp = useVisualViewport();

  // Mientras el chat está abierto se oculta la barra de navegación y se bloquea el scroll de la página.
  useScrollLock();
  useEffect(() => {
    document.body.classList.add('chat-open');
    return () => document.body.classList.remove('chat-open');
  }, []);

  const send = async (q: string, f: File | null, prior: Turn[]) => {
    const id = uid();
    setTurns([...prior, { id, q, photo: !!f }]);
    setBusy(true);
    try {
      // La foto vive solo en memoria durante la consulta y se descarta al terminar.
      let b64: string | null = f ? await compressToBase64(f) : null;
      const history = prior.filter((t) => t.ans).map((t) => ({ q: t.q, a: t.ans as CoachAnswer }));
      const r = await askCoach(state.settings, q, b64, goalContext(state, dayBalance(state)), storeList(state.defaultSupermarket, state.supermarkets), state.defaultSupermarket, state.settings.kneeSafe, history);
      b64 = null;
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, ans: r } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, err: e instanceof Error ? e.message : 'Error desconocido' } : x)));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (pending) void send(pending.q, pending.file, turns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const eat = (t: Turn) => {
    const a = t.ans;
    if (!a?.kcal) return;
    update((s) => ({ ...s, meals: [...s.meals, { id: uid(), ts: Date.now(), plato: t.q.slice(0, 40) || 'Consulta al Coach', calorias: a.kcal ?? 0, proteinas: a.proteinas ?? 0, carbs: a.carbs ?? 0, grasas: a.grasas ?? 0 }] }));
    setTurns((all) => all.map((x) => (x.id === t.id ? { ...x, added: true } : x)));
  };

  const submit = () => {
    if (busy || (!input.trim() && !photo)) return;
    const q = input.trim();
    const f = photo;
    setInput('');
    setPhoto(null);
    void send(q, f, turns);
  };

  return (
    <div className="fixed left-0 right-0 z-[70] mx-auto flex max-w-xl flex-col bg-slate-900" style={{ top: vp.top, height: vp.height }} role="dialog" aria-label="Chat con el Coach">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 pb-2" style={{ paddingTop: vp.keyboard ? 8 : 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
        <h3 className="flex items-center gap-2 text-lg font-bold text-white"><Sparkles size={18} strokeWidth={1.5} className="text-accent" /> Coach</h3>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300" onClick={() => setTurns([])} aria-label="Nueva conversación"><RotateCcw size={14} strokeWidth={1.75} /> Nueva</button>
          <button className="rounded-full bg-slate-800 p-2" onClick={onClose} aria-label="Cerrar chat"><X size={18} /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-slate-800 p-2"><div className="text-sm font-bold text-white">{Math.max(0, b.remaining)}</div><div className="text-slate-400">kcal restantes</div></div>
        <div className="rounded-xl bg-slate-800 p-2"><div className="text-sm font-bold text-white">{Math.max(0, b.proteinRemaining)} g</div><div className="text-slate-400">proteína</div></div>
        <div className="rounded-xl bg-slate-800 p-2"><div className="text-sm font-bold text-white">{b.trainingDay ? 'Entreno' : 'Descanso'}</div><div className="text-slate-400">hoy</div></div>
      </div>

      {!state.settings.geminiKey && <ErrorBox msg="Falta la clave de Gemini (Ajustes, apartado Clave de Gemini)." />}

      <div className="space-y-4 pb-2">
        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm text-white">
              {t.q || 'Consulta con foto'}{t.photo ? ' (con foto)' : ''}
            </div>
            {!t.ans && !t.err && state.settings.geminiKey && <Skeleton />}
            {t.err && <ErrorBox msg={t.err} />}
            {t.ans && (
              <div className="space-y-3 rounded-2xl rounded-bl-md border border-slate-700 p-3">
                <span className={cx('inline-block rounded-full px-3 py-1 text-sm font-bold', VERDICT[t.ans.veredicto].cls)}>{VERDICT[t.ans.veredicto].label}</span>
                <p className="text-sm leading-relaxed text-slate-200">{t.ans.motivo}</p>
                {t.ans.alternativa && (
                  <div className="flex gap-2 rounded-xl bg-accent/10 p-3 text-sm text-slate-200">
                    <Lightbulb size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
                    <span>{t.ans.alternativa}</span>
                  </div>
                )}
                {t.ans.kcal ? (
                  <>
                    <div className="text-sm text-slate-400">Estimado: <b className="text-white">{t.ans.kcal} kcal</b></div>
                    <div className="flex gap-2">
                      <MacroPill label="Prot" value={t.ans.proteinas ?? 0} color="text-accent" />
                      <MacroPill label="Carbs" value={t.ans.carbs ?? 0} color="text-amber-400" />
                      <MacroPill label="Grasas" value={t.ans.grasas ?? 0} color="text-pink-400" />
                    </div>
                    <button className="btn btn-green w-full" disabled={t.added} onClick={() => eat(t)}>
                      {t.added ? <><Check size={16} strokeWidth={2} /> Registrado en tu día</> : <><Plus size={16} strokeWidth={1.75} /> Comer y registrar</>}
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      </div>

      <div className="shrink-0 border-t border-slate-700 bg-slate-900 px-3 pt-3" style={{ paddingBottom: vp.keyboard ? 12 : 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
        {photo && <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">Foto adjunta <button onClick={() => setPhoto(null)} aria-label="Quitar foto"><X size={13} /></button></div>}
        <div className="flex items-center gap-2">
          <input className="field !py-2.5" placeholder="Sigue preguntando…" value={input} enterKeyHint="send" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} aria-label="Siguiente pregunta" />
          <button className="shrink-0 rounded-xl bg-slate-800 p-2.5 text-slate-300 active:scale-95" onClick={() => camRef.current?.click()} aria-label="Adjuntar foto"><Camera size={20} strokeWidth={1.75} /></button>
          <button className="shrink-0 rounded-xl bg-accent p-2.5 text-white active:scale-95 disabled:opacity-40" disabled={busy || (!input.trim() && !photo)} onClick={submit} aria-label="Enviar"><ArrowRight size={20} strokeWidth={2} /></button>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (camRef.current) camRef.current.value = ''; if (f) setPhoto(f); }} />
        <Hint className="mt-1.5 text-[11px] text-slate-500">La conversación se guarda hasta que pulses «Nueva». Cada mensaje es una petición a Gemini y el Coach recuerda los últimos intercambios.</Hint>
      </div>
    </div>
  );
}
