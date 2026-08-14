'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the user's prefers-reduced-motion setting so components can fall
 * back to non-animated states. Framer Motion variants/transitions should be
 * swapped out (not just have their duration zeroed) when this is true.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}
