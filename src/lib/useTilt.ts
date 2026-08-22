'use client';

import { useRef } from 'react';
import { usePrefersReducedMotion } from '@/src/lib/useReducedMotion';

const MAX_TILT_DEG = 6;

/**
 * Cursor-following 3D tilt on a card via CSS custom properties, pure
 * transform — no library. Disabled entirely under prefers-reduced-motion.
 * Attach the returned handlers + ref to any element with the `tilt-card`
 * class from globals.css.
 */
export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();

  const onPointerMove = (e: React.PointerEvent<T>) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.setProperty('--tilt-x', `${px * MAX_TILT_DEG * 2}deg`);
    ref.current.style.setProperty('--tilt-y', `${-py * MAX_TILT_DEG * 2}deg`);
  };

  const onPointerLeave = () => {
    if (!ref.current) return;
    ref.current.style.setProperty('--tilt-x', '0deg');
    ref.current.style.setProperty('--tilt-y', '0deg');
  };

  return { ref, onPointerMove, onPointerLeave };
}
