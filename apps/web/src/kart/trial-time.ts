export function trialTime(ms: number) {
  const hundredths = Math.floor(ms / 10);
  return `${Math.floor(hundredths / 6000)}:${((hundredths % 6000) / 100).toFixed(2).padStart(5, "0")}`;
}
