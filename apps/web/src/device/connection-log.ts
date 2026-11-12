type Delta = {
  rttMs: number[];
  submissionRetries: number;
  uploadAttempts: number;
  uploadFailures: number;
  uploadDurationMs: number;
  scriptErrors: number;
  lastScriptError?: string;
};

const empty = (): Delta => ({
  rttMs: [],
  submissionRetries: 0,
  uploadAttempts: 0,
  uploadFailures: 0,
  uploadDurationMs: 0,
  scriptErrors: 0,
});

/** An uncaught error on this phone, reported to the host with the next summary. */
export function noteScriptError(message: string): void {
  pending.scriptErrors = Math.min(50, pending.scriptErrors + 1);
  pending.lastScriptError = message.slice(0, 160);
}

let pending = empty();

export function noteRtt(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0 || ms > 60_000) {
    return;
  }
  pending.rttMs.push(Math.round(ms));
  if (pending.rttMs.length > 8) {
    pending.rttMs.shift();
  }
}

export function noteSubmissionRetries(count: number): void {
  if (!Number.isFinite(count) || count <= 0) {
    return;
  }
  pending.submissionRetries += Math.min(5, Math.round(count));
}

export function noteUpload(input: { ok: boolean; durationMs: number }): void {
  pending.uploadAttempts += 1;
  if (!input.ok) {
    pending.uploadFailures += 1;
  }
  if (Number.isFinite(input.durationMs) && input.durationMs > 0) {
    pending.uploadDurationMs += Math.min(600_000, Math.round(input.durationMs));
  }
}

export function hasUrgentConnectionDelta(): boolean {
  return (
    pending.submissionRetries > 0 ||
    pending.uploadAttempts > 0 ||
    pending.uploadFailures > 0 ||
    pending.scriptErrors > 0
  );
}

export function takeConnectionDelta(): Delta | null {
  const next = pending;
  const quiet =
    next.rttMs.length === 0 &&
    next.submissionRetries === 0 &&
    next.uploadAttempts === 0 &&
    next.uploadFailures === 0 &&
    next.scriptErrors === 0;
  if (quiet) {
    return null;
  }
  pending = empty();
  return next;
}
