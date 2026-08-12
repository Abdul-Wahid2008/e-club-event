-- Migration: Initial Schema for Pitch Under Pressure
-- Enables Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('team', 'judge', 'organiser')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DOMAINS TABLE
CREATE TABLE IF NOT EXISTS public.domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL
);

-- 3. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_name TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  pool TEXT NOT NULL CHECK (pool IN ('A', 'B')),
  status TEXT DEFAULT 'registered',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TEAM MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_leader BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ROUNDS TABLE
CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (name IN ('prelim', 'final', 'tiebreaker')),
  order_num INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PITCHES TABLE
CREATE TABLE IF NOT EXISTS public.pitches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'done')),
  pitch_order INT DEFAULT 1,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, round_id)
);

-- 7. JUDGES TABLE
CREATE TABLE IF NOT EXISTS public.judges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. JUDGE SCORES TABLE
CREATE TABLE IF NOT EXISTS public.judge_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  judge_id UUID NOT NULL REFERENCES public.judges(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  criterion TEXT NOT NULL CHECK (criterion IN ('problem_market', 'solution_innovation', 'feasibility', 'pitch_storytelling')),
  score INT NOT NULL CHECK (score >= 1 AND score <= 10),
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(judge_id, pitch_id, criterion)
);

-- 9. AUDIENCE SCORES TABLE
CREATE TABLE IF NOT EXISTS public.audience_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voting_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  criterion TEXT NOT NULL CHECK (criterion IN ('problem_relevance', 'creativity', 'solution_quality', 'pitch_quality', 'overall_potential')),
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voting_team_id, pitch_id, criterion)
);

-- 10. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asking_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  outcome TEXT CHECK (outcome IN ('team_answered_well', 'team_answered_poorly', NULL)),
  points_to_team INT DEFAULT 0,
  points_to_asker INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. EVENT STATE TABLE (Single row configuration)
CREATE TABLE IF NOT EXISTS public.event_state (
  id INT PRIMARY KEY CHECK (id = 1),
  current_pitch_id UUID REFERENCES public.pitches(id) ON DELETE SET NULL,
  current_round_id UUID REFERENCES public.rounds(id) ON DELETE SET NULL,
  timer_phase TEXT NOT NULL DEFAULT 'idle' CHECK (timer_phase IN ('idle', 'prep', 'pitch', 'qa', 'paused')),
  timer_duration_seconds INT NOT NULL DEFAULT 600,
  timer_started_at TIMESTAMPTZ,
  timer_paused_remaining INT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. SCORE AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.score_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  table_changed TEXT NOT NULL,
  row_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  note TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Profiles
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "User update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Domains & Rounds (Public Read)
CREATE POLICY "Public read domains" ON public.domains FOR SELECT USING (true);
CREATE POLICY "Public read rounds" ON public.rounds FOR SELECT USING (true);

-- Teams & Team Members
CREATE POLICY "Public read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Team insert own team" ON public.teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Team update own team" ON public.teams FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Public read team members" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Team insert members" ON public.team_members FOR INSERT WITH CHECK (true);

-- Pitches (Public Read, Organiser write)
CREATE POLICY "Public read pitches" ON public.pitches FOR SELECT USING (true);
CREATE POLICY "Organiser manage pitches" ON public.pitches FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser')
);

-- Judges
CREATE POLICY "Public read judges" ON public.judges FOR SELECT USING (true);

-- Judge Scores: Judges can insert/update their own unlocked scores; Organiser has full access
CREATE POLICY "Judge read judge scores" ON public.judge_scores FOR SELECT USING (true);

CREATE POLICY "Judge insert own scores" ON public.judge_scores FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.judges j 
    WHERE j.id = judge_id AND j.auth_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser'
  )
);

CREATE POLICY "Judge update own unlocked scores" ON public.judge_scores FOR UPDATE USING (
  (EXISTS (
    SELECT 1 FROM public.judges j 
    WHERE j.id = judge_id AND j.auth_user_id = auth.uid()
  ) AND locked = false) 
  OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser'
  )
);

-- Audience Scores: Teams can insert rating only if voting team != pitching team & different pool
CREATE POLICY "Public read audience scores" ON public.audience_scores FOR SELECT USING (true);
CREATE POLICY "Team insert audience score" ON public.audience_scores FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams vt
    JOIN public.pitches p ON p.id = pitch_id
    JOIN public.teams pt ON pt.id = p.team_id
    WHERE vt.id = voting_team_id 
      AND vt.auth_user_id = auth.uid()
      AND vt.pool <> pt.pool
      AND vt.id <> pt.id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser'
  )
);

-- Questions
CREATE POLICY "Public read questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Team insert question" ON public.questions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t 
    WHERE t.id = asking_team_id AND t.auth_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser'
  )
);
CREATE POLICY "Organiser manage questions" ON public.questions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser')
);

-- Event State
CREATE POLICY "Public read event_state" ON public.event_state FOR SELECT USING (true);
CREATE POLICY "Organiser manage event_state" ON public.event_state FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser')
);

-- Score Audit Log
CREATE POLICY "Public read audit log" ON public.score_audit_log FOR SELECT USING (true);
CREATE POLICY "Organiser insert audit log" ON public.score_audit_log FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser')
);


-- 13. AUTHORITATIVE SCORING VIEW (pitch_leaderboard)
CREATE OR REPLACE VIEW public.pitch_leaderboard AS
WITH 
-- 1. Judge average scores per pitch & criterion
judge_component AS (
  SELECT 
    p.id AS pitch_id,
    COALESCE(AVG(CASE WHEN js.criterion = 'problem_market' THEN js.score END) * 10, 0) AS problem_market_score,
    COALESCE(AVG(CASE WHEN js.criterion = 'solution_innovation' THEN js.score END) * 10, 0) AS solution_innovation_score,
    COALESCE(AVG(CASE WHEN js.criterion = 'feasibility' THEN js.score END) * 10, 0) AS feasibility_score,
    COALESCE(AVG(CASE WHEN js.criterion = 'pitch_storytelling' THEN js.score END) * 10, 0) AS pitch_storytelling_score,
    COUNT(DISTINCT js.judge_id) AS judges_submitted_count
  FROM public.pitches p
  LEFT JOIN public.judge_scores js ON js.pitch_id = p.id
  GROUP BY p.id
),

-- 2. Voter average scores per pitch & voting team (1-5 scale normalized to 0-100)
voter_pitch_averages AS (
  SELECT 
    pitch_id,
    voting_team_id,
    (AVG(score) - 1.0) / 4.0 * 100.0 AS voter_normalized_score
  FROM public.audience_scores
  GROUP BY pitch_id, voting_team_id
),

-- 3. Overall Audience score per pitch (average across voters)
audience_component AS (
  SELECT 
    p.id AS pitch_id,
    COALESCE(AVG(vpa.voter_normalized_score), 0) AS audience_rating_score,
    COUNT(DISTINCT vpa.voting_team_id) AS total_voters
  FROM public.pitches p
  LEFT JOIN voter_pitch_averages vpa ON vpa.pitch_id = p.id
  GROUP BY p.id
),

-- 4. Q&A / Pressure Test points (sum of approved question points scaled)
qa_component AS (
  SELECT 
    p.id AS pitch_id,
    LEAST(GREATEST(50 + COALESCE(SUM(q.points_to_team), 0) * 10, 0), 100) AS qa_pressure_score,
    COALESCE(SUM(q.points_to_team), 0) AS total_qa_points
  FROM public.pitches p
  LEFT JOIN public.questions q ON q.pitch_id = p.id AND q.status = 'approved'
  GROUP BY p.id
)

SELECT 
  t.id AS team_id,
  t.team_name,
  t.domain,
  t.pool,
  p.id AS pitch_id,
  r.id AS round_id,
  r.name AS round_name,
  p.status AS pitch_status,
  
  jc.problem_market_score,
  jc.solution_innovation_score,
  jc.feasibility_score,
  jc.pitch_storytelling_score,
  ac.audience_rating_score,
  qc.qa_pressure_score,
  
  jc.judges_submitted_count,
  ac.total_voters,
  qc.total_qa_points,

  -- Final Weighted Formula:
  -- Problem & Market (20%) + Solution & Innovation (20%) + Feasibility (15%) + Storytelling (15%) + Audience (20%) + QA (10%)
  ROUND(
    (jc.problem_market_score * 0.20) +
    (jc.solution_innovation_score * 0.20) +
    (jc.feasibility_score * 0.15) +
    (jc.pitch_storytelling_score * 0.15) +
    (ac.audience_rating_score * 0.20) +
    (qc.qa_pressure_score * 0.10),
    2
  ) AS total_weighted_score
FROM public.pitches p
JOIN public.teams t ON t.id = p.team_id
JOIN public.rounds r ON r.id = p.round_id
JOIN judge_component jc ON jc.pitch_id = p.id
JOIN audience_component ac ON ac.pitch_id = p.id
JOIN qa_component qc ON qc.pitch_id = p.id
ORDER BY total_weighted_score DESC;

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pitches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audience_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
