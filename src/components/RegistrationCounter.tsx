'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import AnimatedNumber from './AnimatedNumber';

/**
 * Aggregate-only social-proof counter for the homepage. Fetches a head-only
 * COUNT (no team names/rows) and refreshes on Realtime team-table changes --
 * cheap enough to run on every homepage load even during a traffic burst,
 * since it's a single indexed count query, not a full row fetch.
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

    const channel = supabase
      .channel('homepage_registration_counter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchCount())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
