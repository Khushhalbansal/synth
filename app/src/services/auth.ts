// ============================================================
// Synth App — Auth Service
// ============================================================
// Manages the backend API token using expo-secure-store.
// Never stored in AsyncStorage or hardcoded in JS.
// ============================================================

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'synth_api_token';

/**
 * Store the API auth token securely on-device.
 */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/**
 * Retrieve the stored API auth token.
 * Returns null if not set.
 */
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Delete the stored token (for logout/reset).
 */
export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Ignore errors on clear
  }
}

/**
 * Check if a token is stored.
 */
export async function hasToken(): Promise<boolean> {
  const token = await getToken();
  return token !== null && token.length > 0;
}
