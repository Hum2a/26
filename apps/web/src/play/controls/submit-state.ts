export type SubmitState = "idle" | "sending" | "locked";

export function roundSubmitState(locked: boolean, pending: boolean): SubmitState {
  if (locked) {
    return "locked";
  }
  if (pending) {
    return "sending";
  }
  return "idle";
}
