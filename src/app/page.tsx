import Link from 'next/link';
import Navbar from '@/src/components/Navbar';
import CountdownTimer from '@/src/components/CountdownTimer';
import { Flame, Trophy, Users, ShieldAlert, Award, ArrowRight, Zap, Target, MessageSquare } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 w-full">
        {/* HERO SECTION */}
        <div className="relative rounded-3xl overflow-hidden glass-panel p-8 sm:p-12 border border-surface-border text-center space-y-6">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-cyan/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-bold uppercase tracking-wider">
            <Flame className="w-4 h-4 animate-bounce" />
            <span>NIT Warangal Startup pitching arena</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            PITCH UNDER <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-cyan via-brand-pink to-brand-gold text-glow-cyan">PRESSURE</span>
          </h1>

          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
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
              className="px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-brand-cyan to-blue-600 hover:from-brand-cyan/90 hover:to-blue-600/90 text-black shadow-cyan-glow transition-all flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Team Portal (Register / Login)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/staff"
              className="px-6 py-3.5 rounded-xl font-bold text-sm bg-surface-card hover:bg-gray-800 text-white border border-gray-700 transition-all flex items-center space-x-2"
            >
              <Award className="w-4 h-4 text-brand-purple" />
              <span>Judge & Organiser Login</span>
            </Link>
          </div>
        </div>

        {/* THREE PORTAL HIGHLIGHTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-surface-border hover:border-brand-cyan/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center border border-brand-cyan/30">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">1. Team Portal</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Fresher teams register with any valid email address. Get assigned a random domain & pool (A or B). Vote on rival pitches and submit pressure Q&A questions.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-surface-border hover:border-brand-purple/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-brand-purple/10 text-brand-purple flex items-center justify-center border border-brand-purple/30">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">2. Judge Portal</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Judges score live pitches across 4 weighted criteria (Problem/Market, Innovation, Feasibility, Storytelling). Submit locks scores for real-time calculation.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-surface-border hover:border-brand-pink/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-brand-pink/10 text-brand-pink flex items-center justify-center border border-brand-pink/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">3. Organiser Room</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Full admin control: switch live pitches, run synced timers, approve & score incoming questions, trigger manual overrides with audit logs, and qualify Final 4.
            </p>
          </div>
        </div>

        {/* COMPETITION WEIGHTING FORMULA */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-surface-border space-y-6">
          <div className="flex items-center space-x-3">
            <Trophy className="w-6 h-6 text-brand-gold" />
            <h2 className="text-xl font-bold text-white">Scoring Formula Weightings</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-center">
            <div className="bg-gray-900/90 p-4 rounded-xl border border-gray-800">
              <span className="text-xl font-extrabold text-brand-cyan block">20%</span>
              <span className="text-[11px] text-gray-400 font-medium">Problem & Market</span>
            </div>
            <div className="bg-gray-900/90 p-4 rounded-xl border border-gray-800">
              <span className="text-xl font-extrabold text-brand-cyan block">20%</span>
              <span className="text-[11px] text-gray-400 font-medium">Solution & Innovation</span>
            </div>
            <div className="bg-gray-900/90 p-4 rounded-xl border border-gray-800">
              <span className="text-xl font-extrabold text-brand-cyan block">15%</span>
              <span className="text-[11px] text-gray-400 font-medium">Feasibility</span>
            </div>
            <div className="bg-gray-900/90 p-4 rounded-xl border border-gray-800">
              <span className="text-xl font-extrabold text-brand-cyan block">15%</span>
              <span className="text-[11px] text-gray-400 font-medium">Storytelling</span>
            </div>
            <div className="bg-gray-900/90 p-4 rounded-xl border border-gray-800">
              <span className="text-xl font-extrabold text-brand-gold block">20%</span>
              <span className="text-[11px] text-gray-400 font-medium">Audience Rating</span>
            </div>
            <div className="bg-gray-900/90 p-4 rounded-xl border border-gray-800">
              <span className="text-xl font-extrabold text-brand-pink block">10%</span>
              <span className="text-[11px] text-gray-400 font-medium">Q&A Pressure Test</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-surface-border py-6 text-center text-xs text-gray-500 font-mono">
        Pitch Under Pressure • Live Competition Arena • National Institute of Technology Warangal
      </footer>
    </div>
  );
}
