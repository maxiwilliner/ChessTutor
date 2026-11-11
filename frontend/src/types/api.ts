export interface PlayerMeta {
  username: string;
  elo_current: number;
  time_class: string;
  games_analyzed: number;
  period: string;
}

export interface OverallMetrics {
  win_rate: number;
  draw_rate: number;
  loss_rate: number;
  avg_centipawn_loss: number;
  accuracy_score: number;
}

export interface ErrorBreakdown {
  blunders_total: number;
  errors_total: number;
  inaccuracies_total: number;
  blunders_per_game: number;
}

export interface PhaseStats {
  blunders: number;
  avg_cpl: number;
  percentage_of_blunders: number;
}

export interface PhaseDistribution {
  opening: PhaseStats;
  middlegame: PhaseStats;
  endgame: PhaseStats;
}

export interface TacticalMotifDetail {
  count: number;
  percentage_of_blunders: number;
  description: string;
}

export interface ClockPsychology {
  blunders_under_3s_with_ample_time: number;
  blunders_in_time_trouble_under_10s: number;
  primary_flaw: "impulsive_play" | "time_trouble_panic" | "none";
  avg_time_on_blunders_seconds: number;
  avg_time_on_good_moves_seconds: number;
  blunder_time_ratio: number;
}

export interface OpeningGap {
  eco: string;
  name: string;
  color: "white" | "black";
  games_played: number;
  win_rate: number;
  avg_eval_at_move_12: number;
  dominant_blunder_motif: string;
}

export interface AlgorithmicFlag {
  code: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  metric_reference: string;
}

export interface PlayerDiagnosisSummary {
  player: PlayerMeta;
  overall_metrics: OverallMetrics;
  error_breakdown: ErrorBreakdown;
  phase_distribution: PhaseDistribution;
  tactical_motifs: Record<string, TacticalMotifDetail>;
  clock_psychology: ClockPsychology;
  opening_repertoire_gaps: OpeningGap[];
  top_3_algorithmic_flags: AlgorithmicFlag[];
}

export interface BlunderGameMetadata {
  white: string;
  black: string;
  user_color: "white" | "black";
  eco: string;
  opening_name: string;
  time_control: string;
}

export interface BlunderUserMove {
  uci: string;
  san: string;
  time_spent_seconds: number;
  clock_remaining_seconds: number;
}

export interface BlunderEngineSolution {
  best_move_uci: string;
  best_move_san: string;
  eval_before: number;
  eval_after_user_move: number;
  cpl: number;
  pv_uci: string[];
  pv_san: string[];
}

export interface BlunderClassification {
  phase: "opening" | "middlegame" | "endgame";
  theme: string;
  psychological_tag: "impulsive" | "time_trouble" | "normal";
}

export interface TutorHints {
  level_1_conceptual: string;
  level_2_directional: string;
  level_3_concrete: string;
}

export interface BlunderBankItem {
  id: string;
  game_url: string;
  metadata: BlunderGameMetadata;
  move_number: number;
  turn: "white" | "black";
  fen_before: string;
  user_move: BlunderUserMove;
  engine_solution: BlunderEngineSolution;
  classification: BlunderClassification;
  tutor_hints: TutorHints;
}

export interface TutorLeak {
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  explanation: string;
  tactical_concept: string;
  actionable_advice: string;
}

export interface DailyPlanItem {
  day: string;
  focus: string;
  duration_minutes: number;
  exercises_description: string;
}

export interface TutorPedagogicalReport {
  greeting: string;
  overview: string;
  top_3_leaks: TutorLeak[];
  weekly_plan: DailyPlanItem[];
  mental_game_tip: string;
}

