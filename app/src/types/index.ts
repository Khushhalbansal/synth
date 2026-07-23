// ============================================================
// Synth App — Shared Types
// ============================================================
// Mirrors server types for API communication.
// ============================================================

// --- Health Data (sent to backend) ---

export interface HealthSnapshot {
  startDate: string;
  endDate: string;
  dailyMetrics: DailyHealthMetric[];
  workouts: WorkoutRecord[];
}

export interface DailyHealthMetric {
  date: string;
  steps?: number;
  restingHeartRate?: number;
  hrv?: number;
  sleepDurationMin?: number;
  sleepStages?: {
    deep?: number;
    light?: number;
    rem?: number;
    awake?: number;
  };
  activeEnergyKcal?: number;
}

export interface WorkoutRecord {
  date: string;
  type: string;
  durationMin: number;
  distanceKm?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  caloriesBurned?: number;
}

// --- Sheet Records ---

export interface TriathlonRecord {
  date: string;
  durationMin: number | null;
  distanceKm: number | null;
  avgHr: number | null;
  rpe: number | null;
  notes: string;
  synthInsight: string;
  synthScore: number | null;
}

export interface RowingRecord {
  date: string;
  distanceM: number | null;
  splitTime: string;
  strokeRate: number | null;
  avgHr: number | null;
  notes: string;
  synthInsight: string;
  synthScore: number | null;
}

// --- Heuristics ---

export interface HeuristicResult {
  metric: string;
  description: string;
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  percentChange?: number;
}

export interface CorrelationResult {
  metricA: string;
  metricB: string;
  coefficient: number;
  interpretation: string;
}

// --- LLM Response ---

export interface SynthInsight {
  text: string;
  keyFindings: string[];
  score: number;
  recommendations: string[];
  citedMetrics: string[];
  generatedAt: string;
}

// --- API Responses ---

export interface SyncResponse {
  insight: SynthInsight;
  sheets: {
    triathlon: TriathlonRecord[];
    rowing: RowingRecord[];
  };
  heuristics: HeuristicResult[];
  correlations: CorrelationResult[];
  syncedAt: string;
}

export interface StateResponse {
  sheets: {
    triathlon: TriathlonRecord[];
    rowing: RowingRecord[];
  };
  lastInsight: SynthInsight | null;
  lastSyncedAt: string | null;
}
