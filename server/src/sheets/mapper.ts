// ============================================================
// Synth MVP — Sheet Data Mapper
// ============================================================
// Converts raw 2D arrays from Sheets API ↔ typed records.
// All column references come from schema.ts — never hardcoded here.
// ============================================================

import { TriathlonRecord, RowingRecord } from '../types';
import { SheetSchema, TRIATHLON_SCHEMA, ROWING_SCHEMA, SEASON_YEAR_CONFIG } from './schema';

/**
 * Parse a single cell value based on expected type.
 */
function parseCell(value: unknown, type: 'string' | 'number' | 'date'): string | number | null {
  if (value === undefined || value === null || value === '') return type === 'string' ? '' : null;

  const str = String(value).trim();
  if (str === '') return type === 'string' ? '' : null;

  switch (type) {
    case 'date':
      return str;
    case 'number': {
      const num = Number(str);
      return isNaN(num) ? null : num;
    }
    case 'string':
      return str;
  }
}

/**
 * Generic row-to-record mapper using a schema definition.
 */
function mapRowToRecord(
  row: unknown[],
  schema: SheetSchema
): Record<string, string | number | null> {
  const record: Record<string, string | number | null> = {};

  for (const col of schema.columns) {
    record[col.field] = parseCell(row[col.index], col.type);
  }

  // Also read write-back columns if they exist in the row
  const insightIdx = letterToIndex(schema.writeBackColumns.insightColumn);
  const scoreIdx = letterToIndex(schema.writeBackColumns.scoreColumn);

  record[schema.writeBackColumns.insightField] = parseCell(row[insightIdx], 'string');
  record[schema.writeBackColumns.scoreField] = parseCell(row[scoreIdx], 'number');

  return record;
}

function letterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

// -------------------------------------------------------
// Triathlon Mapping
// -------------------------------------------------------

export function mapTriathlonRows(rows: unknown[][]): TriathlonRecord[] {
  return rows
    .filter((row) => row.length > 0 && row[0] !== undefined && row[0] !== '')
    .map((row) => {
      const r = mapRowToRecord(row, TRIATHLON_SCHEMA);
      return {
        date: (r.date as string) || '',
        durationMin: r.durationMin as number | null,
        distanceKm: r.distanceKm as number | null,
        avgHr: r.avgHr as number | null,
        rpe: r.rpe as number | null,
        notes: (r.notes as string) || '',
        synthInsight: (r.synthInsight as string) || '',
        synthScore: r.synthScore as number | null,
      };
    });
}

export function mapRowingRows(rows: unknown[][]): RowingRecord[] {
  let currentTabName = '';
  let workoutType = '';
  let parsedDate: string | null = null;
  let dateAmbiguous = false;
  let headerMap: Record<string, number> = {};
  const records: RowingRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0) continue;
    
    // Check for our injected tab marker
    if (row[0] === '__TAB_NAME__') {
      currentTabName = String(row[1]).trim();
      headerMap = {};
      
      // Parse date and workout type from tab name (e.g. "316 2k", "32 2k", "126 2x6k")
      const match = currentTabName.match(/^(\d{2,4})\s+(.+)$/);
      if (match) {
        const digits = match[1];
        workoutType = match[2].trim();
        
        const candidates: {m: number, d: number}[] = [];
        if (digits.length === 2) {
          candidates.push({ m: parseInt(digits[0], 10), d: parseInt(digits[1], 10) });
        } else if (digits.length === 3) {
          candidates.push({ m: parseInt(digits.substring(0, 1), 10), d: parseInt(digits.substring(1), 10) });
          candidates.push({ m: parseInt(digits.substring(0, 2), 10), d: parseInt(digits.substring(2), 10) });
        } else if (digits.length === 4) {
          candidates.push({ m: parseInt(digits.substring(0, 2), 10), d: parseInt(digits.substring(2), 10) });
        }
        
        // Filter valid month/day
        const validCandidates = candidates.filter(c => c.m >= 1 && c.m <= 12 && c.d >= 1 && c.d <= 31);
        // Unique
        const uniqueCandidates = validCandidates.filter((v, idx, a) => a.findIndex(t => t.m === v.m && t.d === v.d) === idx);

        if (uniqueCandidates.length === 1) {
          const monthNum = uniqueCandidates[0].m;
          const month = String(monthNum).padStart(2, '0');
          const day = String(uniqueCandidates[0].d).padStart(2, '0');
          // Apply season boundary year assignment
          const year = monthNum >= SEASON_YEAR_CONFIG.boundaryMonth
            ? SEASON_YEAR_CONFIG.startYear
            : SEASON_YEAR_CONFIG.endYear;
          parsedDate = `${year}-${month}-${day}`;
          dateAmbiguous = false;
        } else if (uniqueCandidates.length > 1) {
          console.warn(`[WARNING] Ambiguous date in tab name "${currentTabName}". Candidates: ${uniqueCandidates.map(c => `${c.m}/${c.d}`).join(', ')}`);
          parsedDate = null;
          dateAmbiguous = true;
        } else {
          parsedDate = null;
          dateAmbiguous = false;
        }
      } else {
        parsedDate = null;
        workoutType = currentTabName;
        dateAmbiguous = false;
      }
      
      // The next row should be headers
      if (i + 1 < rows.length) {
        const headerRow = rows[i+1] as unknown[];
        for (let c = 0; c < headerRow.length; c++) {
          const h = String(headerRow[c]).trim().toUpperCase();
          if (h) headerMap[h] = c;
        }
      }
      i++; // skip header row
      continue;
    }

    // Process data row
    // Ensure we can at least find NAME
    const nameIdx = getDynamicIndex(ROWING_SCHEMA.columns, 'name', headerMap);
    if (nameIdx === -1 || !row[nameIdx]) continue;

    const rawName = String(row[nameIdx]).trim();
    const parts = rawName.split(',');
    const lastName = parts[0] ? parts[0].trim() : '';
    const firstName = parts[1] ? parts[1].trim() : '';

    const getVal = (fieldName: string) => {
      const idx = getDynamicIndex(ROWING_SCHEMA.columns, fieldName, headerMap);
      return idx !== -1 ? row[idx] : null;
    };

    // Calculate distance and computedTotalDistanceM from workoutType
    const { distanceM, computedTotalDistanceM } = parseWorkoutDistance(workoutType);

    records.push({
      date: parsedDate,
      dateAmbiguous,
      excludedFromTrends: dateAmbiguous || parsedDate === null,
      workoutType,
      rawTabName: currentTabName,
      lastName,
      firstName,
      time: parseCell(getVal('time'), 'string') as string || '',
      distanceM,
      computedTotalDistanceM,
      splitTime: parseCell(getVal('splitTime'), 'string') as string || '',
      strokeRate: parseCell(getVal('strokeRate'), 'number') as number | null,
      avgWatts: parseCell(getVal('avgWatts'), 'number') as number | null,
      notes: '', // Notes typically don't exist in these raw tabs
    });
  }

  return records;
}

function getDynamicIndex(
  columns: any[],
  field: string,
  headerMap: Record<string, number>
): number {
  const colDef = columns.find(c => c.field === field);
  if (!colDef) return -1;
  for (const matchStr of colDef.headerMatches) {
    if (headerMap[matchStr] !== undefined) {
      return headerMap[matchStr];
    }
  }
  return -1;
}

/**
 * Parse distance (direct vs computed interval) from workout type string.
 * Documented rule:
 * - Simple distance (e.g. "2k", "6k", "2000m") sets distanceM, computedTotalDistanceM is null.
 * - Compound distance (e.g. "9x2k", "4x1k") sets computedTotalDistanceM, distanceM is null.
 * - Time pieces (e.g. "30", "3x12") or ambiguous values leave both as null.
 */
function parseWorkoutDistance(workoutType: string): { distanceM: number | null; computedTotalDistanceM: number | null } {
  const type = workoutType.trim().toLowerCase();
  
  // Rule 1: Simple distance (no 'x' in the string)
  if (!type.includes('x')) {
    // E.g. "2k", "6k", "10k"
    const kMatch = type.match(/^(\d+(?:\.\d+)?)\s*k\b/);
    if (kMatch) {
      return { distanceM: parseFloat(kMatch[1]) * 1000, computedTotalDistanceM: null };
    }
    // E.g. "2000m", "5000" (avoid parsing raw minutes like "30" as distance)
    const mMatch = type.match(/^(\d+)\s*m?\b/);
    if (mMatch) {
      const val = parseInt(mMatch[1], 10);
      if (val >= 100) { // Assume values >= 100 are meters, smaller values (like 30 or 12) are minutes/pieces
        return { distanceM: val, computedTotalDistanceM: null };
      }
    }
  }

  // Rule 2: Compound interval distance (e.g. "9x2k", "4x1k", "2x6k", "3x2000m")
  const xMatch = type.match(/^(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(k|m)?\b/);
  if (xMatch) {
    const count = parseInt(xMatch[1], 10);
    const pieceStr = xMatch[2];
    const unit = xMatch[3]; // 'k' or 'm' or undefined
    
    let pieceVal = parseFloat(pieceStr);
    let isValidDistance = false;
    
    if (unit === 'k') {
      pieceVal *= 1000;
      isValidDistance = true;
    } else if (unit === 'm') {
      isValidDistance = true;
    } else {
      // If no unit, check if piece value is typically a meter value (e.g. >= 500 like 3x2000)
      if (pieceVal >= 500) {
        isValidDistance = true;
      }
    }
    
    if (isValidDistance) {
      return { distanceM: null, computedTotalDistanceM: count * pieceVal };
    }
  }

  return { distanceM: null, computedTotalDistanceM: null };
}

// -------------------------------------------------------
// Record → row (for write-back)
// -------------------------------------------------------

export function triathlonRecordToRow(record: TriathlonRecord): (string | number | null)[] {
  return [
    record.date,
    record.durationMin,
    record.distanceKm,
    record.avgHr,
    record.rpe,
    record.notes,
    record.synthInsight,
    record.synthScore,
  ];
}

export function rowingRecordToRow(record: RowingRecord): (string | number | null)[] {
  // Unused for insight write-back, provided for completeness
  return [
    record.date,
    record.lastName,
    record.firstName,
    record.workoutType,
    record.time,
    record.splitTime,
  ];
}
