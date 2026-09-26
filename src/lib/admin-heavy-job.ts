/**
 * Process-local gate so heavy admin work cannot run on top of each other
 * on Hostinger's single Node process.
 *
 * Rules:
 * - Only one catalogue import (and conflicting jobs) at a time.
 * - Lock always released in `finally`.
 * - Watchdog + TTL auto-clear stuck locks if a request was killed mid-import.
 */

export type HeavyJobKind =
  | "catalogue-import"
  | "catalogue-pdf"
  | "report-parse"
  | "report-ingest";

/** Import route maxDuration is 300s — allow a small buffer, then force-release. */
export const HEAVY_JOB_TTL_MS = 320_000;

export class HeavyJobBusyError extends Error {
  readonly busyWith: HeavyJobKind;
  readonly retryAfterSec: number;

  constructor(busyWith: HeavyJobKind, retryAfterSec = 15) {
    super(busyMessage(busyWith, retryAfterSec));
    this.name = "HeavyJobBusyError";
    this.busyWith = busyWith;
    this.retryAfterSec = retryAfterSec;
  }
}

type ActiveJob = {
  kind: HeavyJobKind;
  token: symbol;
  startedAt: number;
};

const activeJobs = new Map<HeavyJobKind, ActiveJob>();

function busyMessage(kind: HeavyJobKind, retryAfterSec?: number): string {
  const wait =
    retryAfterSec && retryAfterSec > 0
      ? ` Wait about ${retryAfterSec}s, then try again.`
      : " Wait for it to finish, then try again.";
  switch (kind) {
    case "catalogue-import":
      return `A catalogue Excel import is already running.${wait}`;
    case "catalogue-pdf":
      return `A catalogue PDF is currently generating.${wait}`;
    case "report-parse":
      return `A large report Excel is being decoded.${wait}`;
    case "report-ingest":
      return `A large report Excel is still importing in safe batches.${wait}`;
    default:
      return `Another heavy admin job is running.${wait}`;
  }
}

/** Jobs that must not overlap with the requested kind. */
function conflictsWith(kind: HeavyJobKind): HeavyJobKind[] {
  switch (kind) {
    case "catalogue-import":
      return ["catalogue-import", "catalogue-pdf", "report-parse", "report-ingest"];
    case "catalogue-pdf":
      return ["catalogue-import", "catalogue-pdf", "report-parse", "report-ingest"];
    case "report-parse":
      return ["catalogue-import", "catalogue-pdf", "report-parse"];
    case "report-ingest":
      return ["catalogue-import", "catalogue-pdf", "report-parse", "report-ingest"];
    default:
      return [kind];
  }
}

function remainingSec(job: ActiveJob): number {
  const elapsed = Date.now() - job.startedAt;
  return Math.max(5, Math.ceil((HEAVY_JOB_TTL_MS - elapsed) / 1000));
}

/** Drop jobs that outlived TTL (killed request / hung work). */
export function evictStaleHeavyJobs(now = Date.now()): HeavyJobKind[] {
  const cleared: HeavyJobKind[] = [];
  for (const [kind, job] of activeJobs) {
    if (now - job.startedAt > HEAVY_JOB_TTL_MS) {
      activeJobs.delete(kind);
      cleared.push(kind);
      console.warn(
        `[heavy-job] Evicted stale ${kind} (held ${Math.round((now - job.startedAt) / 1000)}s)`
      );
    }
  }
  return cleared;
}

/** Admin escape hatch — clear stuck import locks without waiting for TTL. */
export function forceClearHeavyJobs(kinds?: HeavyJobKind[]): HeavyJobKind[] {
  const targets = kinds?.length ? kinds : ([...activeJobs.keys()] as HeavyJobKind[]);
  const cleared: HeavyJobKind[] = [];
  for (const kind of targets) {
    if (activeJobs.delete(kind)) cleared.push(kind);
  }
  if (cleared.length) {
    console.warn(`[heavy-job] Force-cleared: ${cleared.join(", ")}`);
  }
  return cleared;
}

export function getActiveHeavyJobs(): Array<{
  kind: HeavyJobKind;
  startedAt: number;
  ageSec: number;
  stale: boolean;
}> {
  evictStaleHeavyJobs();
  const now = Date.now();
  return [...activeJobs.values()].map((job) => ({
    kind: job.kind,
    startedAt: job.startedAt,
    ageSec: Math.round((now - job.startedAt) / 1000),
    stale: now - job.startedAt > HEAVY_JOB_TTL_MS,
  }));
}

export function tryAcquireHeavyJob(kind: HeavyJobKind):
  | { ok: true; token: symbol }
  | { ok: false; busyWith: HeavyJobKind; retryAfterSec: number } {
  evictStaleHeavyJobs();

  for (const other of conflictsWith(kind)) {
    const active = activeJobs.get(other);
    if (active) {
      return {
        ok: false,
        busyWith: other,
        retryAfterSec: remainingSec(active),
      };
    }
  }
  const token = Symbol(kind);
  activeJobs.set(kind, { kind, token, startedAt: Date.now() });
  return { ok: true, token };
}

export function releaseHeavyJob(kind: HeavyJobKind, token: symbol): void {
  const active = activeJobs.get(kind);
  if (active?.token === token) activeJobs.delete(kind);
}

export async function withHeavyJob<T>(
  kind: HeavyJobKind,
  work: () => Promise<T>
): Promise<T> {
  const acquired = tryAcquireHeavyJob(kind);
  if (!acquired.ok) {
    throw new HeavyJobBusyError(acquired.busyWith, acquired.retryAfterSec);
  }

  // If the platform kills the request without running finally, free the slot.
  const watchdog = setTimeout(() => {
    releaseHeavyJob(kind, acquired.token);
    console.warn(`[heavy-job] Watchdog force-released ${kind} after TTL`);
  }, HEAVY_JOB_TTL_MS);

  try {
    return await work();
  } finally {
    clearTimeout(watchdog);
    releaseHeavyJob(kind, acquired.token);
  }
}

export function heavyJobBusyResponse(error: HeavyJobBusyError): {
  status: number;
  body: {
    error: string;
    busyWith: HeavyJobKind;
    retryable: true;
    retryAfterSec: number;
  };
} {
  return {
    status: 503,
    body: {
      error: error.message,
      busyWith: error.busyWith,
      retryable: true,
      retryAfterSec: error.retryAfterSec,
    },
  };
}
