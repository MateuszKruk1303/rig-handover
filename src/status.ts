import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import type { Night } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

/** A night on disk with its per-log-line counts; `counts` is null when the night can't be read. */
export type NightSummary = {
  night: string;
  counts: { ok: number; retry: number; fail: number; unreadable: number } | null;
};

export function countNight(night: Night | null): NightSummary['counts'] {
  if (!night) return null;
  const counts = { ok: 0, retry: 0, fail: 0, unreadable: night.badLines };
  for (const r of night.rows) {
    counts.ok += r.runs - r.retries - r.fails;
    counts.retry += r.retries;
    counts.fail += r.fails;
  }
  return counts;
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({
      night,
      counts: countNight(readNight(config.runsDir, night)),
    })),
  };
}
