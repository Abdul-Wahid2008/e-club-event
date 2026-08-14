/**
 * Colorblind-safe Pool A / Pool B identity badge.
 *
 * Contrast rule (WCAG relative luminance, verified manually):
 *  - white text on solid pool-b (#F2994A) is only ~2.2:1 — fails even AA.
 *  - white text on solid pool-a (#2F6FED) is ~4.55:1 — AA-large only.
 * So both pools render as a light tint chip with dark ink text plus a solid
 * dot in the pool hue — never a solid-fill badge with white text. This also
 * keeps opacity/overlay dilution from washing the hue out when pools sit
 * side by side (e.g. leaderboard rows, team cards).
 */
export default function PoolBadge({ pool, className = '' }: { pool: 'A' | 'B'; className?: string }) {
  const isA = pool === 'A';
  const tint = isA ? 'bg-blue-50 text-ink-900 border-pool-a/40' : 'bg-orange-50 text-ink-900 border-pool-b/40';
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
