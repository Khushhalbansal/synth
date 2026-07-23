// ============================================================
// Synth App — Health Data Service
// ============================================================
// Platform-aware adapter:
//   iOS  → react-native-health (HealthKit)
//   Android → react-native-health-connect
//
// Health data is collected transiently (not persisted locally).
// If a data type isn't available, returns null for that field.
// ============================================================

import { Platform } from 'react-native';
import { HealthSnapshot, DailyHealthMetric, WorkoutRecord } from '../types';

// ==============================================
// iOS — HealthKit via react-native-health
// ==============================================
async function requestPermissionsIOS(): Promise<boolean> {
  try {
    const AppleHealthKit = require('react-native-health').default;

    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.HeartRate,
          AppleHealthKit.Constants.Permissions.HeartRateVariability,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.Workout,
          AppleHealthKit.Constants.Permissions.RestingHeartRate,
        ],
        write: [],
      },
    };

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, (error: string | null) => {
        if (error) {
          console.warn('[HEALTH] HealthKit permission denied:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.warn('[HEALTH] HealthKit not available:', error);
    return false;
  }
}

async function getHealthSnapshotIOS(daysBack: number): Promise<HealthSnapshot> {
  const AppleHealthKit = require('react-native-health').default;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysBack);

  const options = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  const dailyMetrics: DailyHealthMetric[] = [];
  const workouts: WorkoutRecord[] = [];

  // Collect data for each day
  for (let d = 0; d < daysBack; d++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + d);
    const dateStr = day.toISOString().split('T')[0];

    const metric: DailyHealthMetric = { date: dateStr };

    // Steps
    try {
      const steps = await new Promise<number>((resolve) => {
        AppleHealthKit.getStepCount(
          { date: day.toISOString() },
          (err: unknown, results: { value: number }) => {
            resolve(err ? 0 : results?.value || 0);
          }
        );
      });
      if (steps > 0) metric.steps = steps;
    } catch { /* graceful skip */ }

    // Resting Heart Rate
    try {
      const rhr = await new Promise<number | undefined>((resolve) => {
        AppleHealthKit.getRestingHeartRate(
          { ...options },
          (err: unknown, results: Array<{ value: number }>) => {
            if (err || !results?.length) resolve(undefined);
            else resolve(results[results.length - 1]?.value);
          }
        );
      });
      if (rhr !== undefined) metric.restingHeartRate = rhr;
    } catch { /* graceful skip */ }

    // HRV
    try {
      const hrv = await new Promise<number | undefined>((resolve) => {
        AppleHealthKit.getHeartRateVariabilitySamples(
          { ...options },
          (err: unknown, results: Array<{ value: number }>) => {
            if (err || !results?.length) resolve(undefined);
            else resolve(results[results.length - 1]?.value);
          }
        );
      });
      if (hrv !== undefined) metric.hrv = hrv;
    } catch { /* graceful skip */ }

    // Sleep
    try {
      const sleep = await new Promise<number | undefined>((resolve) => {
        AppleHealthKit.getSleepSamples(
          { ...options },
          (err: unknown, results: Array<{ value: string; startDate: string; endDate: string }>) => {
            if (err || !results?.length) resolve(undefined);
            else {
              const totalMin = results.reduce((sum, s) => {
                const start = new Date(s.startDate).getTime();
                const end = new Date(s.endDate).getTime();
                return sum + (end - start) / 60000;
              }, 0);
              resolve(totalMin > 0 ? totalMin : undefined);
            }
          }
        );
      });
      if (sleep !== undefined) metric.sleepDurationMin = sleep;
    } catch { /* graceful skip */ }

    // Active Energy
    try {
      const energy = await new Promise<number | undefined>((resolve) => {
        AppleHealthKit.getActiveEnergyBurned(
          { ...options },
          (err: unknown, results: Array<{ value: number }>) => {
            if (err || !results?.length) resolve(undefined);
            else resolve(results.reduce((sum, r) => sum + r.value, 0));
          }
        );
      });
      if (energy !== undefined) metric.activeEnergyKcal = energy;
    } catch { /* graceful skip */ }

    dailyMetrics.push(metric);
  }

  // Workouts
  try {
    const wResults = await new Promise<WorkoutRecord[]>((resolve) => {
      AppleHealthKit.getSamples(
        {
          ...options,
          type: 'Workout',
        },
        (err: unknown, results: Array<{ activityName: string; start: string; end: string; distance: number; calories: number }>) => {
          if (err || !results?.length) resolve([]);
          else {
            resolve(
              results.map((w) => ({
                date: new Date(w.start).toISOString().split('T')[0],
                type: w.activityName || 'unknown',
                durationMin: (new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000,
                distanceKm: w.distance ? w.distance / 1000 : undefined,
                caloriesBurned: w.calories,
              }))
            );
          }
        }
      );
    });
    workouts.push(...wResults);
  } catch { /* graceful skip */ }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    dailyMetrics,
    workouts,
  };
}

// ==============================================
// Android — Health Connect
// ==============================================
async function requestPermissionsAndroid(): Promise<boolean> {
  try {
    const {
      initialize,
      requestPermission,
    } = require('react-native-health-connect');

    const isInitialized = await initialize();
    if (!isInitialized) {
      console.warn('[HEALTH] Health Connect initialization failed');
      return false;
    }

    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'RestingHeartRate' },
      { accessType: 'read', recordType: 'HeartRateVariability' },
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'ExerciseSession' },
    ]);

    return granted.length > 0;
  } catch (error) {
    console.warn('[HEALTH] Health Connect not available:', error);
    return false;
  }
}

async function getHealthSnapshotAndroid(daysBack: number): Promise<HealthSnapshot> {
  const { readRecords } = require('react-native-health-connect');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysBack);

  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const dailyMetrics: DailyHealthMetric[] = [];
  const workouts: WorkoutRecord[] = [];

  // Build daily map
  const dayMap = new Map<string, DailyHealthMetric>();
  for (let d = 0; d < daysBack; d++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + d);
    const dateStr = day.toISOString().split('T')[0];
    dayMap.set(dateStr, { date: dateStr });
  }

  // Steps
  try {
    const steps = await readRecords('Steps', { timeRangeFilter });
    for (const record of steps.records) {
      const dateStr = new Date(record.startTime).toISOString().split('T')[0];
      const day = dayMap.get(dateStr);
      if (day) {
        day.steps = (day.steps || 0) + (record.count || 0);
      }
    }
  } catch { /* graceful skip */ }

  // Heart Rate (get resting from dedicated type)
  try {
    const rhr = await readRecords('RestingHeartRate', { timeRangeFilter });
    for (const record of rhr.records) {
      const dateStr = new Date(record.time).toISOString().split('T')[0];
      const day = dayMap.get(dateStr);
      if (day && record.beatsPerMinute) {
        day.restingHeartRate = record.beatsPerMinute;
      }
    }
  } catch { /* graceful skip */ }

  // HRV
  try {
    const hrv = await readRecords('HeartRateVariability', { timeRangeFilter });
    for (const record of hrv.records) {
      const dateStr = new Date(record.time).toISOString().split('T')[0];
      const day = dayMap.get(dateStr);
      if (day && record.heartRateVariabilityMillis) {
        day.hrv = record.heartRateVariabilityMillis;
      }
    }
  } catch { /* graceful skip */ }

  // Sleep
  try {
    const sleep = await readRecords('SleepSession', { timeRangeFilter });
    for (const record of sleep.records) {
      const dateStr = new Date(record.startTime).toISOString().split('T')[0];
      const day = dayMap.get(dateStr);
      if (day) {
        const start = new Date(record.startTime).getTime();
        const end = new Date(record.endTime).getTime();
        day.sleepDurationMin = (end - start) / 60000;
      }
    }
  } catch { /* graceful skip */ }

  // Active Calories
  try {
    const calories = await readRecords('ActiveCaloriesBurned', { timeRangeFilter });
    for (const record of calories.records) {
      const dateStr = new Date(record.startTime).toISOString().split('T')[0];
      const day = dayMap.get(dateStr);
      if (day && record.energy) {
        day.activeEnergyKcal = (day.activeEnergyKcal || 0) + (record.energy.inKilocalories || 0);
      }
    }
  } catch { /* graceful skip */ }

  // Exercise Sessions (workouts)
  try {
    const exercises = await readRecords('ExerciseSession', { timeRangeFilter });
    for (const record of exercises.records) {
      const start = new Date(record.startTime);
      const end = new Date(record.endTime);
      workouts.push({
        date: start.toISOString().split('T')[0],
        type: record.exerciseType || 'unknown',
        durationMin: (end.getTime() - start.getTime()) / 60000,
      });
    }
  } catch { /* graceful skip */ }

  // Collect daily metrics from the map
  for (const metric of dayMap.values()) {
    dailyMetrics.push(metric);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    dailyMetrics: dailyMetrics.sort((a, b) => a.date.localeCompare(b.date)),
    workouts: workouts.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ==============================================
// Dummy Fallback (no health platform available)
// ==============================================
function getDummySnapshot(daysBack: number): HealthSnapshot {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysBack);

  const dailyMetrics: DailyHealthMetric[] = [];
  for (let d = 0; d < daysBack; d++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + d);
    const dateStr = day.toISOString().split('T')[0];

    dailyMetrics.push({
      date: dateStr,
      steps: Math.floor(5000 + Math.random() * 10000),
      restingHeartRate: Math.floor(55 + Math.random() * 15),
      hrv: Math.floor(30 + Math.random() * 40),
      sleepDurationMin: Math.floor(360 + Math.random() * 120),
      activeEnergyKcal: Math.floor(200 + Math.random() * 500),
    });
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    dailyMetrics,
    workouts: [
      {
        date: dailyMetrics[Math.floor(dailyMetrics.length / 2)]?.date || dateString(new Date()),
        type: 'running',
        durationMin: 45,
        distanceKm: 8.5,
        avgHeartRate: 155,
      },
    ],
  };
}

function dateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ==============================================
// Public API (platform-aware)
// ==============================================

/** Whether we're using real health data or dummy fallback */
let usingDummyData = false;

/**
 * Request health data permissions from the platform.
 * Returns true if granted (or if using dummy fallback).
 */
export async function requestPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      return await requestPermissionsIOS();
    } else if (Platform.OS === 'android') {
      return await requestPermissionsAndroid();
    }
  } catch (error) {
    console.warn('[HEALTH] Permission request failed, will use dummy data:', error);
  }

  // Fallback — no native health SDK available (e.g., running in simulator without it)
  usingDummyData = true;
  return true;
}

/**
 * Get a health snapshot covering the last N days.
 * Uses real platform data if available, dummy data as labeled fallback.
 */
export async function getHealthSnapshot(daysBack: number = 30): Promise<{
  snapshot: HealthSnapshot;
  isDummy: boolean;
}> {
  if (usingDummyData) {
    return { snapshot: getDummySnapshot(daysBack), isDummy: true };
  }

  try {
    if (Platform.OS === 'ios') {
      return { snapshot: await getHealthSnapshotIOS(daysBack), isDummy: false };
    } else if (Platform.OS === 'android') {
      return { snapshot: await getHealthSnapshotAndroid(daysBack), isDummy: false };
    }
  } catch (error) {
    console.warn('[HEALTH] Failed to read health data, using dummy:', error);
  }

  usingDummyData = true;
  return { snapshot: getDummySnapshot(daysBack), isDummy: true };
}

/**
 * Check if we're using dummy health data.
 */
export function isUsingDummyData(): boolean {
  return usingDummyData;
}
