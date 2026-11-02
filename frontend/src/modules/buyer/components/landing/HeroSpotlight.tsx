import React from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  useReducedMotion,
  type MotionValue,
} from 'motion/react';

interface HeroSpotlightProps {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}

export function HeroSpotlight({ mouseX, mouseY }: HeroSpotlightProps) {
  const shouldReduceMotion = useReducedMotion();

  // Inercia suave con resortes físicos
  const smoothX = useSpring(mouseX, { damping: 28, stiffness: 160, mass: 0.15 });
  const smoothY = useSpring(mouseY, { damping: 28, stiffness: 160, mass: 0.15 });

  const spotlightBackground = useMotionTemplate`radial-gradient(680px circle at ${smoothX}px ${smoothY}px, rgba(15, 118, 110, 0.085), rgba(45, 212, 191, 0.03) 40%, transparent 75%)`;

  if (shouldReduceMotion) {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_30%,rgba(15,118,110,0.06),transparent_70%)]"
        aria-hidden
      />
    );
  }

  return (
    <motion.div
      style={{
        background: spotlightBackground,
      }}
      className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
      aria-hidden
    />
  );
}
