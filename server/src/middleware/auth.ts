// ============================================================
// Synth MVP — Auth Middleware
// ============================================================
// Validates Bearer token on all routes except /health.
// Token comes from API_AUTH_TOKEN environment variable.
// ============================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware that validates the Authorization header.
 * Expects: Authorization: Bearer <token>
 * Rejects with 401 if missing or invalid.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health check endpoint
  if (req.path === '/health') {
    next();
    return;
  }

  const expectedToken = process.env.API_AUTH_TOKEN;
  if (!expectedToken) {
    console.error('[AUTH] API_AUTH_TOKEN environment variable is not set!');
    res.status(500).json({ error: 'Server misconfiguration: auth token not set' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Invalid Authorization header format. Expected: Bearer <token>' });
    return;
  }

  const token = parts[1];
  if (token !== expectedToken) {
    res.status(401).json({ error: 'Invalid authentication token' });
    return;
  }

  next();
}
