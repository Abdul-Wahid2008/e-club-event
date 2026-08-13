-- Seed File: Pitch Under Pressure initial data

-- 1. Insert 14 Domains
INSERT INTO public.domains (name) VALUES
  ('Healthcare'),
  ('Education'),
  ('Agriculture'),
  ('FinTech'),
  ('Mobility'),
  ('Climate'),
  ('Entertainment'),
  ('Retail'),
  ('Sports'),
  ('Food'),
  ('Tourism'),
  ('Manufacturing'),
  ('EdTech'),
  ('Consumer Technology')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Prelim & Final Rounds
INSERT INTO public.rounds (id, name, order_num) VALUES
  ('11111111-1111-1111-1111-111111111111', 'prelim', 1),
  ('22222222-2222-2222-2222-222222222222', 'final', 2)
ON CONFLICT (id) DO NOTHING;

-- 3. Initialize Event State (Single row)
INSERT INTO public.event_state (id, current_pitch_id, current_round_id, timer_phase, timer_duration_seconds)
VALUES (1, NULL, '11111111-1111-1111-1111-111111111111', 'idle', 600)
ON CONFLICT (id) DO NOTHING;

/*
  HOW TO SEED ORGANISER AND JUDGE ACCOUNTS:

  In Supabase SQL Editor or Dashboard:
  Execute the following SQL snippets to register organiser and judge auth accounts.

  -- 1. Create Organiser Account:
  -- Email: organiser@student.nitw.ac.in
  -- Password: OrganiserPassword123!
  
  -- 2. Create 6 Judge Accounts:
  -- judge1@student.nitw.ac.in (Password: JudgePassword123!)
  -- judge2@student.nitw.ac.in (Password: JudgePassword123!)
  -- judge3@student.nitw.ac.in (Password: JudgePassword123!)
  -- judge4@student.nitw.ac.in (Password: JudgePassword123!)
  -- judge5@student.nitw.ac.in (Password: JudgePassword123!)
  -- judge6@student.nitw.ac.in (Password: JudgePassword123!)

  After creating Auth users in Supabase Dashboard Auth, insert profiles & judge records:
  
  INSERT INTO public.profiles (id, email, role, full_name) VALUES
    ('ORGANISER_USER_UUID', 'organiser@student.nitw.ac.in', 'organiser', 'Event Organiser');

  INSERT INTO public.profiles (id, email, role, full_name) VALUES
    ('JUDGE1_USER_UUID', 'judge1@student.nitw.ac.in', 'judge', 'Judge Dr. Sharma'),
    ('JUDGE2_USER_UUID', 'judge2@student.nitw.ac.in', 'judge', 'Judge Prof. Rao'),
    ('JUDGE3_USER_UUID', 'judge3@student.nitw.ac.in', 'judge', 'Judge Ms. Patel'),
    ('JUDGE4_USER_UUID', 'judge4@student.nitw.ac.in', 'judge', 'Judge Mr. Verma'),
    ('JUDGE5_USER_UUID', 'judge5@student.nitw.ac.in', 'judge', 'Judge Dr. Iyer'),
    ('JUDGE6_USER_UUID', 'judge6@student.nitw.ac.in', 'judge', 'Judge Mr. Reddy');

  INSERT INTO public.judges (auth_user_id, name, email) VALUES
    ('JUDGE1_USER_UUID', 'Judge Dr. Sharma', 'judge1@student.nitw.ac.in'),
    ('JUDGE2_USER_UUID', 'Judge Prof. Rao', 'judge2@student.nitw.ac.in'),
    ('JUDGE3_USER_UUID', 'Judge Ms. Patel', 'judge3@student.nitw.ac.in'),
    ('JUDGE4_USER_UUID', 'Judge Mr. Verma', 'judge4@student.nitw.ac.in'),
    ('JUDGE5_USER_UUID', 'Judge Dr. Iyer', 'judge5@student.nitw.ac.in'),
    ('JUDGE6_USER_UUID', 'Judge Mr. Reddy', 'judge6@student.nitw.ac.in');
*/
