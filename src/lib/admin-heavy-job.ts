/**
 * Process-local gate so heavy admin work cannot run on top of each other
 * on Hostinger's single Node process + SQLite.
 *
 * Storefront list reads stay on catalog-cache and are not part of this gate.
 */

export type HeavyJobKind =
  | "catalogue-import"
  | "catalogue-pdf"
  | "report-parse"
  | "report-ingest";

export class HeavyJobBusyError extends Error {
  readonly busyWith: HeavyJobKind;

  constructor(busyWith: HeavyJobKind) {
    super(busyMessage(busyWith));
    this.name = "HeavyJobBusyError";
    this.busyWith = busyWith;
  }
}

type ActiveJob = {
  kind: HeavyJobKind;
  token: symbol;
  startedAt: number;
};

const activeJobs = new Map<HeavyJobKind, ActiveJob>();

function busyMessage(kind: HeavyJobKind): string {
  switch (kind) {
    case "catalogue-import":
      return "A catalogue Excel import is already running. Wait for it to finish, then try again.";
    case "catalogue-pdf":
      return "A catalogue PDF is currently generating. Wait for it to finish, then try again.";
    case "report-parse":
      return "A large report Excel is being decoded. Wait a moment, then try again.";
    case "report-ingest":
      return "A large report Excel is still importing in safe batches. Wait for it to finish, then try again.";
    default:
      return "Another heavy admin job is running. Try again in a moment.";
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

export function getActiveHeavyJobs(): HeavyJobKind[] {
  return [...activeJobs.keys()];
}

export function tryAcquireHeavyJob(kind: HeavyJobKind):
  | { ok: true; token: symbol }
  | { ok: false; busyWith: HeavyJobKind } {
  for (const other of conflictsWith(kind)) {
    const active = activeJobs.get(other);
    if (active) return { ok: false, busyWith: other };
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
  if (!acquired.ok) throw new HeavyJobBusyError(acquired.busyWith);
  try {
    return await work();
  } finally {
    releaseHeavyJob(kind, acquired.token);
  }
}

export function heavyJobBusyResponse(error: HeavyJobBusyError): {
  status: number;
  body: { error: string; busyWith: HeavyJobKind; retryable: true };
} {
  return {
    status: 503,
    body: {
      error: error.message,
      busyWith: error.busyWith,
      retryable: true,
    },
  };
}
