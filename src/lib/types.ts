export type UserRole = 'team' | 'judge' | 'organiser';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  created_at?: string;
}

export interface Domain {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  auth_user_id: string | null;
  team_name: string;
  domain: string;
  pool: 'A' | 'B';
  status: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  name: string;
  email: string;
  is_leader: boolean;
  created_at?: string;
}

export interface Round {
  id: string;
  name: 'prelim' | 'final' | 'tiebreaker';
  order_num: number;
}

export interface Pitch {
  id: string;
  team_id: string;
  round_id: string;
  status: 'upcoming' | 'live' | 'done';
  pitch_order: number;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string;
  team?: Team;
  round?: Round;
}

export interface Judge {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
}

export type JudgeCriterion = 
  | 'problem_market'
  | 'solution_innovation'
  | 'feasibility'
  | 'pitch_storytelling';

export interface JudgeScore {
  id: string;
  judge_id: string;
  pitch_id: string;
  criterion: JudgeCriterion;
  score: number; // 1-10
  locked: boolean;
  created_at?: string;
}

export type AudienceCriterion = 
  | 'problem_relevance'
  | 'creativity'
  | 'solution_quality'
  | 'pitch_quality'
  | 'overall_potential';

export interface AudienceScore {
  id: string;
  voting_team_id: string;
  pitch_id: string;
  criterion: AudienceCriterion;
  score: number; // 1-5
  created_at?: string;
}

export type QuestionStatus = 'pending' | 'approved' | 'rejected';
export type QuestionOutcome = 'team_answered_well' | 'team_answered_poorly' | null;

export interface Question {
  id: string;
  asking_team_id: string;
  pitch_id: string;
  question_text: string;
  status: QuestionStatus;
  outcome: QuestionOutcome;
  points_to_team: number;
  points_to_asker: number;
  created_at: string;
  asking_team?: Team;
}

export type TimerPhase = 'idle' | 'prep' | 'pitch' | 'qa' | 'paused';

export interface EventState {
  id: number;
  current_pitch_id: string | null;
  current_round_id: string | null;
  timer_phase: TimerPhase;
  timer_duration_seconds: number;
  timer_started_at: string | null;
  timer_paused_remaining: number | null;
  updated_at: string;
  current_pitch?: Pitch & { team?: Team };
}

export interface ScoreAuditLog {
  id: string;
  changed_by: string;
  table_changed: string;
  row_id: string;
  old_value: any;
  new_value: any;
  note: string;
  timestamp: string;
}

export interface PitchLeaderboardEntry {
  team_id: string;
  team_name: string;
  domain: string;
  pool: 'A' | 'B';
  pitch_id: string;
  round_id: string;
  round_name: string;
  pitch_status: 'upcoming' | 'live' | 'done';
  
  problem_market_score: number;
  solution_innovation_score: number;
  feasibility_score: number;
  pitch_storytelling_score: number;
  audience_rating_score: number;
  qa_pressure_score: number;
  
  judges_submitted_count: number;
  total_voters: number;
  total_qa_points: number;
  total_weighted_score: number;
}
