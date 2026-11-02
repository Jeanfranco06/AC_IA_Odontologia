import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/shared/utils/index';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Etiqueta accesible si `label` no es texto plano. */
  ariaLabel?: string;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  /** 'tabs' expone semántica de pestañas (role=tablist); 'radio' para conmutadores. */
  semantics?: 'tabs' | 'radio';
  className?: string;
  /** id del panel controlado (sólo para semantics='tabs'). */
  controls?: string;
}

const SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 } as const;

/**
 * Control segmentado tipo píldora. La píldora activa se desliza entre opciones
 * mediante `layoutId` (transform), sin animar width/left.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  semantics = 'tabs',
  className,
  controls,
}: SegmentedControlProps<T>) {
  const layoutId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const enabled = options.filter((o) => !o.disabled);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const idx = enabled.findIndex((o) => o.value === value);
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = enabled.length - 1;
    const target = enabled[next];
    onChange(target.value);
    refs.current[options.indexOf(target)]?.focus();
  };

  const isTabs = semantics === 'tabs';

  return (
    <div
      role={isTabs ? 'tablist' : 'radiogroup'}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-1 ring-1 ring-inset ring-slate-200/70',
        'dark:bg-slate-800/70 dark:ring-slate-700/60',
        className
      )}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role={isTabs ? 'tab' : 'radio'}
            aria-selected={isTabs ? active : undefined}
            aria-checked={!isTabs ? active : undefined}
            aria-controls={isTabs ? controls : undefined}
            aria-label={opt.ariaLabel}
            tabIndex={active ? 0 : -1}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={onKeyDown}
            className={cn(
              'relative isolate inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium outline-none transition-colors duration-150',
              'focus-visible:ring-2 focus-visible:ring-teal-600/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-100',
              'disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-[13px]',
              active
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING}
                className="absolute inset-0 -z-10 rounded-md bg-white shadow-sm ring-1 ring-slate-900/[0.06] dark:bg-slate-900 dark:ring-white/10"
                aria-hidden
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
