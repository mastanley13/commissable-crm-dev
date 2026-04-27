# Playwright E2E

This folder contains the initial browser automation harness for reconciliation smoke testing.

## Required environment variables

Set these in the PowerShell session before running Playwright:

```powershell
$env:PLAYWRIGHT_EMAIL = "your-email@example.com"
$env:PLAYWRIGHT_PASSWORD = "your-password"
```

Optional:

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
$env:PLAYWRIGHT_ENV_LABEL = "clone-2"
$env:PLAYWRIGHT_FIXTURE_VERSION = "working-m1-alignment"
```

Notes:

- The current local reconciliation workflow typically runs against `http://127.0.0.1:3000`
- The current test DB proxy is expected on `127.0.0.1:5433`
- `PLAYWRIGHT_ENV_LABEL` and `PLAYWRIGHT_FIXTURE_VERSION` are saved into reconciliation-suite run metadata and help distinguish environment-specific runs

## Run

```powershell
npm run pw:test
```

OpenClaw browser smoke automation:

```powershell
node scripts/openclaw/verify-chat-gateway.cjs
$env:OPENCLAW_SMOKE_MODE = "live"
node scripts/openclaw/run-browser-smoke.cjs
```

Headed mode:

```powershell
npm run pw:test -- --headed
```

Single file:

```powershell
npm run pw:test -- tests/e2e/reconciliation.smoke.spec.ts --headed
```

Run the full reconciliation manifest suite with dedicated history:

```powershell
npm run pw:recon:test
```

Representative local full-suite setup:

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
$env:PLAYWRIGHT_EMAIL = "admin@commissable.test"
$env:PLAYWRIGHT_PASSWORD = "password123"
$env:PLAYWRIGHT_ENV_LABEL = "clone-2"
$env:PLAYWRIGHT_FIXTURE_VERSION = "working-m1-alignment"
npm run pw:recon:test
```

## Current coverage

- Login through the real UI
- Open `/reconciliation`
- Verify the deposits list loads
- Open the first deposit detail when one exists
- `PW-01`: 1:1 direct-match candidate workflow
- `PW-02`: 1:M split-allocation wizard workflow
- `PW-03`: M:1 rollup-allocation wizard workflow
- `PW-04`: variance/rate reconciliation alert workflow
- `PW-05`: bundle and rip-replace wizard workflow
- `PW-06`: adjustment and undo/unmatch workflow coverage
- `PW-08`: unmatched and partial-match workflow coverage

## Saved Auth State

- Browser auth is created once per run by [`auth.setup.ts`](C:/Users/Administrator/.cursor-projects/projects/commissable-crm-dev/tests/e2e/auth.setup.ts)
- Saved state is written to `.artifacts/playwright/auth/user.json`
- Specs then reuse that state instead of logging in individually

## Reports And History

- Each `npm run pw:test` invocation creates a timestamped run folder under `.artifacts/playwright/history/`
- Each run writes:
  - `html/`
  - `results.json`
  - `results.xml`
  - `test-results/`
- Open the latest report with:

```powershell
npm run pw:report
```

- Open a specific run by run id:

```powershell
npm run pw:report -- 2026-04-03_15-22-10
```

## Reconciliation Suite History

- Each `npm run pw:recon:test` invocation creates a dedicated run folder under `.artifacts/playwright/reconciliation-suite/history/`
- The latest full reconciliation suite run is tracked in `.artifacts/playwright/reconciliation-suite/latest.json`
- Filtered reconciliation runs may write `.artifacts/playwright/reconciliation-suite/latest-partial.json`
- Each dedicated reconciliation suite run writes:
  - `run-metadata.json`
  - `reconciliation-summary.json`
  - `reconciliation-summary.md`
  - `reconciliation-scenarios.csv`
  - `scenario-results/`
  - `html/`
  - `test-results/`
  - `results.json`
  - `results.xml`

Open the latest reconciliation suite report with:

```powershell
npm run pw:recon:report
```

Export the latest reconciliation suite summary again if needed:

```powershell
npm run pw:export:reconciliation
```
