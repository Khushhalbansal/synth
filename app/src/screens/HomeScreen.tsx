// ============================================================
// Synth App — Home Screen
// ============================================================
// Main UI: insights, sync button, sheet data views, error states.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { InsightCard } from '../components/InsightCard';
import { SheetTable } from '../components/SheetTable';
import { SyncButton } from '../components/SyncButton';
import { ErrorBanner } from '../components/ErrorBanner';
import { syncData, getState, checkHealth } from '../services/api';
import { requestPermissions, getHealthSnapshot, isUsingDummyData } from '../services/health';
import { setToken, getToken, hasToken } from '../services/auth';
import {
  SynthInsight,
  HeuristicResult,
  TriathlonRecord,
  RowingRecord,
} from '../types';

export function HomeScreen() {
  // State
  const [insight, setInsight] = useState<SynthInsight | null>(null);
  const [heuristics, setHeuristics] = useState<HeuristicResult[]>([]);
  const [triathlonData, setTriathlonData] = useState<TriathlonRecord[]>([]);
  const [rowingData, setRowingData] = useState<RowingRecord[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [healthPermission, setHealthPermission] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [hasApiToken, setHasApiToken] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(true);

  // Check for token on mount
  useEffect(() => {
    (async () => {
      const exists = await hasToken();
      setHasApiToken(exists);
      setIsLoadingToken(false);

      if (exists) {
        // Request health permissions
        const granted = await requestPermissions();
        setHealthPermission(granted);

        if (isUsingDummyData()) {
          setWarning('⚠ Using simulated health data (no HealthKit/Health Connect available)');
        }

        // Check backend
        const online = await checkHealth();
        setBackendOnline(online);

        // Load initial state
        if (online) {
          await loadState();
        }
      }
    })();
  }, [hasApiToken]);

  // Load current state from backend
  const loadState = useCallback(async () => {
    try {
      const state = await getState();
      setTriathlonData(state.sheets.triathlon);
      setRowingData(state.sheets.rowing);
      if (state.lastInsight) {
        setInsight(state.lastInsight);
      }
      setLastSync(state.lastSyncedAt);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadState();
    setRefreshing(false);
  }, [loadState]);

  // Full sync
  const onSync = useCallback(async () => {
    try {
      setError(null);

      // Get health data
      const { snapshot, isDummy } = await getHealthSnapshot(30);
      if (isDummy) {
        setWarning('⚠ Using simulated health data — insights may not reflect real activity');
      }

      // Call backend
      const result = await syncData(snapshot);

      // Update state
      setInsight(result.insight);
      setHeuristics(result.heuristics);
      setTriathlonData(result.sheets.triathlon);
      setRowingData(result.sheets.rowing);
      setLastSync(result.syncedAt);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Token setup screen
  const handleSaveToken = useCallback(async () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your API token');
      return;
    }
    await setToken(trimmed);
    setHasApiToken(true);
    setTokenInput('');
  }, [tokenInput]);

  // Show token setup if not configured
  if (isLoadingToken) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!hasApiToken) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.tokenSetup}>
          <Text style={styles.logoText}>SYNTH</Text>
          <Text style={styles.tagline}>Health + Training Data Fusion</Text>
          <Text style={styles.tokenLabel}>Enter your API token to connect:</Text>
          <TextInput
            style={styles.tokenInput}
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="Paste your API token here"
            placeholderTextColor="#555"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.tokenButton} onPress={handleSaveToken}>
            <Text style={styles.tokenButtonText}>Connect</Text>
          </TouchableOpacity>
          <Text style={styles.tokenHint}>
            This is the API_AUTH_TOKEN from your backend environment.
            It's stored securely on-device.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6c5ce7"
          />
        }
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.logoText}>SYNTH</Text>
          <Text style={styles.tagline}>Health + Training Data Fusion</Text>

          {/* Status indicators */}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {
              backgroundColor: backendOnline === true ? '#27ae60' : backendOnline === false ? '#e74c3c' : '#f39c12'
            }]} />
            <Text style={styles.statusText}>
              {backendOnline === true ? 'Backend connected' :
               backendOnline === false ? 'Backend offline' :
               'Checking...'}
            </Text>

            {lastSync && (
              <Text style={styles.lastSyncText}>
                Last sync: {new Date(lastSync).toLocaleTimeString()}
              </Text>
            )}
          </View>
        </View>

        {/* Errors / Warnings */}
        {error && (
          <ErrorBanner
            message={error}
            type="error"
            onDismiss={() => setError(null)}
          />
        )}
        {warning && (
          <ErrorBanner
            message={warning}
            type="warning"
            onDismiss={() => setWarning(null)}
          />
        )}
        {backendOnline === false && (
          <ErrorBanner
            message="Backend is unreachable. It may be experiencing a cold start — try again in 30-60 seconds."
            type="warning"
          />
        )}
        {!healthPermission && (
          <ErrorBanner
            message="Health data permission not granted. Sync will use simulated data."
            type="info"
          />
        )}

        {/* Sync Button */}
        <SyncButton
          onSync={onSync}
          disabled={backendOnline === false}
        />

        {/* Insight Card */}
        <InsightCard insight={insight} heuristics={heuristics} />

        {/* Sheet Data */}
        <SheetTable
          title="🏊 Triathlon Training"
          columns={['Date', 'Duration', 'Distance', 'Avg HR', 'RPE', 'Notes', 'Insight', 'Score']}
          fieldKeys={['date', 'durationMin', 'distanceKm', 'avgHr', 'rpe', 'notes', 'synthInsight', 'synthScore']}
          data={triathlonData}
        />

        <SheetTable
          title="🚣 Rowing"
          columns={['Date', 'Distance', 'Split', 'Stroke Rate', 'Avg HR', 'Notes', 'Insight', 'Score']}
          fieldKeys={['date', 'distanceM', 'splitTime', 'strokeRate', 'avgHr', 'notes', 'synthInsight', 'synthScore']}
          data={rowingData}
        />

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  headerSection: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  logoText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
  tagline: {
    color: '#6c5ce7',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#888',
    fontSize: 13,
  },
  lastSyncText: {
    color: '#555',
    fontSize: 12,
    marginLeft: 12,
  },

  // Token setup
  tokenSetup: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  tokenLabel: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 30,
    marginBottom: 12,
  },
  tokenInput: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tokenButton: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginTop: 16,
  },
  tokenButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tokenHint: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
