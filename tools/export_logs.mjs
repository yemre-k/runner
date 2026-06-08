// tools/export_logs.mjs
//
// LOCAL coordinator tool — produces the JSONL the GPAF Team tool expects.
// NEVER deploy this and NEVER hardcode/commit the service_role key.
// The service_role key bypasses Row Level Security; keep it in an ENV VAR.
//
// Run:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... GAME_ID=GM-... node tools/export_logs.mjs
//
// Requires Node 18+ (global fetch). Writes runner_logs.jsonl (gitignored).

import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const gameId = process.env.GAME_ID;

if (!url || !key || !gameId) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_KEY, GAME_ID');
  process.exit(1);
}

const q = `${url}/rest/v1/runner_events?game_id=eq.${encodeURIComponent(gameId)}` +
  `&select=ts,player_pseudo_id,session_id,game_id,event_type,payload&order=ts.asc`;

const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
if (!res.ok) {
  console.error('Fetch failed', res.status, await res.text());
  process.exit(1);
}

const rows = await res.json();

const lines = rows.map(r => JSON.stringify({
  ts: new Date(r.ts).toISOString(),
  playerPseudoId: r.player_pseudo_id,
  sessionId: r.session_id,
  gameId: r.game_id,
  eventType: r.event_type,
  payload: r.payload ?? {}
}));

writeFileSync('runner_logs.jsonl', lines.join('\n') + (lines.length ? '\n' : ''));
console.log(`Wrote runner_logs.jsonl with ${lines.length} events.`);
