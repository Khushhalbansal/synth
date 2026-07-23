// ============================================================
// Synth MVP — Shared Server Types
// ============================================================

// --- Health Data (received from mobile app) ---

export interface HealthSnapshot {
  /** ISO date range covered by this snapshot */
  startDate: string;
  endDate: string;
  /** Daily aggregated health metrics */
  dailyMetrics: DailyHealthMetric[];
  /** Individual workout sessions */
  workouts: WorkoutRecord[];
}

export interface DailyHealthMetric {
  date: string; // YYYY-MM-DD
  steps?: number;
  restingHeartRate?: number;
  hrv?: number; // SDNN in ms
  sleepDurationMin?: number;
  sleepStages?: {
    deep?: number;   // minutes
    light?: number;
    rem?: number;
    awake?: number;
  };
  activeEnergyKcal?: number;
}

export interface WorkoutRecord {
  date: string; // YYYY-MM-DD
  type: string; // e.g. "running", "cycling", "swimming", "rowing"
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
  date: string | null;
  dateAmbiguous?: boolean;
  excludedFromTrends?: boolean;
  workoutType: string;
  rawTabName: string;
  lastName: string;
  firstName: string;
  time: string;
  distanceM: number | null;
  computedTotalDistanceM: number | null;
  splitTime: string; // mm:ss.s format
  strokeRate: number | null;
  avgWatts: number | null;
  notes: string;
}

// --- Merged / Heuristics ---

export interface MergedDayRecord {
  date: string;
  health: DailyHealthMetric | null;
  triathlon: TriathlonRecord | null;
  rowing: RowingRecord | null;
  workouts: WorkoutRecord[];
}

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
  coefficient: number; // Pearson r, -1 to 1
  interpretation: string;
}

export interface MergedDataset {
  days: MergedDayRecord[];
  heuristics: HeuristicResult[];
  correlations: CorrelationResult[];
  dateRange: { start: string; end: string };
  summary: {
    totalTrainingDays: number;
    totalTriathlonSessions: number;
    totalRowingSessions: number;
    avgSleepMin: number | null;
    avgHrv: number | null;
    avgRestingHr: number | null;
  };
}

// --- LLM Response ---

export interface SynthInsight {
  /** Human-readable insight text */
  text: string;
  /** Key findings as bullet points */
  keyFindings: string[];
  /** Overall training/recovery score 1-100 */
  score: number;
  /** Specific recommendations */
  recommendations: string[];
  /** Metrics the insight is based on */
  citedMetrics: string[];
  /** ISO timestamp of generation */
  generatedAt: string;
}

// --- API Response Types ---

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

export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
  version: string;
}
