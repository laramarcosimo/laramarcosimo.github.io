import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';

export function ThemeToggle() {
  const { light, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label="Cambiar tema" className="rounded-full bg-slate-800 p-2.5 text-slate-300 active:scale-90">
      {light ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
