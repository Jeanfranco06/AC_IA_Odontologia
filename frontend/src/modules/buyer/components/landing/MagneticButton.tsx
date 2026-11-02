import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}

export function MagneticButton({
  children,
  className = '',
  strength = 0.28,
  onClick,
  type = 'button',
  disabled,
  title,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Física de resorte calibrada (damping: 15, stiffness: 150)
  const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (shouldReduceMotion || disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;

    x.set(deltaX);
    y.set(deltaY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      title={title}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        x: shouldReduceMotion ? 0 : springX,
        y: shouldReduceMotion ? 0 : springY,
        willChange: 'transform',
      }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
      className={`cursor-pointer transition-shadow ${className}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
