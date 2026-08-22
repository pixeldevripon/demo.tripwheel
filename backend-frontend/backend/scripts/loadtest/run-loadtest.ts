/**
 * One-command runner for the booking load test (hardening F7) - so the VPS
 * operation is pure pnpm, no hand-exported env:
 *
 *   pnpm loadtest:run hot 100          # one scenario (vus, iterations=vus)
 *   pnpm loadtest:run spread 500
 *   pnpm loadtest:full                 # the whole runbook ladder + asserts
 *
 * Reads TOUR_ID / DEPARTURE_ID(S) from .loadtest-env.json (written by
 * `pnpm loadtest:seed`) and INTERNAL_API_SECRET from .env, then drives k6 and
 * the postcondition checker with the right env per scenario. API defaults to
 * http://localhost:5050; override with API=https://api.example.com to test
 * through the proxy. Exits non-zero on the FIRST failing gate, exactly like
 * running the runbook by hand.
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const ENV_FILE = join(__dirname, '.loadtest-env.json');
const RUSH = join(__dirname, 'rush.js');
const ASSERT = join(__dirname, 'assert-postconditions.ts');

function die(msg: string): never {
  console.error(`\n${msg}`);
  process.exit(1);
}

if (!existsSync(ENV_FILE)) {
  die('No live fixture. Run `pnpm loadtest:seed` first.');
}
if (spawnSync('k6', ['version'], { stdio: 'ignore' }).error) {
  die(
    'k6 is not installed. See scripts/loadtest/README.md (brew/apt install k6).',
  );
}

const fixture = JSON.parse(readFileSync(ENV_FILE, 'utf8')) as {
  tourId: string;
  hotDepartureId: string;
  spreadDepartureIds: string[];
};

const baseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  API: process.env.API ?? 'http://localhost:5050',
  TOUR_ID: fixture.tourId,
  DEPARTURE_ID: fixture.hotDepartureId,
  DEPARTURE_IDS: fixture.spreadDepartureIds.join(','),
  INTERNAL_KEY: process.env.INTERNAL_API_SECRET ?? '',
};

function k6run(scenario: string, vus: number, iterations: number): void {
  console.log(
    `\n=== ${scenario} VUS=${vus} ITERATIONS=${iterations} (${baseEnv.API}) ===`,
  );
  const res = spawnSync('k6', ['run', RUSH], {
    stdio: 'inherit',
    env: {
      ...baseEnv,
      SCENARIO: scenario,
      VUS: String(vus),
      ITERATIONS: String(iterations),
    },
  });
  if (res.status !== 0)
    die(`k6 FAILED for ${scenario} (exit ${res.status ?? 'signal'})`);
}

function assertDb(expectFull: boolean): void {
  const res = spawnSync(
    'node',
    ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', ASSERT],
    {
      stdio: 'inherit',
      cwd: join(__dirname, '..', '..'),
      env: { ...baseEnv, ...(expectFull ? { EXPECT_FULL: '1' } : {}) },
    },
  );
  if (res.status !== 0) die('Postconditions FAILED');
}

const [mode = 'hot', vusArg, iterArg] = process.argv.slice(2);

if (mode === 'full') {
  // The runbook ladder. Hot scenarios assert EXPECT_FULL (demand > capacity
  // by construction); the later hot run doubles as the sold-out shed test.
  k6run('hot', 100, 100);
  assertDb(true);
  k6run('hot', 1000, 1000);
  assertDb(true);
  k6run('spread', 500, 500);
  assertDb(false);
  k6run('mixed', 100, 1000);
  assertDb(false);
  console.log(
    '\nAll scenarios passed. Record p95/verdicts in scripts/loadtest/README.md,' +
      ' then `pnpm loadtest:cleanup`.',
  );
} else {
  const vus = Number(vusArg ?? 100);
  const iterations = Number(iterArg ?? vus);
  if (!['hot', 'spread', 'mixed'].includes(mode) || !Number.isFinite(vus)) {
    die(
      'Usage: pnpm loadtest:run <hot|spread|mixed> [vus] [iterations] | pnpm loadtest:full',
    );
  }
  k6run(mode, vus, iterations);
  assertDb(mode === 'hot');
}
