import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';

vi.mock('../src/digest/reader.js', () => {
  const row = { owner: null, lastStatus: 'ok', lastError: null, firstAt: 'a', lastAt: 'b' };
  return {
    readNight: (_dir: string, night: string) =>
      night === '2026-10-28'
        ? { night, badLines: 1, rows: [{ ...row, job: 'a', runs: 10, retries: 4, fails: 1 }] }
        : { night, badLines: 0, rows: [{ ...row, job: 'a', runs: 3, retries: 0, fails: 0 }] },
  };
});

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('5 ok · 4 retry · 1 fail · 1 unreadable');
    expect(html).toContain('3 ok · 0 retry · 0 fail');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
