import { memo, useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  className?: string;
}

/**
 * Transición numérica suave entre valores. Escribe directamente en el nodo DOM
 * (fuera del ciclo de render de React) para evitar re-renders por frame.
 */
export const AnimatedNumber = memo(function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = format(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = format(v);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, format, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
});
