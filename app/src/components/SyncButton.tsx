// ============================================================
// Synth App — Sync Button Component
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface SyncButtonProps {
  onSync: () => Promise<void>;
  disabled?: boolean;
}

const COOLDOWN_MS = 30000; // 30 seconds to match server rate limit

export function SyncButton({ onSync, disabled }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePress = useCallback(async () => {
    if (loading || cooldown || disabled) return;

    setLoading(true);
    try {
      await onSync();
    } finally {
      setLoading(false);
      // Start cooldown
      setCooldown(true);
      setCooldownSecs(COOLDOWN_MS / 1000);

      timerRef.current = setInterval(() => {
        setCooldownSecs((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setCooldown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [loading, cooldown, disabled, onSync]);

  const isDisabled = loading || cooldown || disabled;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.buttonText}>Syncing...</Text>
        </>
      ) : cooldown ? (
        <Text style={styles.buttonText}>Wait {cooldownSecs}s</Text>
      ) : (
        <Text style={styles.buttonText}>⟳ Sync Now</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 8,
    elevation: 3,
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#3d3d5c',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
