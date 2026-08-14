'use client';

/**
 * Small unobtrusive connection-status dot. Green = subscribed, amber +
 * "Reconnecting..." = channel dropped/errored, gray = connecting.
 * Purely a visual read of the Supabase Realtime channel status callback —
 * no channel/subscription logic changes.
 */
export type ConnState = 'connecting' | 'connected' | 'reconnecting';

export default function ConnectionStatus({ state }: { state: ConnState }) {
  const config = {
    connected: { color: 'bg-success-600', label: 'Live' },
    connecting: { color: 'bg-ink-600/40', label: 'Connecting...' },
    reconnecting: { color: 'bg-accent-warm', label: 'Reconnecting...' },
  }[state];

  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-600">
      <span className="relative flex w-2 h-2">
        {state === 'reconnecting' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-60 motion-reduce:hidden`} />
        )}
        <span className={`relative inline-flex rounded-full w-2 h-2 ${config.color}`} />
      </span>
      <span>{config.label}</span>
    </div>
  );
}
