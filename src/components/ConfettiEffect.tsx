'use client';

import confetti from 'canvas-confetti';

export function triggerConfetti() {
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
    colors: ['#5B7CFA', '#7C3AED', '#FFB020']
  });
  fire(0.2, {
    spread: 60,
    colors: ['#FF4B3E', '#34D399', '#F7F8FC']
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
    colors: ['#5B7CFA', '#FFB020']
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}
