import { useTheme } from '@/shared/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/20 active:scale-[0.98] cursor-pointer"
    >
      {isDark ? (
        <Sun className="h-[15px] w-[15px] text-amber-400 transition-transform duration-200" strokeWidth={1.75} />
      ) : (
        <Moon className="h-[15px] w-[15px] text-slate-600 transition-transform duration-200" strokeWidth={1.75} />
      )}
    </button>
  );
}
