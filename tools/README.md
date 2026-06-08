# GPAF log export tool (coordinator-only)

`export_logs.mjs` pulls every event row for one game from Supabase and
writes `runner_logs.jsonl` in the exact shape the **GPAF Team tool**
expects (one JSON object per line, `ts` as ISO-8601):

```json
{"ts":"...","playerPseudoId":"...","sessionId":"...","gameId":"GM-...","eventType":"...","payload":{}}
```

## Run

Node 18+ required (global `fetch`). From the repo root:

```bash
SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
SUPABASE_SERVICE_KEY=YOUR-SERVICE-ROLE-KEY \
GAME_ID=GM-XXXXXXXXXXXX \
node tools/export_logs.mjs
```

On Windows PowerShell:

```powershell
$env:SUPABASE_URL="https://YOUR-PROJECT.supabase.co"; `
$env:SUPABASE_SERVICE_KEY="YOUR-SERVICE-ROLE-KEY"; `
$env:GAME_ID="GM-XXXXXXXXXXXX"; `
node tools/export_logs.mjs
```

It prints the number of events written and creates `runner_logs.jsonl`
in the current directory.

## Validate the export

After exporting, sanity-check the file before submitting:

```bash
GAME_ID=GM-XXXXXXXXXXXX node tools/validate_logs.mjs runner_logs.jsonl
```

It reports pass/fail for each GPAF check (valid JSON per line, exactly
the 6 fields, `gameId` matches `GAME_ID`, `score_update` carries a
numeric `payload.score`, and every session has at least one
`level_complete` or `session_end`). Exit code is non-zero on any
failure.

## ⚠️ NEVER commit the service key

**The `SUPABASE_SERVICE_KEY` (service_role) bypasses Row Level Security —
treat it like a root password.**

- **Never** hardcode it in any file, script, or commit.
- **Never** paste it into the game (`index.html` ships to the browser).
- Pass it only via an environment variable at run time.
- `.env`, `*.key`, and `runner_logs.jsonl` are gitignored — keep it that way.
- This tool is **local-only**; do not deploy it anywhere.
