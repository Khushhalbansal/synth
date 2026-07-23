# Synth MVP — Health + Training Data Fusion

A full-stack application that fuses health/wellness data from Apple HealthKit or Google Health Connect with structured training data from Google Sheets (triathlon + rowing), uses an LLM (Anthropic) to find cross-domain patterns, and writes synthesized insights back to the source sheets.

## Architecture

```
[Apple Health / Health Connect] ──(on-device SDK)──► [Expo app]
                                                          │
                                                          │  POST /sync  (health snapshot)
                                                          ▼
                                                  [Deployed backend]
                                                   │            │
                                    reads/writes   │            │  computes heuristics
                                    Google Sheets  ▼            ▼  (rolling avg, z-score,
                                             [Sheets API]    correlation) then calls
                                                   │            │
                                                   │            ▼
                                                   │     [Anthropic API]
                                                   │            │
                                                   └────► synthesized insight
                                                          │
                                                          ▼
                                              write insight back to sheet(s)
                                                          │
                                                          ▼
                                                  return JSON to app
                                                          │
                                                          ▼
                                              [App renders insights + sheet state]
```

## Design Decision: LLM with Heuristics (Not a Custom ML Model)

This system uses the **Anthropic API (Claude)** with precomputed heuristic statistics rather than a custom-trained ML model. This was a deliberate architectural decision:

- **Dataset size is prohibitively small.** The dataset consists of two spreadsheets and one person's device health history — nowhere near enough volume to train or validate a custom model without overfitting or producing noise dressed up as signal.
- **The insight type matches LLM strengths.** The insights needed — cross-domain correlations between HRV, sleep, recovery, and two different sport contexts (triathlon, rowing) — are exactly the kind of qualitative pattern-finding an LLM does well zero-shot, with heuristic pre-processing (rolling averages, z-scores, simple correlation coefficients) computed in code and handed to the LLM as structured context rather than asking it to do arithmetic.
- **Timeline-to-value.** Given the timeline, an LLM path ships an inspectable, explainable MVP. A custom model would consume the available time on data pipeline and validation work with no guarantee of a usable model at the end.
- **Tradeoff acknowledged.** LLM output is less rigorously falsifiable than a validated model and can hallucinate correlations. This is mitigated by:
  - The backend computes actual heuristic statistics (Pearson correlation, rolling deltas, z-scores, trend detection) **first**.
  - The LLM prompt instructs Claude to **interpret and explain** these precomputed numbers rather than inventing its own.
  - The LLM response includes `citedMetrics` so the app can verify which numbers the insight references.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | Expo (React Native) with EAS Dev Client |
| Backend | Node.js + Express, TypeScript |
| Health Data | `react-native-health` (iOS/HealthKit) / `react-native-health-connect` (Android) |
| Sheets | Google Sheets API v4 via service account |
| LLM | Anthropic API (`claude-sonnet-4-6`) |
| Auth | Bearer token via `expo-secure-store` |
| Deploy | Render (free tier web service) |

## Repository Structure

```
synth/
├── app/                    # Expo React Native app
│   ├── src/
│   │   ├── components/     # InsightCard, SheetTable, SyncButton, ErrorBanner
│   │   ├── screens/        # HomeScreen
│   │   ├── services/       # health.ts, api.ts, auth.ts
│   │   └── types/          # Shared TypeScript types
│   ├── App.tsx
│   ├── app.json
│   ├── eas.json
│   └── .env.example
│
├── server/                 # Node.js + Express backend
│   ├── src/
│   │   ├── heuristics/     # stats.ts (rolling avg, z-score, correlation), merge.ts
│   │   ├── llm/            # client.ts (Anthropic SDK), prompts.ts
│   │   ├── middleware/      # auth.ts, rateLimit.ts
│   │   ├── pipeline/       # sync.ts (full orchestrator)
│   │   ├── routes/         # sync.ts, state.ts, health.ts
│   │   ├── sheets/         # schema.ts, client.ts, mapper.ts
│   │   └── types/          # Shared TypeScript types
│   ├── Dockerfile
│   └── .env.example
│
├── README.md
└── .gitignore
```

## Running Locally

### Prerequisites

- Node.js 20+
- npm 10+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- A Google Cloud project with Sheets API enabled + service account
- An Anthropic API key
- Two Google Sheets shared with the service account email

### 1. Server

```bash
cd server
cp .env.example .env
# Fill in .env with real values (see Environment Variables below)
npm install
npm run dev
```

The server runs at `http://localhost:3001`. Verify with:
```bash
curl http://localhost:3001/health
```

### 2. App

```bash
cd app
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to your backend URL
npm install

# Create a development build (required — Expo Go won't work)
npx expo prebuild --platform android --clean
eas build --platform android --profile development

# After installing the dev build on your device/emulator:
npx expo start --dev-client
```

## Deploying to Render (from Scratch)

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial Synth MVP"
git remote add origin https://github.com/YOUR_USERNAME/synth.git
git push -u origin main
```

### Step 2: Create Render Web Service

1. Go to [render.com](https://render.com) and sign in.
2. Click **New → Web Service**.
3. Connect your GitHub repository.
4. Configure:
   - **Name:** `synth-backend`
   - **Root Directory:** `server`
   - **Environment:** `Docker`
   - **Instance Type:** `Free`
5. Click **Create Web Service**.

### Step 3: Add Environment Variables

In the Render dashboard for your service, go to **Environment** and add:

| Variable | Value |
|---|---|
| `API_AUTH_TOKEN` | Generate a strong random token (e.g., `openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key from [console.anthropic.com](https://console.anthropic.com) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The **entire JSON content** of your service account key file (paste as one line) |
| `TRIATHLON_SHEET_ID` | The spreadsheet ID from the triathlon sheet URL |
| `ROWING_SHEET_ID` | The spreadsheet ID from the rowing sheet URL |

### Step 4: Verify

After deploy completes (1-3 minutes), test:

```bash
# Health check (no auth)
curl https://synth-backend.onrender.com/health

# State check (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" https://synth-backend.onrender.com/state
```

### Step 5: Update App Config

Set `EXPO_PUBLIC_API_URL` in the app's `.env` to your Render URL.

> **Note:** Render's free tier spins down after 15 minutes of inactivity. The first request after idle will take 30-60 seconds (cold start). This is acceptable for an MVP with manual sync triggers.

## Environment Variables

### Server (`server/.env`)

| Variable | Description |
|---|---|
| `PORT` | Server port (Render provides this automatically) |
| `API_AUTH_TOKEN` | Shared bearer token for app → backend auth |
| `ANTHROPIC_API_KEY` | Anthropic API key (server-side only) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON content of the Google service account key |
| `TRIATHLON_SHEET_ID` | Google Sheet ID for triathlon training data |
| `ROWING_SHEET_ID` | Google Sheet ID for rowing data |

### App (`app/.env`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend URL (e.g., `https://synth-backend.onrender.com`) |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Liveness check |
| `GET` | `/state` | Yes | Current sheet data + last insight |
| `POST` | `/sync` | Yes | Full pipeline: read sheets → merge health data → compute heuristics → LLM insight → write back |

### POST /sync Request Body

```json
{
  "healthData": {
    "startDate": "2026-06-23T00:00:00Z",
    "endDate": "2026-07-23T00:00:00Z",
    "dailyMetrics": [
      {
        "date": "2026-07-22",
        "steps": 8500,
        "restingHeartRate": 58,
        "hrv": 45,
        "sleepDurationMin": 420,
        "activeEnergyKcal": 350
      }
    ],
    "workouts": [
      {
        "date": "2026-07-22",
        "type": "running",
        "durationMin": 45,
        "distanceKm": 8.5,
        "avgHeartRate": 155
      }
    ]
  }
}
```

## Sheet Schema

All column mappings live in `server/src/sheets/schema.ts`. This is the **only file** to change when the real sheet layout is known.

### Triathlon Sheet (current placeholders)

| Column | Field | Type |
|---|---|---|
| A | date | date |
| B | duration_min | number |
| C | distance_km | number |
| D | avg_hr | number |
| E | rpe | number |
| F | notes | string |
| G | synth_insight | string (write-back) |
| H | synth_score | number (write-back) |

### Rowing Sheet (current placeholders)

| Column | Field | Type |
|---|---|---|
| A | date | date |
| B | distance_m | number |
| C | split_time | string |
| D | stroke_rate | number |
| E | avg_hr | number |
| F | notes | string |
| G | synth_insight | string (write-back) |
| H | synth_score | number (write-back) |

## What the Insights Mean

The backend computes several heuristic metrics before asking the LLM for interpretation:

- **Rolling Averages (7-day):** Smoothed trends for HRV, resting HR, sleep, and training volume.
- **Z-Scores:** How far today's value deviates from the historical mean. Values > 2 or < -2 flag as anomalies.
- **Pearson Correlation Coefficients:** Measures linear relationships between metrics (e.g., HRV ↔ training load). Values from -1 (inversely correlated) to +1 (directly correlated).
- **Trend Deltas:** Percentage change of the latest value vs. the 7-day rolling average. Flagged as ↑ (>5%), ↓ (<-5%), or → (stable).
- **Training Score (1-100):** A composite score from the LLM reflecting overall training/recovery balance.

## Security Decisions

### 1. Secrets Management

All sensitive credentials are stored as **environment variables** on the deploy platform (Render's secret manager):
- `ANTHROPIC_API_KEY` — never in client code, never in the repo
- `GOOGLE_SERVICE_ACCOUNT_JSON` — full JSON key content, never committed
- `API_AUTH_TOKEN` — shared secret between app and backend

**Rationale:** Environment variables are the industry standard for secret management on PaaS platforms. Render encrypts secrets at rest and injects them at runtime. The `.env` file is in `.gitignore`; a `.env.example` with empty values is committed instead.

### 2. Authentication

All backend endpoints (except `/health`) require a `Bearer` token in the `Authorization` header. The token is validated against `API_AUTH_TOKEN` on every request.

**On-device storage:** The token is stored using `expo-secure-store` (iOS Keychain / Android Keystore), **not** `AsyncStorage` or hardcoded in JS.

**Rationale:** While a simple bearer token isn't as robust as OAuth, it's appropriate for a single-user MVP. The token never leaves the device's secure enclave / keystore.

### 3. Transport Security

All traffic is over **HTTPS**. Render handles TLS termination automatically for all web services — no manual certificate management required.

**Rationale:** HTTPS is enforced by default on Render. The app communicates exclusively over HTTPS URLs.

### 4. Google Sheets Access Scope

The Google service account is granted access to **only the two specific sheets** (triathlon + rowing) by sharing them with the service account email. No domain-wide delegation is used.

**Rationale:** Principle of least privilege. The service account can only access sheets explicitly shared with it.

### 5. Health Data Handling

- Health data is collected **transiently** on-device — it's sent to the backend and not persisted locally.
- The backend processes health data **in memory only** — no database storage, no plaintext logging.
- Health data is never logged in server logs. Only aggregate statistics (e.g., "processing 30 daily metrics") are logged.

**Rationale:** Health data is sensitive PII. By keeping it transient, we minimize the attack surface. The source of truth remains the device's HealthKit/Health Connect database.

### 6. Rate Limiting

The `/sync` endpoint is rate-limited to **1 request per 30 seconds** per token (server-side via `express-rate-limit`). The app's Sync button has a matching 30-second cooldown.

**Rationale:** Prevents accidental duplicate writes to Google Sheets and excessive Anthropic API usage from button-mashing.

## License

MIT
