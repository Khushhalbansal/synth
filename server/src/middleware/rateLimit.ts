// ============================================================
// Synth MVP — Rate Limit Middleware
// ============================================================
// Prevents duplicate sync requests from button-mashing.
// Uses express-rate-limit with in-memory store (sufficient
// for single-instance MVP on Render).
// ============================================================

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for the /sync endpoint.
 * Max 1 request per 30 seconds per IP.
 */
export const syncRateLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Sync rate limit exceeded. Please wait 30 seconds before syncing again.',
  },
  keyGenerator: (req) => {
    // Use the bearer token as the key (identifies the user)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      return authHeader;
    }
    // Fallback to IP
    return req.ip || 'unknown';
  },
});
