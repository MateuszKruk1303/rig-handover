// Plan morning-digest § 1. The contract the reader (#2) and the digest page (§ 2) share.

/** One line's `status` in `runs/<night>.jsonl`. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One row per job for a night. */
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  fails: number;
  lastStatus: RunStatus;
  lastError: string | null;
  /** The `at` strings as written in the log, offset kept (never converted to UTC). */
  firstAt: string;
  lastAt: string;
};

/** A night's digest. `rows` are sorted by job; `badLines` counts lines that didn't parse. */
export type Night = { night: string; rows: DigestRow[]; badLines: number };

/** Reads `<runsDir>/<night>.jsonl`. `null` = no file for that night. */
export type ReadNight = (runsDir: string, night: string) => Night | null;
