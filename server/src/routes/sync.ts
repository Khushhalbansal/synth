// ============================================================
// Synth MVP — POST /sync Route
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { runSyncPipeline } from '../pipeline/sync';
import { syncRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Zod schema for incoming health data validation
const SleepStagesSchema = z.object({
  deep: z.number().optional(),
  light: z.number().optional(),
  rem: z.number().optional(),
  awake: z.number().optional(),
}).optional();

const DailyMetricSchema = z.object({
  date: z.string(),
  steps: z.number().optional(),
  restingHeartRate: z.number().optional(),
  hrv: z.number().optional(),
  sleepDurationMin: z.number().optional(),
  sleepStages: SleepStagesSchema,
  activeEnergyKcal: z.number().optional(),
});

const WorkoutSchema = z.object({
  date: z.string(),
  type: z.string(),
  durationMin: z.number(),
  distanceKm: z.number().optional(),
  avgHeartRate: z.number().optional(),
  maxHeartRate: z.number().optional(),
  caloriesBurned: z.number().optional(),
});

const HealthSnapshotSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  dailyMetrics: z.array(DailyMetricSchema),
  workouts: z.array(WorkoutSchema),
});

const SyncRequestSchema = z.object({
  healthData: HealthSnapshotSchema,
});

/**
 * POST /sync
 * Accepts health snapshot, triggers full pipeline run.
 * Rate-limited to 1 request per 30 seconds.
 */
router.post('/', syncRateLimiter, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parsed = SyncRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    console.log('[SYNC] Sync request received. Running pipeline...');

    const result = await runSyncPipeline(parsed.data.healthData);

    res.json(result);
  } catch (error) {
    console.error('[SYNC] Pipeline error:', (error as Error).message);
    res.status(500).json({
      error: 'Sync pipeline failed',
      message: (error as Error).message,
    });
  }
});

export default router;
