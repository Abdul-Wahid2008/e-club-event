'use client';

import { RotateCw, Home } from 'lucide-react';

// Root-level error boundary: catches any unhandled client exception on the
// public-facing pages (homepage, registration, join-team, auth) that had
// NO error boundary of their own before this -- exactly the highest-traffic
// unauthenticated surface during a WhatsApp-driven registration burst. Only
// the portal routes and /display had this coverage previously.
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 space-y-4 bg-bg-base">
      <h1 className="font-display text-2xl font-bold text-text-primary">Something went wrong</h1>
      <p className="text-sm text-text-secondary max-w-sm">
        This page hit a snag. Your registration (if already submitted) is safe — try again below, or head back home.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-brand-500 hover:bg-brand-500/90 text-white transition-colors shadow-brand-glow"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Try Again
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 text-text-primary border border-panel-border transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          Go Home
        </a>
      </div>
    </div>
  );
}
