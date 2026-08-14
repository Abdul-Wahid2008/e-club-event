import Link from 'next/link';
import Navbar from '@/src/components/Navbar';
import CountdownTimer from '@/src/components/CountdownTimer';
import { Trophy, Users, ShieldAlert, Award, ArrowRight, Tv } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 w-full">
        {/* HERO SECTION — the one place gradients/display type are allowed (large static headline) */}
        <div className="relative rounded-3xl overflow-hidden bg-white border border-ink-900/10 p-8 sm:p-12 text-center space-y-6 shadow-card-lg">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-blue-50 border border-brand-600/20 text-brand-700 text-xs font-semibold uppercase tracking-wider">
            <Trophy className="w-4 h-4" />
            <span>NIT Warangal Startup Pitching Arena</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-tight">
            <span className="text-ink-900">PITCH UNDER</span>{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-brand-700 to-accent-500">
              PRESSURE
            </span>
          </h1>

          <p className="text-base sm:text-lg text-ink-600 max-w-2xl mx-auto leading-relaxed">
            The ultimate live startup showdown. Fresher founders pitch, expert judges evaluate, and rival teams submit real-time pressure questions for high-stakes points.
          </p>

          {/* Shared Realtime Timer */}
          <div className="max-w-2xl mx-auto pt-2">
            <CountdownTimer />
          </div>

          {/* PORTAL CHOOSER BUTTONS */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/auth/team"
              className="px-6 py-3.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-card transition-colors flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Team Portal (Register / Login)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/staff"
              className="px-6 py-3.5 rounded-xl font-semibold text-sm bg-white hover:bg-surface-base text-ink-900 border border-ink-900/15 transition-colors flex items-center space-x-2"
            >
              <Award className="w-4 h-4 text-ink-600" />
              <span>Judge &amp; Organiser Login</span>
            </Link>

            <Link
              href="/display"
              className="px-6 py-3.5 rounded-xl font-semibold text-sm bg-white hover:bg-surface-base text-ink-900 border border-ink-900/15 transition-colors flex items-center space-x-2"
            >
              <Tv className="w-4 h-4 text-ink-600" />
              <span>Big-Screen Display</span>
            </Link>
          </div>
        </div>

        {/* THREE PORTAL HIGHLIGHTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card rounded-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-ink-900">1. Team Portal</h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              Fresher teams register with any valid email address. Get assigned a random domain &amp; pool (A or B). Vote on rival pitches and submit pressure Q&amp;A questions.
            </p>
          </div>

          <div className="card rounded-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-600 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-ink-900">2. Judge Portal</h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              Judges score live pitches across 4 weighted criteria (Problem/Market, Innovation, Feasibility, Storytelling). Submit locks scores for real-time calculation.
            </p>
          </div>

          <div className="card rounded-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-accent-500 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-ink-900">3. Organiser Room</h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              Full admin control: switch live pitches, run synced timers, approve &amp; score incoming questions, trigger manual overrides with audit logs, and qualify Final 4.
            </p>
          </div>
        </div>

        {/* COMPETITION WEIGHTING FORMULA */}
        <div className="card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center space-x-3">
            <Trophy className="w-6 h-6 text-accent-warm" />
            <h2 className="text-xl font-semibold text-ink-900">Scoring Formula Weightings</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-center">
            <div className="bg-surface-base p-4 rounded-xl border border-ink-900/10">
              <span className="tabular-nums text-xl font-bold text-ink-900 block">20%</span>
              <span className="text-[11px] text-ink-600 font-medium">Problem &amp; Market</span>
            </div>
            <div className="bg-surface-base p-4 rounded-xl border border-ink-900/10">
              <span className="tabular-nums text-xl font-bold text-ink-900 block">20%</span>
              <span className="text-[11px] text-ink-600 font-medium">Solution &amp; Innovation</span>
            </div>
            <div className="bg-surface-base p-4 rounded-xl border border-ink-900/10">
              <span className="tabular-nums text-xl font-bold text-ink-900 block">15%</span>
              <span className="text-[11px] text-ink-600 font-medium">Feasibility</span>
            </div>
            <div className="bg-surface-base p-4 rounded-xl border border-ink-900/10">
              <span className="tabular-nums text-xl font-bold text-ink-900 block">15%</span>
              <span className="text-[11px] text-ink-600 font-medium">Storytelling</span>
            </div>
            <div className="bg-surface-base p-4 rounded-xl border border-ink-900/10">
              <span className="tabular-nums text-xl font-bold text-ink-900 block">20%</span>
              <span className="text-[11px] text-ink-600 font-medium">Audience Rating</span>
            </div>
            <div className="bg-surface-base p-4 rounded-xl border border-ink-900/10">
              <span className="tabular-nums text-xl font-bold text-ink-900 block">10%</span>
              <span className="text-[11px] text-ink-600 font-medium">Q&amp;A Pressure Test</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-ink-900/10 py-6 text-center text-xs text-ink-600">
        Pitch Under Pressure &bull; Live Competition Arena &bull; National Institute of Technology Warangal
      </footer>
    </div>
  );
}
