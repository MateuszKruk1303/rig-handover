import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('finds 5 jobs and 1 bad line, sorted by job', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts retries and keeps the last error', () => {
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, fails: 0, lastStatus: 'ok', lastError: 'upstream 503' });
  });

  it('keeps a failed job and a null owner', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', fails: 1, lastError: 'quota exceeded' });
    expect(row('digest/render')?.owner).toBeNull();
  });

  it('keeps the offsets as written', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
      lastError: 'lock held',
    });
  });
});

describe('readNight edges', () => {
  it('returns null for a missing night', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('returns null for a malformed night', () => {
    expect(readNight('runs', '../x')).toBeNull();
    expect(readNight('runs', '2026-10-28/../../package')).toBeNull();
  });

  it('reads an empty file as no rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-reader-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts bad lines and skips blank ones, never throws', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-reader-'));
    const lines = [
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"ok"}',
      '',
      '   ',
      'not json',
      '[1,2]',
      'null',
      '{"at":"x","job":"a","status":"maybe","owner":"o"}',
      '{"at":"x","job":"a","status":"ok","owner":5}',
      '{"at":"x","job":"a","status":"ok","owner":"o","error":7}',
      '{"job":"a","status":"ok","owner":"o"}',
      '{"at":"2026-01-02T02:00:00+02:00","job":"a","status":"retry","owner":"o","error":"boom"}',
    ];
    writeFileSync(join(dir, '2026-01-02.jsonl'), lines.join('\n'));
    const n = readNight(dir, '2026-01-02');
    expect(n?.badLines).toBe(7);
    expect(n?.rows).toEqual([
      {
        job: 'a',
        owner: 'o',
        runs: 2,
        retries: 1,
        fails: 0,
        lastStatus: 'retry',
        lastError: 'boom',
        firstAt: '2026-01-02T01:00:00+02:00',
        lastAt: '2026-01-02T02:00:00+02:00',
      },
    ]);
  });
});
