import { Scale } from 'lucide-react';
import { adaptiveTdee, trainingCheck } from '../lib/adaptiveTdee';
import { bmr, typicalSessionKcal } from '../lib/metabolic';
import { useStore } from '../lib/store';

const DAY = 86_400_000;

/** Compara tu gasto calórico real (lo que comes y cómo cambia tu peso) con el que da la fórmula, y deja ajustar tu actividad. */
export function AdaptiveTdeeCard() {
  const { state, update } = useStore();
  const est = adaptiveTdee(state);
  const now = Date.now();
  const sessions = state.workouts.filter((w) => now - Date.parse(w.startTime) <= 28 * DAY).length;
  const trainDaily = (sessions * typicalSessionKcal(state)) / 28;
  const base = bmr(state.profile);
  const formula = Math.round(base * state.profile.activity + trainDaily);

  if (!est) {
    return (
      <div className="card space-y-1 text-sm text-slate-300">
        <div className="flex items-center gap-2 font-semibold text-white"><Scale size={16} /> Tu gasto real</div>
        <p className="text-xs text-slate-400">Para calcularlo con tus datos hacen falta unos 10 días con comida anotada y 3 pesadas que abarquen dos semanas. Cuando los tengas, te diré cuánto gastas de verdad y si la fórmula acierta.</p>
      </div>
    );
  }

  const check = trainingCheck(est.tdee, base * state.profile.activity, sessions, typicalSessionKcal(state));
  const diff = est.tdee - formula;
  const newActivity = Math.min(2.0, Math.max(1.2, Math.round(((est.tdee - trainDaily) / base) * 100) / 100));
  const close = Math.abs(diff) < 100;

  return (
    <div className="card space-y-2 text-sm text-slate-200">
      <div className="flex items-center gap-2 font-semibold text-white"><Scale size={16} /> Tu gasto real</div>
      <div className="text-2xl font-black text-fuel">{est.tdee} <span className="text-xs font-medium text-slate-400">kcal/día</span></div>
      <p className="text-xs text-slate-400">
        Sale de lo que comes (media de {est.avgIntake} kcal en {est.loggedDays} días anotados) y de cómo ha cambiado tu peso ({est.kgPerWeek > 0 ? '+' : ''}{String(est.kgPerWeek).replace('.', ',')} kg por semana, con {est.weighIns} pesadas). La fórmula de la app daba {formula} kcal.
      </p>
      {close ? (
        <p className="text-xs text-emerald-400">La fórmula y tu gasto real coinciden: tus objetivos están bien calibrados.</p>
      ) : (
        <>
          <p className="text-xs text-amber-300">{diff > 0 ? `Gastas unas ${diff} kcal más de lo que decía la fórmula.` : `Gastas unas ${-diff} kcal menos de lo que decía la fórmula.`} Si anotas todo lo que comes, conviene ajustar tu actividad.</p>
          <button className="btn btn-blue w-full !py-2 text-xs" onClick={() => update((s) => ({ ...s, profile: { ...s.profile, activity: newActivity } }))}>Ajustar mi actividad a {String(newActivity).replace('.', ',')}</button>
        </>
      )}
      {check && (
        <p className={`text-xs ${check.verdict === 'ok' ? 'text-emerald-400' : 'text-amber-300'}`}>
          Entrenos: la app cuenta unas {check.appPerSession} kcal por sesión y tu gasto real sugiere unas {check.impliedPerSession}.{' '}
          {check.verdict === 'ok' ? 'Coinciden bien.' : check.verdict === 'menos' ? 'Es probable que la app esté contando de más al entrenar: no te comas esas kcal extra.' : 'Es probable que la app se quede corta al contar tus entrenos.'}
        </p>
      )}
      <p className="text-[11px] text-slate-500">Si algún día no anotas todo, este cálculo sale más bajo de lo real. Úsalo solo con semanas en las que hayas registrado casi todo.</p>
    </div>
  );
}
