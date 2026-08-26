'use client';

import { RotateCw } from 'lucide-react';

export default function TeamPortalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 space-y-4">
      <h1 className="font-display text-2xl font-bold text-text-primary">Something glitched on the Team Portal</h1>
      <p className="text-sm text-text-secondary max-w-sm">This screen hit a snag. It&apos;s isolated to this page — refresh to pick back up where you left off.</p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-brand-500 hover:bg-brand-500/90 text-white transition-colors shadow-brand-glow"
      >
        <RotateCw className="w-3.5 h-3.5" />
        Try Again
      </button>
    </div>
  );
}
