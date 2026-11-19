/** The pairing code alphabet: no I, O, 0 or 1. */
export const pairingCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

/** Uppercases and drops the spaces and hyphen the admin screen shows. */
export function cleanPairingCode(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}
