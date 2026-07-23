// ============================================================
// Synth App — Error Banner Component
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  type?: 'error' | 'warning' | 'info';
}

export function ErrorBanner({ message, onDismiss, type = 'error' }: ErrorBannerProps) {
  const bgColor =
    type === 'error' ? '#2d1b1b' :
    type === 'warning' ? '#2d2a1b' :
    '#1b2d2d';

  const borderColor =
    type === 'error' ? '#e74c3c' :
    type === 'warning' ? '#f39c12' :
    '#3498db';

  const icon =
    type === 'error' ? '✕' :
    type === 'warning' ? '⚠' :
    'ℹ';

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderLeftColor: borderColor }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismiss}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  icon: {
    fontSize: 16,
    marginRight: 10,
    color: '#fff',
  },
  message: {
    flex: 1,
    color: '#e0e0e0',
    fontSize: 14,
    lineHeight: 20,
  },
  dismiss: {
    padding: 4,
    marginLeft: 8,
  },
  dismissText: {
    color: '#888',
    fontSize: 16,
  },
});
