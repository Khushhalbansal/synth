// ============================================================
// Synth MVP — Sheet Schema (SINGLE SOURCE OF TRUTH)
// ============================================================
// This is the ONLY file where column names and positions are defined.
// When the real sheet schema arrives, update THIS file only.
// Every other module imports from here.
// ============================================================

// ============================================================
// Season-year boundary for rowing.
// This needs to be updated per season/workbook.
// Months Jul-Dec (7-12) fall in the season's start year (2025).
// Months Jan-Jun (1-6) fall in the season's end year (2026).
export const SEASON_YEAR_CONFIG = {
  startYear: 2025,
  endYear: 2026,
  boundaryMonth: 7, // month >= boundaryMonth is startYear, otherwise endYear
};

export interface ColumnMapping {
  /** Display / logical name */
  name: string;
  /** 0-based column index in the sheet */
  index: number;
  /** The typed field name on the record interface */
  field: string;
  /** Data type for parsing */
  type: 'string' | 'number' | 'date';
}

export interface SheetSchema {
  /** Human-readable name of this sheet */
  label: string;
  /** Tab/sheet name within the spreadsheet */
  sheetName: string;
  /** Row number where headers are (1-indexed) */
  headerRow: number;
  /** Row number where data starts (1-indexed) */
  dataStartRow: number;
  /** Column definitions in order */
  columns: ColumnMapping[];
  /** Write-back columns appended by Synth */
  writeBackColumns: {
    insightColumn: string; // e.g. "G" or "I"
    scoreColumn: string;
    insightField: string;
    scoreField: string;
  };
}

// -------------------------------------------------------
// TRIATHLON SHEET SCHEMA
// -------------------------------------------------------
export const TRIATHLON_SCHEMA: SheetSchema = {
  label: 'Triathlon Training',
  sheetName: 'activities_raw',
  headerRow: 1,
  dataStartRow: 2,
  columns: [
    { name: 'Date',          index: 1,  field: 'date',        type: 'string' },
    { name: 'Duration (sec)',index: 7,  field: 'durationSec', type: 'number' },
    { name: 'Distance (mi)', index: 10, field: 'distanceMi',  type: 'number' },
    { name: 'Avg HR',        index: 17, field: 'avgHr',       type: 'number' },
    { name: 'Notes',         index: 3,  field: 'notes',       type: 'string' },
  ],
  writeBackColumns: {
    insightColumn: 'A', // Unused during reads for this sheet
    scoreColumn: 'B',
    insightField: 'synthInsight',
    scoreField: 'synthScore',
  },
};

export interface DynamicColumnMapping {
  /** Possible header strings to match (case-insensitive, trimmed) */
  headerMatches: string[];
  /** The typed field name on the record interface */
  field: string;
  /** Data type for parsing */
  type: 'string' | 'number' | 'date';
}

export interface DynamicSheetSchema {
  label: string;
  headerRow: number;
  dataStartRow: number;
  columns: DynamicColumnMapping[];
}

// -------------------------------------------------------
// ROWING SHEET SCHEMA (Dynamic)
// -------------------------------------------------------
export const ROWING_SCHEMA: DynamicSheetSchema = {
  label: 'Rowing',
  headerRow: 1,
  dataStartRow: 2,
  columns: [
    { headerMatches: ['NAME'], field: 'name', type: 'string' },
    { headerMatches: ['TIME'], field: 'time', type: 'string' },
    { headerMatches: ['AVG SPLIT'], field: 'splitTime', type: 'string' },
    { headerMatches: ['AVG RATE'], field: 'strokeRate', type: 'number' },
    { headerMatches: ['AVG WATTS'], field: 'avgWatts', type: 'number' },
    // E.g. we could add interval columns, or leave it dynamically captured.
    // For now we map what we need to RowingRecord.
  ],
};

export function columnIndexToLetter(index: number): string {
  let letter = '';
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}

export function getDataRange(schema: SheetSchema | DynamicSheetSchema): string {
  if ('sheetName' in schema) {
    const lastDataCol = Math.max(
      ...schema.columns.map((c) => c.index),
      columnLetterToIndex(schema.writeBackColumns.insightColumn),
      columnLetterToIndex(schema.writeBackColumns.scoreColumn)
    );
    const lastLetter = columnIndexToLetter(lastDataCol);
    return `${schema.sheetName}!A${schema.dataStartRow}:${lastLetter}`;
  } else {
    return '__ALL_ROWING_TABS__';
  }
}

export function getHeaderRange(schema: SheetSchema): string {
  const lastDataCol = Math.max(
    ...schema.columns.map((c) => c.index),
    columnLetterToIndex(schema.writeBackColumns.insightColumn),
    columnLetterToIndex(schema.writeBackColumns.scoreColumn)
  );
  const lastLetter = columnIndexToLetter(lastDataCol);
  return `${schema.sheetName}!A${schema.headerRow}:${lastLetter}${schema.headerRow}`;
}

function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1; // 0-based
}
