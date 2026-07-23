// ============================================================
// Synth MVP — Google Sheets API Client
// ============================================================
// Reads/writes Google Sheets via service account.
// Credentials loaded from GOOGLE_SERVICE_ACCOUNT_JSON env var
// (entire JSON key pasted as a string, not a file path).
// ============================================================

import { google, sheets_v4 } from 'googleapis';

let sheetsClient: sheets_v4.Sheets | null = null;

/**
 * Initialize the Google Sheets API client with service account credentials.
 * Credentials come from the GOOGLE_SERVICE_ACCOUNT_JSON environment variable.
 */
function getClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set. ' +
      'Paste the entire service account JSON key content into this variable.'
    );
  }

  let credentials: { client_email?: string; private_key?: string; [key: string]: unknown };
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. ' +
      'Ensure the entire JSON key file content is pasted as one string.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * List all sheet (tab) names in a spreadsheet.
 */
export async function listTabs(spreadsheetId: string): Promise<string[]> {
  const client = getClient();
  const response = await client.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return (response.data.sheets || [])
    .map((s) => s.properties?.title)
    .filter((title): title is string => !!title);
}

/**
 * Read a range of values from a Google Sheet.
 * Returns a 2D array of strings (rows × columns).
 */
export async function readSheet(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const client = getClient();

  if (range === '__ALL_ROWING_TABS__') {
    const tabs = await listTabs(spreadsheetId);
    const allRows: string[][] = [];
    for (const tab of tabs) {
      if (tab.toLowerCase() === 'names' || tab.toLowerCase() === 'synth_insights') continue;
      // Quote the tab name in A1 notation in case of spaces/numbers
      const tabRange = `'${tab}'!A1:Z`;
      const response = await client.spreadsheets.values.get({
        spreadsheetId,
        range: tabRange,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });
      const data = (response.data.values as string[][]) || [];
      if (data.length > 0) {
        allRows.push(['__TAB_NAME__', tab]);
        allRows.push(...data);
      }
    }
    return allRows;
  }

  const response = await client.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  // Return empty array if no data
  return (response.data.values as string[][]) || [];
}

/**
 * Write values to a specific range in a Google Sheet.
 * Overwrites existing data in the specified range.
 */
export async function writeSheet(
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][]
): Promise<void> {
  const client = getClient();

  await client.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

/**
 * Write to specific cells — used for writing back insights to individual rows.
 * Uses batchUpdate to write multiple non-contiguous cells efficiently.
 */
export async function batchWriteCells(
  spreadsheetId: string,
  updates: Array<{ range: string; values: (string | number | null)[][] }>
): Promise<void> {
  const client = getClient();

  await client.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates.map((u) => ({
        range: u.range,
        values: u.values,
      })),
    },
  });
}

/**
 * Append rows to the bottom of a sheet range.
 */
export async function appendRows(
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][]
): Promise<void> {
  const client = getClient();

  // Extract tab name from range (e.g. "Synth_Insights!A1" or "'Synth Insights'!A1")
  const sheetNameMatch = range.match(/^'?(.*?)'?!/);
  const tabName = sheetNameMatch ? sheetNameMatch[1] : '';

  if (tabName) {
    const tabs = await listTabs(spreadsheetId);
    if (!tabs.some(t => t.toLowerCase() === tabName.toLowerCase())) {
      console.log(`[SHEETS] Creating missing tab "${tabName}" in spreadsheet ${spreadsheetId}...`);
      await client.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: tabName }
              }
            }
          ]
        }
      });

      // If it's the Synth_Insights tab, write the header row first
      if (tabName.toLowerCase() === 'synth_insights') {
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['Date', 'Athlete', 'Session', 'Insight', 'Score', 'Generated At']]
          }
        });
      }
    }
  }

  await client.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}
