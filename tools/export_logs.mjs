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

// Order by ts asc with id as a stable tiebreaker so pagination is
// consistent across pages (ts can have ties).
const q = `${url}/rest/v1/runner_events?game_id=eq.${encodeURIComponent(gameId)}` +
  `&select=ts,player_pseudo_id,session_id,game_id,event_type,payload&order=ts.asc,id.asc`;

// Supabase/PostgREST caps a single response (default 1000 rows), so we
// page through with Range headers until every row is fetched.
const PAGE = 1000;
const rows = [];
let from = 0;
let total = Infinity;
while (from < total) {
  const res = await fetch(q, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Range-Unit': 'items',
      Range: `${from}-${from + PAGE - 1}`,
      Prefer: 'count=exact'
    }
  });
  if (!res.ok && res.status !== 206) {
    console.error('Fetch failed', res.status, await res.text());
    process.exit(1);
  }
  const batch = await res.json();
  rows.push(...batch);
  const cr = res.headers.get('content-range'); // e.g. "0-999/1623"
  if (cr && cr.includes('/')) {
    const t = parseInt(cr.split('/')[1], 10);
    if (!Number.isNaN(t)) total = t;
  }
  if (batch.length === 0) break;
  from += batch.length;
}

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
