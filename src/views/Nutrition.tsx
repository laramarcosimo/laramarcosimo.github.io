import { Soup, Sparkles, UtensilsCrossed } from 'lucide-react';
import { ChefChat } from '../components/ChefChat';
import { useState } from 'react';
import { Blocks } from '../components/Blocks';
import { DefaultStore } from '../components/DefaultStore';
import { DiaryTab } from '../components/DiaryTab';
import { MealTemplates } from '../components/MealTemplates';
import { NutritionCalendar } from '../components/NutritionCalendar';
import { Tuppers } from '../components/Tuppers';
import { Title } from '../components/ui';
import { cx } from '../lib/utils';

type Sub = 'diario' | 'tuppers';
const KEY = 'apex-nutri-tab';
const TABS: { id: Sub; label: string; Icon: typeof Soup }[] = [
  { id: 'diario', label: 'Diario de hoy', Icon: UtensilsCrossed },
  { id: 'tuppers', label: 'Tuppers y recetas', Icon: Soup },
];

export default function Nutrition() {
  const [sub, setSub] = useState<Sub>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'tuppers' ? v : 'diario'; // «plan» se fusionó con el diario
    } catch {
      return 'diario';
    }
  });
  const [coach, setCoach] = useState(false);
  const pick = (s: Sub) => {
    setSub(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-4">
      <Title sub="Foto efímera: nunca se guarda">Nutrición</Title>
      <DefaultStore />

      {/* Control segmentado estilo iOS */}
      <div className="-mt-2 grid grid-cols-2 gap-1 rounded-2xl bg-slate-800 p-1" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={sub === id} onClick={() => pick(id)} className={cx('flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-semibold leading-tight transition', sub === id ? 'bg-slate-900 text-accent shadow' : 'text-slate-400')}>
            <Icon size={18} strokeWidth={sub === id ? 2 : 1.5} />
            {label}
          </button>
        ))}
      </div>

      <button className="btn btn-ghost w-full" onClick={() => setCoach(true)}><Sparkles size={16} /> Preguntar al Coach</button>
      {coach && <ChefChat onClose={() => setCoach(false)} />}

      {sub === 'diario' && (
        <>
          <DiaryTab />
          <NutritionCalendar />
        </>
      )}
      {sub === 'tuppers' && <Blocks page="nutri-tuppers" items={{ tuppers: <Tuppers />, platos: <MealTemplates /> }} />}
    </div>
  );
}
