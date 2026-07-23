// ============================================================
// Synth MVP — Sync Pipeline Orchestrator
// ============================================================
// Full pipeline: read sheets → merge with health → compute
// heuristics → call Anthropic → write back → return result.
// No PII or raw health data is logged in plaintext.
// ============================================================

import { HealthSnapshot, SyncResponse, SynthInsight, StateResponse } from '../types';
import { readSheet, batchWriteCells } from '../sheets/client';
import { mapTriathlonRows, mapRowingRows } from '../sheets/mapper';
import { TRIATHLON_SCHEMA, ROWING_SCHEMA, getDataRange } from '../sheets/schema';
import { mergeAndAnalyze } from '../heuristics/merge';
import { generateInsight } from '../llm/client';

// In-memory cache of the last insight (survives between requests, not restarts)
let lastInsight: SynthInsight | null = null;
let lastSyncedAt: string | null = null;

/**
 * Run the full sync pipeline.
 */
export async function runSyncPipeline(
  healthData: HealthSnapshot
): Promise<SyncResponse> {
  const triSheetId = process.env.TRIATHLON_SHEET_ID;
  const rowSheetId = process.env.ROWING_SHEET_ID;

  if (!triSheetId || !rowSheetId) {
    throw new Error('TRIATHLON_SHEET_ID and ROWING_SHEET_ID environment variables must be set.');
  }

  console.log('[PIPELINE] Starting sync pipeline...');
  console.log(`[PIPELINE] Health data: ${healthData.dailyMetrics.length} daily metrics, ${healthData.workouts.length} workouts`);

  // 1. Read both sheets in parallel
  console.log('[PIPELINE] Reading sheets...');
  const [triRawRows, rowRawRows] = await Promise.all([
    readSheet(triSheetId, getDataRange(TRIATHLON_SCHEMA)),
    readSheet(rowSheetId, getDataRange(ROWING_SCHEMA)),
  ]);

  console.log(`[PIPELINE] Triathlon sheet: ${triRawRows.length} rows, Rowing sheet: ${rowRawRows.length} rows`);

  // 2. Parse via mapper
  const triathlonRecords = mapTriathlonRows(triRawRows);
  const rowingRecords = mapRowingRows(rowRawRows);

  // 3. Merge with health data and compute heuristics
  console.log('[PIPELINE] Merging data and computing heuristics...');
  const mergedData = mergeAndAnalyze(healthData, triathlonRecords, rowingRecords);

  console.log(`[PIPELINE] ${mergedData.heuristics.length} heuristics, ${mergedData.correlations.length} correlations computed.`);

  // 4. Call Anthropic for insight
  console.log('[PIPELINE] Generating LLM insight...');
  const insight = await generateInsight(mergedData);

  // 5. Write insights back to both sheets
  console.log('[PIPELINE] Writing insights back to sheets...');
  await writeInsightsToSheets(
    triSheetId,
    rowSheetId,
    triathlonRecords,
    rowingRecords,
    insight
  );

  // 6. Cache the insight
  lastInsight = insight;
  lastSyncedAt = new Date().toISOString();

  console.log('[PIPELINE] Sync pipeline completed successfully.');

  return {
    insight,
    sheets: {
      triathlon: triathlonRecords,
      rowing: rowingRecords,
    },
    heuristics: mergedData.heuristics,
    correlations: mergedData.correlations,
    syncedAt: lastSyncedAt,
  };
}

/**
 * Get current state without running a full sync.
 */
export async function getCurrentState(): Promise<StateResponse> {
  const triSheetId = process.env.TRIATHLON_SHEET_ID;
  const rowSheetId = process.env.ROWING_SHEET_ID;

  if (!triSheetId || !rowSheetId) {
    throw new Error('TRIATHLON_SHEET_ID and ROWING_SHEET_ID environment variables must be set.');
  }

  // Read both sheets in parallel
  const [triRawRows, rowRawRows] = await Promise.all([
    readSheet(triSheetId, getDataRange(TRIATHLON_SCHEMA)),
    readSheet(rowSheetId, getDataRange(ROWING_SCHEMA)),
  ]);

  const triathlonRecords = mapTriathlonRows(triRawRows);
  const rowingRecords = mapRowingRows(rowRawRows);

  return {
    sheets: {
      triathlon: triathlonRecords,
      rowing: rowingRecords,
    },
    lastInsight: lastInsight,
    lastSyncedAt: lastSyncedAt,
  };
}

/**
 * Write the overall insight summary back to the most recent rows
 * in both sheets (the synth_insight and synth_score columns).
 */
async function writeInsightsToSheets(
  triSheetId: string,
  rowSheetId: string,
  triathlonRecords: { date: string }[],
  rowingRecords: { date: string | null; lastName?: string; firstName?: string; workoutType?: string }[],
  insight: SynthInsight
): Promise<void> {
  const insightText = insight.text.substring(0, 500); // Truncate for cell size
  const score = insight.score;
  const generatedAt = new Date().toISOString();

  // Create append rows for triathlon
  const triAppends: (string | number | null)[][] = [];
  const triCount = Math.min(triathlonRecords.length, 5);
  for (let i = triathlonRecords.length - triCount; i < triathlonRecords.length; i++) {
    const r = triathlonRecords[i];
    triAppends.push([r.date, 'Triathlete', 'Triathlon Session', insightText, score, generatedAt]);
  }

  // Create append rows for rowing
  const rowAppends: (string | number | null)[][] = [];
  const rowCount = Math.min(rowingRecords.length, 5);
  for (let i = rowingRecords.length - rowCount; i < rowingRecords.length; i++) {
    const r = rowingRecords[i];
    const athlete = (r.lastName || r.firstName) ? `${r.lastName}, ${r.firstName}` : 'Unknown';
    rowAppends.push([r.date, athlete, r.workoutType || 'Rowing', insightText, score, generatedAt]);
  }

  // Write to Synth_Insights tab in both spreadsheets using appendRows
  const { appendRows } = require('../sheets/client');

  const promises: Promise<void>[] = [];
  if (triAppends.length > 0) {
    promises.push(appendRows(triSheetId, 'Synth_Insights!A1', triAppends));
  }
  if (rowAppends.length > 0) {
    promises.push(appendRows(rowSheetId, 'Synth_Insights!A1', rowAppends));
  }

  await Promise.all(promises);
  console.log(`[PIPELINE] Appended insights to ${triAppends.length} triathlon rows and ${rowAppends.length} rowing rows in Synth_Insights.`);
}
