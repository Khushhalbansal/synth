// ============================================================
// Synth App — Backend API Client
// ============================================================
// All API calls to the deployed backend. Reads auth token
// from secure store. Handles errors and timeouts.
// ============================================================

import { getToken } from './auth';
import { HealthSnapshot, SyncResponse, StateResponse } from '../types';

// Backend URL from environment or fallback
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const TIMEOUT_MS = 60000; // 60s timeout for sync (LLM calls can be slow)

/**
 * Make an authenticated fetch request to the backend.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated. Please set your API token.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = (errorBody as { error?: string }).error || `HTTP ${response.status}`;

      if (response.status === 401) {
        throw new Error('Authentication failed. Check your API token.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait before syncing again.');
      }
      throw new Error(message);
    }

    return (await response.json()) as T;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timed out. The backend may be starting up (cold start).');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * POST /sync — send health data and trigger full pipeline.
 */
export async function syncData(healthData: HealthSnapshot): Promise<SyncResponse> {
  return apiFetch<SyncResponse>('/sync', {
    method: 'POST',
    body: JSON.stringify({ healthData }),
  });
}

/**
 * GET /state — fetch current sheet state and last insight.
 */
export async function getState(): Promise<StateResponse> {
  return apiFetch<StateResponse>('/state');
}

/**
 * GET /health — check if backend is reachable (no auth).
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
