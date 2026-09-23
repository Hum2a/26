type Delta = {
  rttMs: number[];
  submissionRetries: number;
  uploadAttempts: number;
  uploadFailures: number;
  uploadDurationMs: number;
};

const empty = (): Delta => ({
  rttMs: [],
  submissionRetries: 0,
  uploadAttempts: 0,
  uploadFailures: 0,
  uploadDurationMs: 0,
});

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

export function takeConnectionDelta(): Delta | null {
  const next = pending;
  const quiet =
    next.rttMs.length === 0 &&
    next.submissionRetries === 0 &&
    next.uploadAttempts === 0 &&
    next.uploadFailures === 0;
  if (quiet) {
    return null;
  }
  pending = empty();
  return next;
}
