'use client';

import { RotateCw } from 'lucide-react';

export default function DisplayError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 space-y-4">
      <h1 className="font-display text-3xl font-bold text-text-primary">Broadcast glitched</h1>
      <p className="text-text-secondary max-w-sm">The projector view hit a snag — refresh this screen to reconnect.</p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-500/90 text-white transition-colors shadow-brand-glow"
      >
        <RotateCw className="w-4 h-4" />
        Reconnect
      </button>
    </div>
  );
}
