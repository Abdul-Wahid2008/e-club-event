'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LogOut, ShieldAlert, Users, Award } from 'lucide-react';
import { signOutAction } from '@/src/app/actions/authActions';
import PoolBadge from '@/src/components/PoolBadge';

interface NavbarProps {
  userRole?: 'team' | 'judge' | 'organiser' | null;
  teamName?: string;
  teamPool?: 'A' | 'B';
}

export default function Navbar({ userRole, teamName, teamPool }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-ink-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand: icon-only logo + plain UI-text label, no stylized wordmark */}
          <Link href="/" className="flex items-center space-x-3 group shrink-0">
            <Image
              src="/logo-icon.png"
              alt="Pitch Under Pressure"
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl object-contain"
              priority
            />
            <div className="hidden sm:block">
              <span className="font-semibold text-base text-ink-900 leading-tight block">
                Pitch Under Pressure
              </span>
              <span className="block text-[11px] text-ink-600 leading-tight">
                NIT Warangal &bull; Live Event
              </span>
            </div>
          </Link>

          {/* User Role Badge & Navigation */}
          <div className="flex items-center space-x-3">
            {userRole === 'organiser' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-ink-900 border border-accent-500/30">
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-accent-500" />
                Organiser Control Room
              </span>
            )}

            {userRole === 'judge' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-ink-900 border border-brand-600/30">
                <Award className="w-3.5 h-3.5 mr-1.5 text-brand-600" />
                Judge Panel
              </span>
            )}

            {userRole === 'team' && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-ink-900 border border-brand-600/30">
                <Users className="w-3.5 h-3.5 text-brand-600" />
                {teamName || 'Team Portal'}
                {teamPool && <PoolBadge pool={teamPool} />}
              </span>
            )}

            {userRole ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-base hover:bg-ink-900/10 text-ink-600 transition-colors border border-ink-900/10"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  Sign Out
                </button>
              </form>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/auth/team"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors"
                >
                  Team Login
                </Link>
                <Link
                  href="/auth/staff"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-base hover:bg-ink-900/10 text-ink-900 border border-ink-900/10 transition-colors"
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
