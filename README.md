# The Pitch League 🚀

A real-time live event platform built for college startup pitching competitions at **National Institute of Technology Warangal (NIT Warangal)**.

Featuring three real-time synchronized portals (Team, Judge, Organiser) powered by **Next.js App Router**, **Tailwind CSS**, **Supabase (Postgres, Auth, Realtime)**, and **Framer Motion**.

---

## 🌟 Tech Stack & Features

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Framer Motion, Canvas Confetti.
- **Backend & Database**: Supabase Postgres + Supabase Realtime + Supabase Auth.
- **Domain-Gated Auth**: Staff (judge/organiser) accounts are restricted to official `@student.nitw.ac.in` addresses, enforced client- and server-side. Team (fresher) registration accepts any syntactically valid email address, since incoming freshers may not yet have an institute email — enforced by format validation only, client- and server-side.
- **Three Portals**:
  1. **Team Portal**: Registration with random domain & auto-balanced pool (A/B), live event rival voting (1–5 sliders) and question submission, question status tracker, and team journey analytics.
  2. **Judge Portal**: Pitch evaluation rubric (1–10 sliders), locked scores, judge progress indicator (e.g. `4/6 judges submitted`), and context view of approved Q&A.
  3. **Organiser Portal**: Registrations tab (CSV export), Live Control panel (flip live pitch & synced countdown timer), Question Queue (approve/reject/score), Live animated Leaderboard, Manual Override (with audit logging), and "Reveal Final 4" qualification tool with confetti.
- **Authoritative SQL Scoring Engine**:
  - Problem & Market: 20%
  - Solution & Innovation: 20%
  - Feasibility & Business: 15%
  - Pitch & Storytelling: 15%
  - Audience Rating: 20% (with per-voter min-max normalization in SQL view `pitch_leaderboard`)
  - Pressure Test / Q&A: 10% (scaled points)

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- Node.js v18.x or v20.x
- npm or pnpm

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
```

---

## ⚡ Supabase Setup (Free Tier)

### 1. Create a Free Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, name it `pitch-under-pressure`, select a region close to your users, and set a database password.

### 2. Run Database Migrations
1. Open your Supabase Dashboard -> **SQL Editor**.
2. Click **New Query**.
3. Copy the full contents of `supabase/migrations/20260809000000_initial_schema.sql` and run it.
   - This creates all 12 Postgres tables, RLS policies, Realtime publication, and the `pitch_leaderboard` scoring view.

### 3. Seed Initial Domains & Event State
1. In the **SQL Editor**, open another **New Query**.
2. Copy the contents of `supabase/seed.sql` and execute it.
   - This seeds the 14 startup domains, prelim/final rounds, and single-row `event_state`.

### 4. Create Organiser & Judge Accounts
1. Go to Supabase Dashboard -> **Authentication** -> **Users** -> **Add User**.
2. Create the Organiser account:
   - Email: `organiser@student.nitw.ac.in`
   - Password: Choose a secure password (e.g. `OrganiserPassword123!`)
3. Create 5–6 Judge accounts:
   - `judge1@student.nitw.ac.in` (Password: `JudgePassword123!`)
   - `judge2@student.nitw.ac.in` (Password: `JudgePassword123!`)
   - `judge3@student.nitw.ac.in` (Password: `JudgePassword123!`)
   - `judge4@student.nitw.ac.in` (Password: `JudgePassword123!`)
   - `judge5@student.nitw.ac.in` (Password: `JudgePassword123!`)
   - `judge6@student.nitw.ac.in` (Password: `JudgePassword123!`)
4. In the **SQL Editor**, link these Auth UUIDs to the `profiles` and `judges` tables:

```sql
-- Replace 'UUID_HERE' with the generated Auth User UUIDs from the Auth table
INSERT INTO public.profiles (id, email, role, full_name) VALUES
  ('ORGANISER_UUID', 'organiser@student.nitw.ac.in', 'organiser', 'Event Organiser'),
  ('JUDGE1_UUID', 'judge1@student.nitw.ac.in', 'judge', 'Judge 1'),
  ('JUDGE2_UUID', 'judge2@student.nitw.ac.in', 'judge', 'Judge 2'),
  ('JUDGE3_UUID', 'judge3@student.nitw.ac.in', 'judge', 'Judge 3'),
  ('JUDGE4_UUID', 'judge4@student.nitw.ac.in', 'judge', 'Judge 4'),
  ('JUDGE5_UUID', 'judge5@student.nitw.ac.in', 'judge', 'Judge 5'),
  ('JUDGE6_UUID', 'judge6@student.nitw.ac.in', 'judge', 'Judge 6');

INSERT INTO public.judges (auth_user_id, name, email) VALUES
  ('JUDGE1_UUID', 'Judge 1', 'judge1@student.nitw.ac.in'),
  ('JUDGE2_UUID', 'Judge 2', 'judge2@student.nitw.ac.in'),
  ('JUDGE3_UUID', 'Judge 3', 'judge3@student.nitw.ac.in'),
  ('JUDGE4_UUID', 'Judge 4', 'judge4@student.nitw.ac.in'),
  ('JUDGE5_UUID', 'Judge 5', 'judge5@student.nitw.ac.in'),
  ('JUDGE6_UUID', 'Judge 6', 'judge6@student.nitw.ac.in');
```

---

## 🚀 Free Vercel Deployment (Zero Extra Config)

1. Push your repository to **GitHub**.
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**. Vercel will automatically detect Next.js App Router and deploy with zero extra configuration.

---

## 🏆 User Flows & Verification

1. **Team Portal (`/auth/team` & `/register-team`)**:
   - Enter leader's email (any valid address, e.g. `leader@gmail.com`) -> Magic OTP.
   - Enter team name & add 1–3 members (any valid email address per member).
   - Registration assigns a random domain (e.g. FinTech) and balances Pool A or B.
2. **Live Event Sync**:
   - Organiser selects a live pitch from `/portal/organiser`.
   - Connected Team and Judge screens update immediately without refreshing via Supabase Realtime!
3. **Audience Rating & Questions**:
   - Teams can only vote or ask questions on rival pool pitches (disabled for own pool/team).
   - Submitted questions appear in real-time on Organiser's **Question Queue** for review & points allocation.
4. **Final 4 Qualification**:
   - Organiser clicks **Reveal Final 4 & Qualify** to calculate the Top 2 Pool A + Top 2 Pool B teams and launch confetti!
