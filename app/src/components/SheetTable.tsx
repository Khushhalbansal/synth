// ============================================================
// Synth App — Sheet Table Component
// ============================================================

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

interface SheetTableProps {
  title: string;
  columns: string[];
  data: Record<string, unknown>[];
  fieldKeys: string[];
  initiallyExpanded?: boolean;
}

export function SheetTable({
  title,
  columns,
  data,
  fieldKeys,
  initiallyExpanded = false,
}: SheetTableProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>{data.length} rows</Text>
        <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {expanded && (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Column headers */}
            <View style={styles.headerRow}>
              {columns.map((col, i) => (
                <Text key={i} style={[styles.headerCell, { minWidth: getCellWidth(col) }]}>
                  {col}
                </Text>
              ))}
            </View>

            {/* Data rows */}
            {data.length === 0 ? (
              <Text style={styles.emptyText}>No data available</Text>
            ) : (
              data.slice(-20).map((row, rowIdx) => (
                <View
                  key={rowIdx}
                  style={[
                    styles.dataRow,
                    rowIdx % 2 === 0 ? styles.evenRow : styles.oddRow,
                  ]}
                >
                  {fieldKeys.map((key, colIdx) => (
                    <Text
                      key={colIdx}
                      style={[styles.dataCell, { minWidth: getCellWidth(columns[colIdx]) }]}
                      numberOfLines={1}
                    >
                      {formatCell(row[key])}
                    </Text>
                  ))}
                </View>
              ))
            )}

            {data.length > 20 && (
              <Text style={styles.truncatedText}>
                Showing last 20 of {data.length} rows
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

function getCellWidth(header: string): number {
  if (header.toLowerCase().includes('insight')) return 200;
  if (header.toLowerCase().includes('notes')) return 150;
  if (header.toLowerCase().includes('date')) return 100;
  return 80;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  title: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  count: {
    color: '#666',
    fontSize: 13,
    marginRight: 10,
  },
  chevron: {
    color: '#666',
    fontSize: 12,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  headerCell: {
    color: '#8ecae6',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  evenRow: {
    backgroundColor: '#0f0f23',
  },
  oddRow: {
    backgroundColor: '#141428',
  },
  dataCell: {
    color: '#ccc',
    fontSize: 13,
    paddingHorizontal: 6,
  },
  emptyText: {
    color: '#555',
    fontSize: 14,
    padding: 16,
    textAlign: 'center',
  },
  truncatedText: {
    color: '#555',
    fontSize: 12,
    padding: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
