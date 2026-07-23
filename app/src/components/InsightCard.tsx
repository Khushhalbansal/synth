// ============================================================
// Synth App — Insight Card Component
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SynthInsight, HeuristicResult } from '../types';

interface InsightCardProps {
  insight: SynthInsight | null;
  heuristics?: HeuristicResult[];
}

export function InsightCard({ insight, heuristics }: InsightCardProps) {
  if (!insight) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>
          No insight generated yet. Tap "Sync Now" to analyze your data.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Score badge */}
      <View style={styles.scoreRow}>
        <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(insight.score) }]}>
          <Text style={styles.scoreText}>{insight.score}</Text>
        </View>
        <Text style={styles.scoreLabel}>Training Score</Text>
        <Text style={styles.timestamp}>
          {new Date(insight.generatedAt).toLocaleString()}
        </Text>
      </View>

      {/* Insight text */}
      <Text style={styles.insightText}>{insight.text}</Text>

      {/* Key heuristic highlights */}
      {heuristics && heuristics.length > 0 && (
        <View style={styles.heuristicsRow}>
          {heuristics
            .filter((h) => h.trend)
            .slice(0, 3)
            .map((h, i) => (
              <View key={i} style={styles.heuristicChip}>
                <Text style={styles.heuristicIcon}>
                  {h.trend === 'up' ? '↑' : h.trend === 'down' ? '↓' : '→'}
                </Text>
                <Text style={styles.heuristicLabel}>{h.metric}</Text>
                <Text style={[styles.heuristicValue, {
                  color: getTrendColor(h.metric, h.trend || 'stable'),
                }]}>
                  {h.percentChange !== undefined ? `${h.percentChange > 0 ? '+' : ''}${h.percentChange}%` : `${h.value} ${h.unit}`}
                </Text>
              </View>
            ))}
        </View>
      )}

      {/* Key findings */}
      {insight.keyFindings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Findings</Text>
          {insight.keyFindings.map((finding, i) => (
            <Text key={i} style={styles.finding}>• {finding}</Text>
          ))}
        </View>
      )}

      {/* Recommendations */}
      {insight.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {insight.recommendations.map((rec, i) => (
            <Text key={i} style={styles.recommendation}>→ {rec}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#27ae60';
  if (score >= 60) return '#f39c12';
  if (score >= 40) return '#e67e22';
  return '#e74c3c';
}

function getTrendColor(metric: string, trend: 'up' | 'down' | 'stable'): string {
  // HRV up = good, Resting HR up = bad
  const invertedMetrics = ['Resting HR'];
  const isInverted = invertedMetrics.some((m) => metric.includes(m));

  if (trend === 'stable') return '#888';
  if (trend === 'up') return isInverted ? '#e74c3c' : '#27ae60';
  return isInverted ? '#27ae60' : '#e74c3c';
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  placeholder: {
    color: '#666',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scoreLabel: {
    color: '#aaa',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  timestamp: {
    color: '#555',
    fontSize: 11,
  },
  insightText: {
    color: '#ddd',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  heuristicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  heuristicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  heuristicIcon: {
    fontSize: 14,
    color: '#fff',
  },
  heuristicLabel: {
    color: '#888',
    fontSize: 12,
  },
  heuristicValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  finding: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  recommendation: {
    color: '#8ecae6',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
});
