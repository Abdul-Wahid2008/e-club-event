'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import Navbar from '@/src/components/Navbar';
import Footer from '@/src/components/Footer';
import CountdownTimer from '@/src/components/CountdownTimer';
import { Flame, Trophy, Users, ShieldAlert, Award, ArrowRight, Zap, Target, MessageSquare } from 'lucide-react';
import { usePrefersReducedMotion } from '@/src/lib/useReducedMotion';

const HeroShard = dynamic(() => import('@/src/components/HeroShard'), { ssr: false });

const weightings = [
  { label: 'Problem & Market', pct: '20%', color: 'text-brand-500' },
  { label: 'Solution & Innovation', pct: '20%', color: 'text-brand-500' },
  { label: 'Feasibility', pct: '15%', color: 'text-brand-500' },
  { label: 'Storytelling', pct: '15%', color: 'text-brand-500' },
  { label: 'Audience Rating', pct: '20%', color: 'text-accent-warm' },
  { label: 'Q&A Pressure Test', pct: '10%', color: 'text-accent-live' },
];

export default function LandingPage() {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 w-full">
        {/* HERO SECTION */}
        <div className="relative rounded-3xl overflow-hidden panel p-8 sm:p-12 text-center space-y-6">
          <HeroShard className="absolute inset-0 -z-[1] opacity-70" />

          <motion.div
            initial={reduced ? undefined : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-500 text-xs font-bold uppercase tracking-wider"
          >
            <Flame className="w-4 h-4" />
            <span>NIT Warangal Startup pitching arena</span>
          </motion.div>

          {/* PERFORMANCE: this headline is almost certainly the LCP element
              on this page. Rendered plain (no Framer Motion entrance
              animation, no opacity/transform delay) so it counts as
              "painted" the moment it hits the DOM instead of after a
              0.1s-delay + 0.5s fade-in transition — confirmed via Speed
              Insights field data that LCP was running ~1.5s behind raw
              server TTFB on real mobile traffic. */}
          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-text-primary max-w-4xl mx-auto leading-tight">
            THE PITCH <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-500 via-accent-live to-accent-warm">LEAGUE</span>
          </h1>

          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            The ultimate live startup showdown. Fresher founders pitch, expert judges evaluate, and rival teams submit real-time pressure questions for high-stakes points.
          </p>

          <div className="max-w-2xl mx-auto pt-2">
            <CountdownTimer realtime={false} />
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/auth/team"
              className="px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-brand-500 to-blue-600 hover:from-brand-500/90 hover:to-blue-600/90 text-white shadow-brand-glow transition-all flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Team Portal (Register / Login)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/staff"
              className="px-6 py-3.5 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-text-primary border border-panel-border transition-all flex items-center space-x-2"
            >
              <Award className="w-4 h-4 text-accent-warm" />
              <span>Judge & Organiser Login</span>
            </Link>
          </div>

          <p className="text-xs text-text-secondary">
            Already have a join code?{' '}
            <Link href="/auth/team?intent=join" className="text-brand-500 font-semibold hover:underline">
              Join your teammate&apos;s team
            </Link>
          </p>
        </div>

        {/* THREE PORTAL HIGHLIGHTS */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.12 } } }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            { icon: Users, title: '1. Team Portal', iconWrap: 'bg-brand-500/10 text-brand-500 border-brand-500/30', hoverBorder: 'hover:border-brand-500/40', desc: 'Fresher teams register with any valid email address. Get assigned a random domain & pool (A or B). Vote on rival pitches and submit pressure Q&A questions.' },
            { icon: Award, title: '2. Judge Portal', iconWrap: 'bg-brand-500/10 text-brand-500 border-brand-500/30', hoverBorder: 'hover:border-brand-500/40', desc: 'Judges score live pitches across 4 weighted criteria (Problem/Market, Innovation, Feasibility, Storytelling). Submit locks scores for real-time calculation.' },
            { icon: ShieldAlert, title: '3. Organiser Room', iconWrap: 'bg-accent-live/10 text-accent-live border-accent-live/30', hoverBorder: 'hover:border-accent-live/40', desc: 'Full admin control: switch live pitches, run synced timers, approve & score incoming questions, trigger manual overrides with audit logs, and qualify Final 4.' },
          ].map((card) => (
            <motion.div
              key={card.title}
              variants={{ hidden: reduced ? {} : { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className={`card rounded-2xl p-6 transition-all space-y-4 ${card.hoverBorder}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${card.iconWrap}`}>
                <card.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-text-primary">{card.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* COMPETITION WEIGHTING FORMULA */}
        <div className="panel rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center space-x-3">
            <Trophy className="w-6 h-6 text-accent-warm" />
            <h2 className="text-xl font-bold text-text-primary">Scoring Formula Weightings</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-center">
            {weightings.map((w) => (
              <div key={w.label} className="bg-white/[0.03] p-4 rounded-xl border border-panel-border">
                <span className={`text-xl font-extrabold block ${w.color}`}>{w.pct}</span>
                <span className="text-[11px] text-text-secondary font-medium">{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
