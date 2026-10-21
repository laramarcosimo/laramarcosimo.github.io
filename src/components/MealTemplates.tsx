import { BookOpen, Bookmark, Check, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { availability, logTemplate } from '../lib/templates';
import type { MealTemplate } from '../lib/types';
import { cx, uid } from '../lib/utils';
import { Modal, NumInput } from './ui';

export type TemplateDraft = Omit<MealTemplate, 'id'>;

export const emptyDraft = (): TemplateDraft => ({ name: '', calorias: 0, proteinas: 0, carbs: 0, grasas: 0, ingredientes: [] });

/** Crear una plantilla de comida (también desde una comida ya registrada). */
export function TemplateModal({ initial, editId, onClose }: { initial?: TemplateDraft; /** Si se indica, se edita esa plantilla en vez de crear una nueva. */ editId?: string; onClose: () => void }) {
  const { state, update } = useStore();
  const [f, setF] = useState<TemplateDraft>(initial ?? emptyDraft());
  const [extra, setExtra] = useState('');
  const toggle = (n: string) => setF((x) => ({ ...x, ingredientes: x.ingredientes.includes(n) ? x.ingredientes.filter((i) => i !== n) : [...x.ingredientes, n] }));
  const addExtra = () => {
    const n = extra.trim();
    if (n && !f.ingredientes.includes(n)) setF({ ...f, ingredientes: [...f.ingredientes, n] });
    setExtra('');
  };
  const save = () => {
    const clean = { ...f, name: f.name.trim(), receta: f.receta?.trim() || undefined };
    update((s) => ({ ...s, mealTemplates: editId ? s.mealTemplates.map((t) => (t.id === editId ? { ...t, ...clean } : t)) : [...s.mealTemplates, { ...clean, id: uid() }] }));
    onClose();
  };
  return (
    <Modal title={editId ? 'Editar plato' : 'Guardar comida'} onClose={onClose}>
      <div className="space-y-3">
        <input className="field" placeholder="Nombre (ej: Avena con yogur y plátano)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="grid grid-cols-4 gap-2">
          {([['calorias', 'kcal'], ['proteinas', 'Prot g'], ['carbs', 'Carbs g'], ['grasas', 'Grasas g']] as const).map(([k, l]) => (
            <div key={k}>
              <label className="label">{l}</label>
              <NumInput value={f[k]} className="field text-center" onChange={(n) => setF({ ...f, [k]: n })} />
            </div>
          ))}
        </div>
        <div>
          <div className="label">Ingredientes (de tu despensa)</div>
          <div className="flex flex-wrap gap-2">
            {state.pantry.map((p) => {
              const on = f.ingredientes.includes(p.name);
              return (
                <button key={p.id} onClick={() => toggle(p.name)} className={cx('rounded-full px-3 py-1.5 text-sm font-semibold active:scale-95', on ? 'bg-fuel text-slate-950' : 'bg-slate-800 text-slate-300')}>
                  {on && <Check size={13} strokeWidth={2} className="mr-1 inline" />}{p.name}
                </button>
              );
            })}
            {f.ingredientes.filter((i) => !state.pantry.some((p) => p.name === i)).map((i) => (
              <button key={i} onClick={() => toggle(i)} className="rounded-full bg-fuel px-3 py-1.5 text-sm font-semibold text-slate-950"><Check size={13} strokeWidth={2} className="mr-1 inline" />{i}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input className="field" placeholder="Otro ingrediente…" value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addExtra()} />
            <button className="btn btn-ghost" onClick={addExtra} disabled={!extra.trim()} aria-label="Añadir ingrediente"><Plus size={16} /></button>
          </div>
        </div>
        <div>
          <label className="label">Receta (opcional)</label>
          <textarea rows={5} className="field text-sm" placeholder="Pasos, tiempos, trucos… (ej: 1. Sofríe la cebolla 5 min…)" value={f.receta ?? ''} onChange={(e) => setF({ ...f, receta: e.target.value })} />
        </div>
        <button className="btn btn-green w-full" disabled={!f.name.trim() || !f.calorias} onClick={save}>{editId ? 'Guardar cambios' : 'Guardar plantilla'}</button>
      </div>
    </Modal>
  );
}

/** Biblioteca de comidas guardadas: registro con un toque, con aviso de qué ingredientes tienes. */
export function MealTemplates() {
  const { state, update } = useStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MealTemplate | null>(null);
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-white"><Bookmark size={18} strokeWidth={1.5} className="text-accent" /> Mis platos frecuentes</h3>
        <button className="text-sm font-semibold text-fuel" onClick={() => setCreating(true)}><Plus size={14} className="inline" /> Nuevo plato</button>
      </div>
      {state.mealTemplates.length === 0 && <p className="text-sm text-slate-500">Guarda tus comidas habituales (también desde el Diario, al editar una comida).</p>}
      <div className="space-y-2">
        {state.mealTemplates.map((t) => {
          const a = availability(t, state.pantry);
          return (
            <div key={t.id} className="rounded-xl bg-slate-800 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-slate-400">{t.calorias} kcal · P {t.proteinas} · C {t.carbs} · G {t.grasas}</div>
                  {t.ingredientes.length > 0 && (
                    <div className={cx('mt-1 flex items-center gap-1 text-[11px] font-semibold', a.have ? 'text-emerald-500' : 'text-amber-500')}>
                      {a.have ? <><Check size={12} strokeWidth={2} /> Tienes todos los ingredientes</> : <>Faltan: {a.missing.join(', ')}</>}
                    </div>
                  )}
                  {t.receta?.trim() && (
                    <button className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-accent" onClick={() => setOpenRecipe(openRecipe === t.id ? null : t.id)} aria-expanded={openRecipe === t.id}>
                      <BookOpen size={13} /> {openRecipe === t.id ? 'Ocultar receta' : 'Ver receta'}
                    </button>
                  )}
                </div>
                <button className="p-1.5 text-slate-400" onClick={() => setEditing(t)} aria-label={`Editar ${t.name}`}><Pencil size={15} /></button>
                <button className="p-1.5 text-slate-500" onClick={() => update((s) => ({ ...s, mealTemplates: s.mealTemplates.filter((x) => x.id !== t.id) }))} aria-label="Borrar plantilla"><Trash2 size={15} /></button>
              </div>
              {openRecipe === t.id && t.receta?.trim() && <div className="mt-2 whitespace-pre-line rounded-lg bg-slate-900 p-3 text-sm leading-relaxed text-slate-200">{t.receta}</div>}
              <button className="btn btn-green mt-2 w-full !py-2" onClick={() => { update((s) => logTemplate(s, t)); setDone(t.id); setTimeout(() => setDone(null), 1800); }}>
                {done === t.id ? <><Check size={16} strokeWidth={2} /> Registrada</> : <><UtensilsCrossed size={16} strokeWidth={1.75} /> Comer hoy</>}
              </button>
            </div>
          );
        })}
      </div>
      {creating && <TemplateModal onClose={() => setCreating(false)} />}
      {editing && <TemplateModal key={editing.id} editId={editing.id} initial={{ name: editing.name, calorias: editing.calorias, proteinas: editing.proteinas, carbs: editing.carbs, grasas: editing.grasas, ingredientes: editing.ingredientes, slots: editing.slots, receta: editing.receta }} onClose={() => setEditing(null)} />}
    </div>
  );
}
