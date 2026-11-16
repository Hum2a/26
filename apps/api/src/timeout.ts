/** Outbound calls (email, database) must never hold a room alarm for long. */
export const outboundTimeoutMs = 10_000;

export class OutboundTimeout extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not answer within ${ms} ms.`);
    this.name = "OutboundTimeout";
  }
}

/** Rejects if `work` has not settled within `ms`. The work itself is not cancelled. */
export function withTimeout<T>(
  work: Promise<T>,
  label: string,
  ms = outboundTimeoutMs,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OutboundTimeout(label, ms)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
