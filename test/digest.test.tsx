import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

let runsDir = '';

const lines = (...rows: string[]) => rows.join('\n') + '\n';

beforeAll(() => {
  runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-runs-'));
  fs.writeFileSync(
    path.join(runsDir, '2026-11-01.jsonl'),
    lines(
      '{"at":"2026-11-01T01:00:00+01:00","job":"b/job","status":"retry","owner":"rook","error":"x"}',
      '{"at":"2026-11-01T01:05:00+01:00","job":"b/job","status":"ok","owner":"rook"}',
      '{"at":"2026-11-01T02:00:00+01:00","job":"a/job","status":"fail","owner":null,"error":"boom"}',
    ),
  );
  fs.writeFileSync(path.join(runsDir, '2026-11-02.jsonl'), '');
  fs.writeFileSync(
    path.join(runsDir, '2026-11-03.jsonl'),
    lines(
      '{"at":"2026-11-03T01:00:00+01:00","job":"c/job","status":"ok","owner":"rook"}',
      '{"at":"2026-11-03T02:00',
    ),
  );
});

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

const app = () =>
  createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });

type DigestJson = {
  night: string;
  rows: { job: string }[];
  badLines: number;
};

describe('digest page and JSON', () => {
  it('200 for a night with a file, rows sorted by job', async () => {
    const res = await app().request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.night).toBe('2026-11-01');
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
  });

  it('page shows both jobs, a/job before b/job', async () => {
    const res = await app().request('/digest/2026-11-01');
    expect(res.status).toBe(200);
    const html = await res.text();
    const a = html.indexOf('a/job');
    const b = html.indexOf('b/job');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(-1);
    expect(a).toBeLessThan(b);
  });

  it('404 for a night with no file, on both routes', async () => {
    const page = await app().request('/digest/2026-11-09');
    const json = await app().request('/api/digest/2026-11-09');
    expect(page.status).toBe(404);
    expect(json.status).toBe(404);
  });

  it('empty night: page says "nothing ran", JSON has no rows', async () => {
    const page = await app().request('/digest/2026-11-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');

    const json = await app().request('/api/digest/2026-11-02');
    expect(json.status).toBe(200);
    const body = (await json.json()) as DigestJson;
    expect(body.rows).toEqual([]);
  });

  it('bad line: still 200 on both routes, counted in badLines', async () => {
    const page = await app().request('/digest/2026-11-03');
    expect(page.status).toBe(200);

    const json = await app().request('/api/digest/2026-11-03');
    expect(json.status).toBe(200);
    const body = (await json.json()) as DigestJson;
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });

  it('page and JSON list the same jobs in the same order', async () => {
    const json = await app().request('/api/digest/2026-11-01');
    const body = (await json.json()) as DigestJson;
    const html = await (await app().request('/digest/2026-11-01')).text();

    const positions = body.rows.map((r) => html.indexOf(r.job));
    positions.forEach((p) => expect(p).toBeGreaterThan(-1));
    expect([...positions].sort((x, y) => x - y)).toEqual(positions);
  });
});
