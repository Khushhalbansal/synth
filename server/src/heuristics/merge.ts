// ============================================================
// Synth MVP — Data Merger
// ============================================================
// Merges health data + triathlon records + rowing records by date,
// then computes cross-domain heuristics for the LLM.
// ============================================================

import {
  HealthSnapshot,
  TriathlonRecord,
  RowingRecord,
  MergedDayRecord,
  MergedDataset,
  HeuristicResult,
  CorrelationResult,
} from '../types';
import {
  mean,
  trendDelta,
  correlationCoefficient,
  interpretCorrelation,
  rollingAverage,
} from './stats';

/**
 * Merge all three data sources by date and compute heuristics.
 */
export function mergeAndAnalyze(
  healthData: HealthSnapshot,
  triathlonRecords: TriathlonRecord[],
  rowingRecords: RowingRecord[]
): MergedDataset {
  // 1. Collect all unique dates
  const dateSet = new Set<string>();

  for (const m of healthData.dailyMetrics) dateSet.add(m.date);
  for (const t of triathlonRecords) if (t.date) dateSet.add(t.date);
  for (const r of rowingRecords) if (r.date && !r.dateAmbiguous) dateSet.add(r.date);

  const sortedDates = Array.from(dateSet).sort();

  // 2. Build merged day records
  const healthByDate = new Map(healthData.dailyMetrics.map((m) => [m.date, m]));
  const triByDate = new Map(triathlonRecords.map((t) => [t.date, t]));
  
  // Exclude ambiguous/null dates from date mapping in rowByDate
  const rowByDate = new Map(
    rowingRecords
      .filter((r) => r.date !== null && !r.dateAmbiguous)
      .map((r) => [r.date!, r])
  );
  
  const workoutsByDate = new Map<string, typeof healthData.workouts>();
  for (const w of healthData.workouts) {
    const existing = workoutsByDate.get(w.date) || [];
    existing.push(w);
    workoutsByDate.set(w.date, existing);
  }

  const days: MergedDayRecord[] = sortedDates.map((date) => ({
    date,
    health: healthByDate.get(date) || null,
    triathlon: triByDate.get(date) || null,
    rowing: rowByDate.get(date) || null,
    workouts: workoutsByDate.get(date) || [],
  }));

  // 3. Extract time-series for heuristic computation
  const hrvSeries = days.map((d) => d.health?.hrv ?? null);
  const restingHrSeries = days.map((d) => d.health?.restingHeartRate ?? null);
  const sleepSeries = days.map((d) => d.health?.sleepDurationMin ?? null);
  const stepsSeries = days.map((d) => d.health?.steps ?? null);
  const triLoadSeries = days.map((d) => {
    if (!d.triathlon) return null;
    // Simple training load: duration * RPE (or duration if no RPE)
    const dur = d.triathlon.durationMin ?? 0;
    const rpe = d.triathlon.rpe ?? 5;
    return dur * rpe;
  });
  const rowLoadSeries = days.map((d) => {
    if (!d.rowing) return null;
    // Use either direct distance or computed total interval distance
    const dist = d.rowing.distanceM ?? d.rowing.computedTotalDistanceM ?? 0;
    return dist; // Use distance as load proxy for rowing
  });

  // 4. Compute heuristics
  const heuristics: HeuristicResult[] = [];

  // HRV trend
  const hrvTrend = trendDelta(hrvSeries, 7);
  if (hrvTrend) {
    heuristics.push({
      metric: 'HRV (7-day trend)',
      description: `HRV is trending ${hrvTrend.trend} by ${Math.abs(hrvTrend.percentChange)}% vs 7-day average`,
      value: hrvTrend.percentChange,
      unit: '%',
      trend: hrvTrend.trend,
      percentChange: hrvTrend.percentChange,
    });
  }

  // Resting HR trend
  const rhrTrend = trendDelta(restingHrSeries, 7);
  if (rhrTrend) {
    heuristics.push({
      metric: 'Resting HR (7-day trend)',
      description: `Resting heart rate is trending ${rhrTrend.trend} by ${Math.abs(rhrTrend.percentChange)}% vs 7-day average`,
      value: rhrTrend.percentChange,
      unit: '%',
      trend: rhrTrend.trend,
      percentChange: rhrTrend.percentChange,
    });
  }

  // Sleep trend
  const sleepTrend = trendDelta(sleepSeries, 7);
  if (sleepTrend) {
    heuristics.push({
      metric: 'Sleep Duration (7-day trend)',
      description: `Sleep duration is trending ${sleepTrend.trend} by ${Math.abs(sleepTrend.percentChange)}% vs 7-day average`,
      value: sleepTrend.percentChange,
      unit: '%',
      trend: sleepTrend.trend,
      percentChange: sleepTrend.percentChange,
    });
  }

  // Average HRV
  const avgHrv = mean(hrvSeries);
  if (avgHrv !== null) {
    heuristics.push({
      metric: 'Average HRV',
      description: `Average HRV over the period is ${Math.round(avgHrv)} ms`,
      value: Math.round(avgHrv),
      unit: 'ms',
    });
  }

  // Average sleep
  const avgSleep = mean(sleepSeries);
  if (avgSleep !== null) {
    heuristics.push({
      metric: 'Average Sleep',
      description: `Average sleep duration is ${Math.round(avgSleep)} minutes (${(avgSleep / 60).toFixed(1)} hours)`,
      value: Math.round(avgSleep),
      unit: 'min',
    });
  }

  // Rolling averages for context
  const hrvRolling = rollingAverage(hrvSeries, 7);
  const latestHrvRolling = hrvRolling.filter((v) => v !== null).pop();
  if (latestHrvRolling !== null && latestHrvRolling !== undefined) {
    heuristics.push({
      metric: 'HRV 7-day Rolling Avg',
      description: `Current 7-day rolling HRV average is ${Math.round(latestHrvRolling)} ms`,
      value: Math.round(latestHrvRolling),
      unit: 'ms',
    });
  }

  // Training volume (triathlon sessions)
  const triSessions = triathlonRecords.filter((t) => t.durationMin && t.durationMin > 0).length;
  const rowSessions = rowingRecords.filter((r) => r.distanceM && r.distanceM > 0).length;

  heuristics.push({
    metric: 'Triathlon Sessions',
    description: `${triSessions} triathlon training sessions in the dataset`,
    value: triSessions,
    unit: 'sessions',
  });

  heuristics.push({
    metric: 'Rowing Sessions',
    description: `${rowSessions} rowing sessions in the dataset`,
    value: rowSessions,
    unit: 'sessions',
  });

  // 5. Compute cross-domain correlations
  const correlations: CorrelationResult[] = [];

  // HRV vs Triathlon training load
  const hrvTriCorr = correlationCoefficient(hrvSeries, triLoadSeries);
  if (hrvTriCorr !== null) {
    correlations.push({
      metricA: 'HRV',
      metricB: 'Triathlon Training Load',
      coefficient: Math.round(hrvTriCorr * 1000) / 1000,
      interpretation: interpretCorrelation(hrvTriCorr),
    });
  }

  // HRV vs Rowing load
  const hrvRowCorr = correlationCoefficient(hrvSeries, rowLoadSeries);
  if (hrvRowCorr !== null) {
    correlations.push({
      metricA: 'HRV',
      metricB: 'Rowing Distance',
      coefficient: Math.round(hrvRowCorr * 1000) / 1000,
      interpretation: interpretCorrelation(hrvRowCorr),
    });
  }

  // Sleep vs Triathlon load
  const sleepTriCorr = correlationCoefficient(sleepSeries, triLoadSeries);
  if (sleepTriCorr !== null) {
    correlations.push({
      metricA: 'Sleep Duration',
      metricB: 'Triathlon Training Load',
      coefficient: Math.round(sleepTriCorr * 1000) / 1000,
      interpretation: interpretCorrelation(sleepTriCorr),
    });
  }

  // Resting HR vs training load (combined)
  const combinedLoad = days.map((d) => {
    const tri = d.triathlon ? (d.triathlon.durationMin ?? 0) * (d.triathlon.rpe ?? 5) : 0;
    const row = d.rowing ? (d.rowing.distanceM ?? 0) : 0;
    return tri + row > 0 ? tri + row : null;
  });
  const rhrLoadCorr = correlationCoefficient(restingHrSeries, combinedLoad);
  if (rhrLoadCorr !== null) {
    correlations.push({
      metricA: 'Resting HR',
      metricB: 'Combined Training Load',
      coefficient: Math.round(rhrLoadCorr * 1000) / 1000,
      interpretation: interpretCorrelation(rhrLoadCorr),
    });
  }

  // Steps vs sleep
  const stepsSleepCorr = correlationCoefficient(stepsSeries, sleepSeries);
  if (stepsSleepCorr !== null) {
    correlations.push({
      metricA: 'Daily Steps',
      metricB: 'Sleep Duration',
      coefficient: Math.round(stepsSleepCorr * 1000) / 1000,
      interpretation: interpretCorrelation(stepsSleepCorr),
    });
  }

  // 6. Build summary
  const summary = {
    totalTrainingDays: days.filter((d) => d.triathlon || d.rowing || d.workouts.length > 0).length,
    totalTriathlonSessions: triSessions,
    totalRowingSessions: rowSessions,
    avgSleepMin: avgSleep ? Math.round(avgSleep) : null,
    avgHrv: avgHrv ? Math.round(avgHrv) : null,
    avgRestingHr: mean(restingHrSeries) ? Math.round(mean(restingHrSeries)!) : null,
  };

  return {
    days,
    heuristics,
    correlations,
    dateRange: {
      start: sortedDates[0] || '',
      end: sortedDates[sortedDates.length - 1] || '',
    },
    summary,
  };
}
