import { mapRowingRows } from './src/sheets/mapper';

const tabNames = [
  '316 2k',
  '311 2x6k',
  '32 2k prep',
  '223 4x1k',
  '217 9x2k',
  '29 2x6k',
  '130 6k',
  '126 2x6k',
  '113 6K',
  '1027 3x12',
  '1020 30',
  '1013 2x6k',
  '929 2x6k',
  '919 6k',
  '915 2x6k',
  '98 2x6k',
  'Names',
];

const mockRows: any[][] = [];

for (const tab of tabNames) {
  mockRows.push(['__TAB_NAME__', tab]);
  mockRows.push(['NAME', 'TIME', 'AVG SPLIT']);
  mockRows.push(['Doe, John', '20:00', '1:55.0']);
}

console.log('--- RUNNING DATE PARSING VERIFICATION ---');
// Filter out Names and Synth_Insights tab to simulate client.ts behavior
const filteredMockRows = mockRows.filter((r, idx) => {
  // If this is a __TAB_NAME__ row and it is Names or Synth_Insights, skip it and its data
  // In our mockRows, each tab has 3 rows: __TAB_NAME__, headers, and data row.
  const tabIndex = Math.floor(idx / 3);
  const tabName = tabNames[tabIndex];
  return tabName.toLowerCase() !== 'names' && tabName.toLowerCase() !== 'synth_insights';
});

const records = mapRowingRows(filteredMockRows);

for (const r of records) {
  const dStr = r.distanceM === null ? 'null' : String(r.distanceM);
  const cdStr = r.computedTotalDistanceM === null ? 'null' : String(r.computedTotalDistanceM);
  console.log(`Tab: "${r.rawTabName.padEnd(12)}" -> parsedDate: ${r.date === null ? 'null      ' : String(r.date).padEnd(10)} | dateAmbiguous: ${String(r.dateAmbiguous).padEnd(5)} | distanceM: ${dStr.padEnd(6)} | computedDistance: ${cdStr.padEnd(6)} | workoutType: "${r.workoutType}"`);
}
console.log('-----------------------------------------');

console.log(`Rowing Records Count (excluding "Names"): ${records.length}`);
console.log('Workout Types mapped:', records.map(r => r.workoutType));
console.log('Is "Names" in workoutTypes?', records.some(r => r.workoutType.toLowerCase() === 'names'));

// Simulate merge.ts training load calculation for '217 9x2k'
const record217 = records.find(r => r.rawTabName === '217 9x2k');
if (record217) {
  const dist = record217.distanceM ?? record217.computedTotalDistanceM ?? 0;
  console.log(`\nSimulated merge.ts training load for "217 9x2k":`);
  console.log(`- distanceM: ${record217.distanceM}`);
  console.log(`- computedTotalDistanceM: ${record217.computedTotalDistanceM}`);
  console.log(`- final training load dist: ${dist} (Expected: 18000)`);
} else {
  console.log('Could not find record 217 9x2k');
}
console.log('-----------------------------------------');
