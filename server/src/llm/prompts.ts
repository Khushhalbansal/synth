// ============================================================
// Synth MVP — LLM Prompt Templates
// ============================================================
// Structured prompts for the Anthropic API. The LLM receives
// precomputed heuristic numbers and interprets them — it never
// does its own arithmetic.
// ============================================================

import { MergedDataset } from '../types';

export const SYSTEM_PROMPT = `You are a sports science analyst specializing in multi-sport training optimization and recovery analysis. You have deep expertise in triathlon training, rowing performance, and the physiological markers that connect them (HRV, sleep, heart rate recovery, training load management).

Your role is to analyze PRECOMPUTED heuristic statistics and cross-domain correlations between:
1. Health/wellness data (HRV, resting heart rate, sleep, steps, active energy)
2. Triathlon training data (swim/bike/run sessions with duration, distance, heart rate, RPE)
3. Rowing training data (erg sessions with distance, split times, stroke rate, heart rate)

CRITICAL RULES:
- You are given precomputed statistics (rolling averages, z-scores, Pearson correlations, trend deltas). INTERPRET these numbers — do NOT invent your own calculations.
- When you cite a number, it must come from the data provided. Never fabricate a statistic.
- If the data is insufficient to draw a conclusion, say so explicitly rather than speculating.
- Focus on actionable, cross-domain insights: How does rowing affect triathlon recovery? How does sleep quality correlate with training performance? Are there overtraining signals?
- Use plain, direct language. Avoid jargon unless you define it.
- Always note the confidence level of your observations (strong signal vs. tentative pattern).

Output your response as JSON with this exact structure:
{
  "text": "A 2-3 paragraph narrative summary of the most important findings",
  "keyFindings": ["Finding 1", "Finding 2", ...],
  "score": <1-100 overall training/recovery score>,
  "recommendations": ["Recommendation 1", "Recommendation 2", ...],
  "citedMetrics": ["metric name 1", "metric name 2", ...]
}`;

/**
 * Build the user prompt with all precomputed data for the LLM.
 */
export function buildUserPrompt(dataset: MergedDataset): string {
  const sections: string[] = [];

  // Summary
  sections.push(`## Dataset Summary
- Date range: ${dataset.dateRange.start} to ${dataset.dateRange.end}
- Total training days: ${dataset.summary.totalTrainingDays}
- Triathlon sessions: ${dataset.summary.totalTriathlonSessions}
- Rowing sessions: ${dataset.summary.totalRowingSessions}
- Average sleep: ${dataset.summary.avgSleepMin !== null ? `${dataset.summary.avgSleepMin} min (${(dataset.summary.avgSleepMin / 60).toFixed(1)} hrs)` : 'N/A'}
- Average HRV: ${dataset.summary.avgHrv !== null ? `${dataset.summary.avgHrv} ms` : 'N/A'}
- Average resting HR: ${dataset.summary.avgRestingHr !== null ? `${dataset.summary.avgRestingHr} bpm` : 'N/A'}`);

  // Heuristics
  if (dataset.heuristics.length > 0) {
    sections.push(`## Precomputed Heuristics`);
    for (const h of dataset.heuristics) {
      const trendStr = h.trend ? ` [${h.trend}]` : '';
      sections.push(`- **${h.metric}**: ${h.value} ${h.unit}${trendStr} — ${h.description}`);
    }
  }

  // Correlations
  if (dataset.correlations.length > 0) {
    sections.push(`## Cross-Domain Correlations (Pearson r)`);
    for (const c of dataset.correlations) {
      sections.push(`- **${c.metricA} ↔ ${c.metricB}**: r = ${c.coefficient} (${c.interpretation})`);
    }
  }

  // Recent training data (last 14 days for context)
  const recentDays = dataset.days.slice(-14);
  if (recentDays.length > 0) {
    sections.push(`## Recent Training Log (Last ${recentDays.length} days)`);
    for (const day of recentDays) {
      const parts: string[] = [`**${day.date}**:`];

      if (day.health) {
        const h = day.health;
        const healthParts: string[] = [];
        if (h.hrv !== undefined && h.hrv !== null) healthParts.push(`HRV ${h.hrv}ms`);
        if (h.restingHeartRate !== undefined && h.restingHeartRate !== null) healthParts.push(`RHR ${h.restingHeartRate}bpm`);
        if (h.sleepDurationMin !== undefined && h.sleepDurationMin !== null) healthParts.push(`Sleep ${(h.sleepDurationMin / 60).toFixed(1)}hrs`);
        if (h.steps !== undefined && h.steps !== null) healthParts.push(`${h.steps.toLocaleString()} steps`);
        if (healthParts.length > 0) parts.push(`Health: ${healthParts.join(', ')}`);
      }

      if (day.triathlon) {
        const t = day.triathlon;
        const triParts: string[] = [];
        if (t.durationMin) triParts.push(`${t.durationMin}min`);
        if (t.distanceKm) triParts.push(`${t.distanceKm}km`);
        if (t.avgHr) triParts.push(`HR ${t.avgHr}`);
        if (t.rpe) triParts.push(`RPE ${t.rpe}`);
        if (t.notes) triParts.push(`"${t.notes}"`);
        parts.push(`Triathlon: ${triParts.join(', ')}`);
      }

      if (day.rowing) {
        const r = day.rowing;
        const rowParts: string[] = [];
        if (r.workoutType) rowParts.push(`Type: ${r.workoutType}`);
        if (r.distanceM) rowParts.push(`${r.distanceM}m`);
        if (r.time) rowParts.push(`time ${r.time}`);
        if (r.splitTime) rowParts.push(`split ${r.splitTime}`);
        if (r.strokeRate) rowParts.push(`SR ${r.strokeRate}`);
        if (r.avgWatts) rowParts.push(`${r.avgWatts}W`);
        parts.push(`Rowing: ${rowParts.join(', ')}`);
      }

      if (day.workouts.length > 0) {
        for (const w of day.workouts) {
          parts.push(`Workout: ${w.type} ${w.durationMin}min${w.distanceKm ? ` ${w.distanceKm}km` : ''}`);
        }
      }

      sections.push(parts.join(' | '));
    }
  }

  sections.push(`\n## Task
Analyze the above data. Identify the most important cross-domain patterns between the athlete's health markers, triathlon training, and rowing training. Focus on recovery signals, overtraining risk, and performance trends. Respond with the JSON structure specified in your system instructions.`);

  return sections.join('\n\n');
}
