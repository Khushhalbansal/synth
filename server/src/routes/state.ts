// ============================================================
// Synth MVP — GET /state Route
// ============================================================

import { Router, Request, Response } from 'express';
import { getCurrentState } from '../pipeline/sync';

const router = Router();

/**
 * GET /state
 * Returns current sheet contents + last cached insight.
 * Does NOT trigger a full sync — just reads current state.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const state = await getCurrentState();
    res.json(state);
  } catch (error) {
    console.error('[STATE] Error reading state:', (error as Error).message);
    res.status(500).json({
      error: 'Failed to read current state',
      message: (error as Error).message,
    });
  }
});

export default router;
