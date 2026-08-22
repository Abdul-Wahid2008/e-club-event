'use client';

import Link from 'next/link';
import { Trophy, Flame, LogOut, ShieldAlert, Users, Award } from 'lucide-react';
import { signOutAction } from '@/src/app/actions/authActions';

interface NavbarProps {
  userRole?: 'team' | 'judge' | 'organiser' | null;
  teamName?: string;
}

export default function Navbar({ userRole, teamName }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 panel border-b border-panel-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 via-accent-live to-accent-warm flex items-center justify-center shadow-brand-glow group-hover:scale-105 transition-transform">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-wide text-text-primary">
                PITCH UNDER PRESSURE
              </span>
              <span className="block text-[10px] text-text-secondary tracking-widest font-mono uppercase">
                NIT Warangal • Live Event
              </span>
            </div>
          </Link>

          {/* User Role Badge & Navigation */}
          <div className="flex items-center space-x-4">
            {userRole === 'organiser' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-accent-live/15 text-accent-live border border-accent-live/40">
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                ORGANISER CONTROL ROOM
              </span>
            )}

            {userRole === 'judge' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brand-500/15 text-brand-500 border border-brand-500/40">
                <Award className="w-3.5 h-3.5 mr-1.5" />
                JUDGE PANEL
              </span>
            )}

            {userRole === 'team' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-pool-a/15 text-pool-a border border-pool-a/40">
                <Users className="w-3.5 h-3.5 mr-1.5" />
                TEAM: {teamName || 'WARANGAL PITCHER'}
              </span>
            )}

            {userRole ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-text-secondary transition-colors border border-panel-border"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  Sign Out
                </button>
              </form>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/auth/team"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 border border-brand-500/30 transition-colors"
                >
                  Team Login
                </Link>
                <Link
                  href="/auth/staff"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-text-secondary border border-panel-border transition-colors"
                >
                  Staff Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
