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
    <header className="sticky top-0 z-50 glass-panel border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-purple via-brand-pink to-brand-cyan flex items-center justify-center shadow-cyan-glow group-hover:scale-105 transition-transform">
              <Flame className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-brand-cyan">
                PITCH UNDER PRESSURE
              </span>
              <span className="block text-[10px] text-gray-400 tracking-widest font-mono uppercase">
                NIT Warangal • Live Event
              </span>
            </div>
          </Link>

          {/* User Role Badge & Navigation */}
          <div className="flex items-center space-x-4">
            {userRole === 'organiser' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brand-pink/20 text-brand-pink border border-brand-pink/40">
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                ORGANISER CONTROL ROOM
              </span>
            )}

            {userRole === 'judge' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brand-purple/20 text-brand-purple border border-brand-purple/40">
                <Award className="w-3.5 h-3.5 mr-1.5" />
                JUDGE PANEL
              </span>
            )}

            {userRole === 'team' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40">
                <Users className="w-3.5 h-3.5 mr-1.5" />
                TEAM: {teamName || 'WARANGAL PITCHER'}
              </span>
            )}

            {userRole ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  Sign Out
                </button>
              </form>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/auth/team"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 transition-colors"
                >
                  Team Login
                </Link>
                <Link
                  href="/auth/staff"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
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
