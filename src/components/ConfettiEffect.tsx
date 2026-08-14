'use client';

import confetti from 'canvas-confetti';

export function triggerConfetti() {
  // Respect reduced-motion preference: skip the particle burst entirely.
  // The Final-4 reveal still shows its (non-animated) result state without it.
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const count = 200;
  const defaults = {
    origin: { y: 0.7 }
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ['#3355FF', '#FF4B3E', '#FFB020']
  });
  fire(0.2, {
    spread: 60,
    colors: ['#2F6FED', '#16A34A', '#ffffff']
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    colors: ['#3355FF', '#FFB020']
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}
