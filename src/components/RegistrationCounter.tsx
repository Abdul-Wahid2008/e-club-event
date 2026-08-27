'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import AnimatedNumber from './AnimatedNumber';

const POLL_INTERVAL_MS = 45_000;

/**
 * Aggregate-only social-proof counter for the homepage. Fetches a head-only
 * COUNT (no team names/rows) via periodic polling, NOT a Realtime
 * subscription -- every homepage visitor opening their own persistent
 * Realtime WebSocket connection just for this counter would, under a
 * WhatsApp-driven burst of hundreds of simultaneous visitors, eat into
 * Supabase's Realtime connection budget and risk degrading the portals'
 * actual live features (scoring/timer updates) during the real event, for
 * a nice-to-have that doesn't need sub-second freshness. A single cheap
 * indexed count query every 45s is imperceptible to the visitor and adds
 * zero persistent-connection load.
 */
export default function RegistrationCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchCount = async () => {
      const { count: teamCount } = await supabase
        .from('teams')
        .select('id', { count: 'exact', head: true });
      setCount(teamCount ?? 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  if (count === null) return null;

  return (
    <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-accent-warm/10 border border-accent-warm/30 text-accent-warm text-xs font-bold">
      <Flame className="w-3.5 h-3.5" />
      <span>
        <AnimatedNumber value={count} className="tabular-nums" /> team{count === 1 ? '' : 's'} & solo pitchers registered so far
      </span>
    </div>
  );
}
