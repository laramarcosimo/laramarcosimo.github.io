import { useId } from 'react';
import { BACK_ONLY, FRONT_ONLY, type MuscleKey } from '../lib/muscles';

export type Motion = 'swing-front' | 'swing-side' | 'hip-circle' | 'arm-circles' | 'chest-open' | 'dislocates';

const PRIMARY = '#10B981';
const SECONDARY = '#6EE7B7';

/**
 * Mapa muscular anatómico dibujado en código (0 KB de red): silueta de frente y de espalda con los músculos diana iluminados.
 * Con `motion` anima la zona (balanceos, círculos…) sobre la misma silueta.
 */
export function BodyMap({ primary, secondary = [], view = 'auto', motion, className, label }: { primary: MuscleKey[]; secondary?: MuscleKey[]; view?: 'auto' | 'both' | 'front' | 'back'; motion?: Motion; className?: string; label?: string }) {
  const uid = useId();
  const fill = (k: MuscleKey): string => (primary.includes(k) ? PRIMARY : secondary.includes(k) ? SECONDARY : 'var(--bm-base, #475569)');
  const all = [...primary, ...secondary];
  const hasFront = all.some((k) => FRONT_ONLY.includes(k));
  const hasBack = all.some((k) => BACK_ONLY.includes(k));
  const v = motion ? (motion === 'swing-front' ? 'side' : 'front') : view !== 'auto' ? view : hasFront && hasBack ? 'both' : hasBack ? 'back' : 'front';
  const base = 'var(--bm-base, #475569)';

  const m = (key: MuscleKey, rest: React.ReactNode) => <g fill={fill(key)}>{rest}</g>;

  const rot = (values: string, dur: string, extra?: React.ReactNode) => (
    <>
      <animateTransform attributeName="transform" type="rotate" values={values} dur={dur} repeatCount="indefinite" calcMode="spline" keyTimes={values.split(';').map((_, i, a) => (i / (a.length - 1)).toFixed(3)).join(';')} keySplines={values.split(';').slice(1).map(() => '.45 0 .55 1').join(';')} />
      {extra}
    </>
  );

  const arm = (side: 'L' | 'R', key: 'biceps' | 'triceps') => {
    const left = side === 'L';
    const px = left ? 25 : 75;
    const anim =
      motion === 'arm-circles' ? <animateTransform attributeName="transform" type="rotate" values={`0 ${px} 43;${left ? 360 : -360} ${px} 43`} dur="2.4s" repeatCount="indefinite" />
      : motion === 'chest-open' ? rot(`0 ${px} 43;${left ? 80 : -80} ${px} 43;0 ${px} 43`, '2.6s')
      : motion === 'dislocates' ? rot(`0 ${px} 43;${left ? 175 : -175} ${px} 43;0 ${px} 43`, '3.6s')
      : null;
    return (
      <g>
        {anim}
        {m(key, <rect x={left ? 19 : 72} y="47" width="9" height="23" rx="4.5" />)}
        {m('forearms', <rect x={left ? 17.5 : 74} y="71" width="8.5" height="24" rx="4" />)}
        <ellipse cx={left ? 21.7 : 78.3} cy="98" rx="4" ry="4.5" fill={base} />
      </g>
    );
  };

  const leg = (side: 'L' | 'R', back: boolean) => {
    const left = side === 'L';
    const x = left ? 35.5 : 50.5;
    const cx = left ? 43 : 57;
    const swing = !back && !left
      ? motion === 'swing-side' ? rot(`0 ${cx} 99;30 ${cx} 99;0 ${cx} 99;-14 ${cx} 99;0 ${cx} 99`, '2.4s')
        : motion === 'hip-circle' ? (<>{rot(`-16 ${cx} 99;0 ${cx} 99;16 ${cx} 99;0 ${cx} 99;-16 ${cx} 99`, '2.6s')}<animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 -9;0 0;0 -9;0 0" dur="2.6s" repeatCount="indefinite" /></>)
        : null
      : null;
    return (
      <g>
        {swing}
        {m(back ? 'hamstrings' : 'quads', <rect x={x} y={back ? 103 : 99} width="14" height={back ? 37 : 40} rx="7" />)}
        {m('calves', <rect x={left ? 37 : 52.5} y="141" width="10.5" height="38" rx="5" />)}
        <ellipse cx={left ? 42 : 58} cy="183" rx="6" ry="3" fill={base} />
      </g>
    );
  };

  const front = (
    <g>
      <ellipse cx="50" cy="15" rx="9.5" ry="11.5" fill={fill('face')} />
      <rect x="45" y="25" width="10" height="7" rx="3" fill={fill('neck')} />
      {m('shoulders', <><circle cx="30" cy="40" r="8.5" /><circle cx="70" cy="40" r="8.5" /></>)}
      {m('chest', <><ellipse cx="41" cy="47" rx="10.5" ry="8" /><ellipse cx="59" cy="47" rx="10.5" ry="8" /></>)}
      {m('obliques', <><rect x="34" y="58" width="8" height="24" rx="4" /><rect x="58" y="58" width="8" height="24" rx="4" /></>)}
      {m('abs', <rect x="43" y="57" width="14" height="26" rx="5" />)}
      {m('hip', <ellipse cx="50" cy="92" rx="17" ry="7.5" />)}
      {arm('L', 'biceps')}
      {arm('R', 'biceps')}
      {leg('L', false)}
      {leg('R', false)}
    </g>
  );

  const back = (
    <g>
      <ellipse cx="50" cy="15" rx="9.5" ry="11.5" fill={base} />
      <rect x="45" y="25" width="10" height="7" rx="3" fill={fill('neck')} />
      {m('shoulders', <><circle cx="30" cy="40" r="8.5" /><circle cx="70" cy="40" r="8.5" /></>)}
      {m('traps', <path d="M50 28L66 38L58 51L50 47L42 51L34 38Z" />)}
      {m('lats', <><path d="M35 49L48 53L47 75L37 71Z" /><path d="M65 49L52 53L53 75L63 71Z" /></>)}
      {m('lowerBack', <rect x="42" y="72" width="16" height="13" rx="4" />)}
      {m('hip', <ellipse cx="50" cy="86" rx="17" ry="4" />)}
      {m('glutes', <><ellipse cx="42.5" cy="95" rx="9.5" ry="8.5" /><ellipse cx="57.5" cy="95" rx="9.5" ry="8.5" /></>)}
      {arm('L', 'triceps')}
      {arm('R', 'triceps')}
      {leg('L', true)}
      {leg('R', true)}
    </g>
  );

  // Vista lateral (balanceos de pierna adelante y atrás).
  const side = (
    <g>
      <ellipse cx="52" cy="15" rx="9.5" ry="11.5" fill={base} />
      <rect x="47" y="25" width="10" height="7" rx="3" fill={base} />
      {m('shoulders', <circle cx="51" cy="41" r="8" />)}
      <rect x="43" y="34" width="16" height="56" rx="8" fill={base} />
      {m('abs', <rect x="51" y="52" width="8" height="30" rx="4" />)}
      <rect x="47" y="46" width="8" height="40" rx="4" fill={base} opacity=".55" />
      {m('hip', <circle cx="51" cy="92" r="9.5" />)}
      <g>
        <rect x="45" y="97" width="12" height="42" rx="6" fill={base} />
        <rect x="45.5" y="140" width="10" height="38" rx="5" fill={base} />
        <ellipse cx="54" cy="182" rx="8" ry="3" fill={base} />
      </g>
      <g>
        {motion === 'swing-front' && rot('0 51 92;38 51 92;0 51 92;-34 51 92;0 51 92', '2.4s')}
        {m('glutes', <ellipse cx="43" cy="92" rx="7" ry="9" />)}
        {m('hamstrings', <rect x="42" y="97" width="9" height="42" rx="4.5" />)}
        {m('quads', <rect x="51" y="97" width="9" height="42" rx="4.5" />)}
        {m('calves', <rect x="45.5" y="140" width="10" height="38" rx="5" />)}
        <ellipse cx="56" cy="182" rx="8" ry="3" fill={base} />
      </g>
    </g>
  );

  const vb = v === 'both' ? '0 0 200 200' : '0 0 100 200';
  return (
    <svg viewBox={vb} className={className} role="img" aria-label={label ?? 'Mapa muscular'} aria-describedby={uid} preserveAspectRatio="xMidYMid meet">
      <desc id={uid}>{label}</desc>
      {v === 'both' ? (
        <>
          {front}
          <g transform="translate(100 0)">{back}</g>
        </>
      ) : v === 'back' ? back : v === 'side' ? side : front}
    </svg>
  );
}
