import { renderSVG } from "uqr";

export function JoinMark({
  code,
  compact = false,
}: {
  code: string;
  compact?: boolean;
}) {
  const url = `${location.origin}/?room=${code}`;
  const svg = renderSVG(url, {
    pixelSize: compact ? 3 : 4,
    whiteColor: "var(--mark-quiet)",
    blackColor: "var(--mark)",
    ecc: "M",
  });
  return (
    <div className="grid max-w-full gap-2">
      <div
        className={compact ? "w-28 bg-mark-quiet p-2" : "w-44 bg-mark-quiet p-3"}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="font-bold break-all">{url}</p>
    </div>
  );
}
