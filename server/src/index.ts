// ============================================================
// Synth MVP — Express Server Entry Point
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authMiddleware } from './middleware/auth';
import syncRouter from './routes/sync';
import stateRouter from './routes/state';
import healthRouter from './routes/health';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Security middleware ---
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins for MVP (mobile app has no fixed origin)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// --- Body parsing ---
app.use(express.json({ limit: '5mb' })); // Health snapshots can be large

// --- Auth middleware (skips /health) ---
app.use(authMiddleware);

// --- Routes ---
app.use('/health', healthRouter);
app.use('/sync', syncRouter);
app.use('/state', stateRouter);

// --- 404 handler ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Global error handler ---
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[SERVER] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`[SERVER] Synth backend running on port ${PORT}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);

  // Validate required env vars on startup
  const required = ['API_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'TRIATHLON_SHEET_ID', 'ROWING_SHEET_ID'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`[SERVER] ⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('[SERVER] Some features will fail until these are set.');
  } else {
    console.log('[SERVER] ✅ All required environment variables are set.');
  }
});

export default app;
