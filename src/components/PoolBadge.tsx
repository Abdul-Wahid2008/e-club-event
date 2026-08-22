/**
 * Colorblind-safe Pool A / Pool B identity badge.
 *
 * Both pools render as a tinted chip with high-contrast text plus a solid
 * dot in the pool hue, never a solid-fill badge with a low-contrast text
 * color — keeps the badge legible against the dark panel background and
 * keeps opacity/overlay dilution from washing the hue out when pools sit
 * side by side (e.g. leaderboard rows, team cards).
 */
export default function PoolBadge({ pool, className = '' }: { pool: 'A' | 'B'; className?: string }) {
  const isA = pool === 'A';
  const tint = isA
    ? 'bg-pool-a/15 text-pool-a border-pool-a/40'
    : 'bg-pool-b/15 text-pool-b border-pool-b/40';
  const dot = isA ? 'bg-pool-a' : 'bg-pool-b';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${tint} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
      Pool {pool}
    </span>
  );
}
