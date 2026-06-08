// tools/validate_logs.mjs
//
// LOCAL validator for runner_logs.jsonl (produced by export_logs.mjs).
// Reports pass/fail for each GPAF format check. Local-only; commits
// no data. Exit code 0 = all pass, 1 = any failure.
//
// Run:
//   GAME_ID=GM-... node tools/validate_logs.mjs [path]
// Defaults path to runner_logs.jsonl in the current directory.

import { readFileSync } from 'node:fs';

const path = process.argv[2] || 'runner_logs.jsonl';
const expectedGameId = process.env.GAME_ID || null;
const EXPECTED_KEYS = ['ts', 'playerPseudoId', 'sessionId', 'gameId', 'eventType', 'payload'];

let text;
try {
  text = readFileSync(path, 'utf8');
} catch (e) {
  console.error(`Cannot read ${path}: ${e.message}`);
  process.exit(1);
}

const lines = text.split('\n').filter(l => l.trim().length > 0);

const checks = {
  'every line is valid JSON': true,
  'every line has exactly the 6 fields': true,
  'gameId on every line equals GAME_ID': expectedGameId ? true : 'SKIP (set GAME_ID env to check)',
  'score_update lines carry a numeric payload.score': true,
  'each session has >=1 level_complete or session_end': true,
};
const notes = [];

const sessions = new Map(); // sessionId -> { hasEnd: bool }
let parsed = [];

lines.forEach((line, i) => {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch (e) {
    checks['every line is valid JSON'] = false;
    notes.push(`line ${i + 1}: invalid JSON`);
    return;
  }
  parsed.push(obj);

  const keys = Object.keys(obj);
  if (keys.length !== 6 || !EXPECTED_KEYS.every(k => keys.includes(k))) {
    checks['every line has exactly the 6 fields'] = false;
    notes.push(`line ${i + 1}: keys = [${keys.join(',')}]`);
  }

  if (expectedGameId && obj.gameId !== expectedGameId) {
    checks['gameId on every line equals GAME_ID'] = false;
    notes.push(`line ${i + 1}: gameId='${obj.gameId}' != '${expectedGameId}'`);
  }

  if (obj.eventType === 'score_update') {
    const s = obj.payload && obj.payload.score;
    if (typeof s !== 'number' || Number.isNaN(s)) {
      checks['score_update lines carry a numeric payload.score'] = false;
      notes.push(`line ${i + 1}: score_update payload.score not numeric (${JSON.stringify(s)})`);
    }
  }

  if (obj.sessionId != null) {
    if (!sessions.has(obj.sessionId)) sessions.set(obj.sessionId, { hasEnd: false });
    if (obj.eventType === 'level_complete' || obj.eventType === 'session_end') {
      sessions.get(obj.sessionId).hasEnd = true;
    }
  }
});

for (const [sid, info] of sessions) {
  if (!info.hasEnd) {
    checks['each session has >=1 level_complete or session_end'] = false;
    notes.push(`session '${sid}': no level_complete or session_end`);
  }
}

console.log(`Validating ${path} — ${lines.length} lines, ${sessions.size} session(s)\n`);
let allPass = true;
for (const [name, result] of Object.entries(checks)) {
  const label = result === true ? 'PASS' : (result === false ? 'FAIL' : result);
  if (result === false) allPass = false;
  console.log(`[${label}] ${name}`);
}
if (notes.length) {
  console.log('\nDetails:');
  notes.slice(0, 20).forEach(n => console.log('  - ' + n));
  if (notes.length > 20) console.log(`  …and ${notes.length - 20} more`);
}
console.log(`\n${allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
process.exitCode = allPass ? 0 : 1;
