import { AnimatePresence, motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/shared/context/ThemeContext';

/** Único interruptor claro/oscuro de la app (header y portal del paciente). */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="pt-icon-btn !h-9 !w-9"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'sun' : 'moon'}
          className="grid place-items-center"
          initial={{ rotate: -80, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 80, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.22 }}
        >
          {isDark ? <Sun className="h-[17px] w-[17px]" strokeWidth={1.75} /> : <Moon className="h-[17px] w-[17px]" strokeWidth={1.75} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
