export function ConnectionDot({
  connection,
}: {
  connection: "connecting" | "open" | "closed" | "idle";
}) {
  const tone =
    connection === "open"
      ? "bg-accent"
      : connection === "connecting"
        ? "bg-highlight"
        : "bg-muted";
  const label =
    connection === "open"
      ? "Connected"
      : connection === "connecting"
        ? "Connecting"
        : connection === "closed"
          ? "Disconnected"
          : "Not connected";
  return (
    <span className="inline-flex items-center gap-2 font-bold">
      <span className={`inline-block size-3 rounded-full ${tone}`} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
