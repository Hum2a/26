import { renderSVG } from "uqr";

export function JoinMark({
  code,
  compact = false,
}: {
  code: string;
  compact?: boolean;
}) {
  const url = `${location.origin}/j/${code}`;
  const svg = renderSVG(url, {
    pixelSize: compact ? 3 : 4,
    whiteColor: "#fff6e8",
    blackColor: "#14110e",
    ecc: "M",
  });
  return (
    <div className="grid max-w-full gap-2">
      <div
        className={compact ? "w-28 bg-[#fff6e8] p-2" : "w-44 bg-[#fff6e8] p-3"}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="font-bold break-all">{url}</p>
    </div>
  );
}
