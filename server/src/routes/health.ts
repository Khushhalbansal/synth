// ============================================================
// Synth MVP — GET /health Route
// ============================================================

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Trivial liveness check — no auth required.
 * Used by Render for health monitoring.
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
