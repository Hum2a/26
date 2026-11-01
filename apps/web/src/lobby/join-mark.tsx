import { renderSVG } from "uqr";
import { CopyButton } from "../ui/copy-button";

export function JoinMark({
  code,
  compact = false,
  allowCopy = false,
}: {
  code: string;
  compact?: boolean;
  allowCopy?: boolean;
}) {
  const url = `${location.origin}/j/${code}`;
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
      {allowCopy ? (
        <>
          <label className="grid gap-2 min-w-0">
            Guest join link
            <input
              className="skin-field min-h-12 w-full min-w-0 border border-line bg-background px-3 text-foreground"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
            />
          </label>
          <CopyButton key={url} text={url} label="Copy guest link" />
        </>
      ) : (
        <p className="font-bold break-all">{url}</p>
      )}
    </div>
  );
}
