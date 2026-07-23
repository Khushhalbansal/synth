// ============================================================
// Synth MVP — Heuristic Statistics
// ============================================================
// Pure computation functions for rolling averages, z-scores,
// Pearson correlation, and trend detection. All stats are
// computed HERE before being sent to the LLM — the LLM
// interprets numbers, it never computes them.
// ============================================================

/**
 * Compute rolling (moving) average over a window.
 * Returns an array of the same length; first `windowSize - 1` entries use smaller windows.
 */
export function rollingAverage(data: (number | null)[], windowSize: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    const windowStart = Math.max(0, i - windowSize + 1);
    const window = data.slice(windowStart, i + 1).filter((v): v is number => v !== null);

    if (window.length === 0) {
      result.push(null);
    } else {
      result.push(window.reduce((sum, v) => sum + v, 0) / window.length);
    }
  }

  return result;
}

/**
 * Compute mean of non-null values.
 */
export function mean(data: (number | null)[]): number | null {
  const valid = data.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/**
 * Compute standard deviation of non-null values.
 */
export function standardDeviation(data: (number | null)[]): number | null {
  const m = mean(data);
  if (m === null) return null;

  const valid = data.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;

  const variance = valid.reduce((sum, v) => sum + (v - m) ** 2, 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute z-score for a single value against a dataset.
 */
export function zScore(value: number, dataMean: number, dataStdDev: number): number {
  if (dataStdDev === 0) return 0;
  return (value - dataMean) / dataStdDev;
}

/**
 * Compute z-scores for an entire array.
 */
export function zScores(data: (number | null)[]): (number | null)[] {
  const m = mean(data);
  const sd = standardDeviation(data);
  if (m === null || sd === null) return data.map(() => null);

  return data.map((v) => (v !== null ? zScore(v, m, sd) : null));
}

/**
 * Compute Pearson correlation coefficient between two arrays.
 * Only uses indices where both values are non-null.
 * Returns a value between -1 and 1, or null if insufficient data.
 */
export function correlationCoefficient(
  x: (number | null)[],
  y: (number | null)[]
): number | null {
  // Pair up only indices where both have values
  const pairs: [number, number][] = [];
  const minLen = Math.min(x.length, y.length);

  for (let i = 0; i < minLen; i++) {
    if (x[i] !== null && y[i] !== null) {
      pairs.push([x[i]!, y[i]!]);
    }
  }

  if (pairs.length < 3) return null; // Need at least 3 data points

  const n = pairs.length;
  const sumX = pairs.reduce((s, p) => s + p[0], 0);
  const sumY = pairs.reduce((s, p) => s + p[1], 0);
  const sumXY = pairs.reduce((s, p) => s + p[0] * p[1], 0);
  const sumX2 = pairs.reduce((s, p) => s + p[0] ** 2, 0);
  const sumY2 = pairs.reduce((s, p) => s + p[1] ** 2, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2)
  );

  if (denominator === 0) return null;

  return numerator / denominator;
}

/**
 * Compute trend delta: percentage change of latest value vs rolling average.
 * Positive = trending up, negative = trending down.
 */
export function trendDelta(
  data: (number | null)[],
  windowSize: number = 7
): { percentChange: number; trend: 'up' | 'down' | 'stable' } | null {
  const valid = data.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;

  const latest = valid[valid.length - 1];
  const windowData = valid.slice(Math.max(0, valid.length - windowSize - 1), valid.length - 1);

  if (windowData.length === 0) return null;

  const avg = windowData.reduce((s, v) => s + v, 0) / windowData.length;
  if (avg === 0) return null;

  const percentChange = ((latest - avg) / Math.abs(avg)) * 100;

  let trend: 'up' | 'down' | 'stable';
  if (percentChange > 5) trend = 'up';
  else if (percentChange < -5) trend = 'down';
  else trend = 'stable';

  return { percentChange: Math.round(percentChange * 10) / 10, trend };
}

/**
 * Interpret a Pearson r value in plain English.
 */
export function interpretCorrelation(r: number): string {
  const abs = Math.abs(r);
  const direction = r > 0 ? 'positive' : 'negative';

  if (abs < 0.1) return 'negligible correlation';
  if (abs < 0.3) return `weak ${direction} correlation`;
  if (abs < 0.5) return `moderate ${direction} correlation`;
  if (abs < 0.7) return `strong ${direction} correlation`;
  return `very strong ${direction} correlation`;
}
