/**
 * Static (non-animated-by-default) loading placeholder for Realtime-fed
 * views. Uses a subtle one-shot CSS shimmer instead of an infinite pulse so
 * it reads as "loading" without becoming ambient background motion once
 * data arrives (the element unmounts as soon as real content is ready).
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-ink-900/[0.06] motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card rounded-2xl p-6 space-y-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

export function SkeletonLeaderboardRow() {
  return (
    <div className="rounded-xl border border-ink-900/10 bg-white p-4 flex items-center justify-between gap-3">
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-6 w-14" />
    </div>
  );
}
