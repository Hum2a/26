import { type KartTrialConfig } from "@26/shared";
import { kartRecordKey, type KartRecords } from "./kart-records";
import { trialTime } from "./trial-time";
import { Button } from "../ui/primitives";

export function KartTrialRecords({
  data,
  config,
  notice,
  onEnabled,
  onClear,
}: {
  data: KartRecords;
  config: KartTrialConfig | undefined;
  notice: string;
  onEnabled: (enabled: boolean) => void;
  onClear: () => void;
}) {
  const matching = config
    ? data.records.filter(
        (record) =>
          kartRecordKey(record) === kartRecordKey({ config, quality: record.quality }),
      )
    : [];
  return (
    <section aria-label="Local trial records" className="kart-trial-records">
      <label>
        <input
          type="checkbox"
          checked={data.enabled}
          onChange={(event) => onEnabled(event.target.checked)}
        />
        Save best times on this browser
      </label>
      <p>
        Optional · no account. Clean and assisted runs use separate records. Settings
        must match.
      </p>
      {notice ? <p role="status">{notice}</p> : null}
      {data.enabled ? (
        <>
          {(["clean", "assisted"] as const).map((quality) => {
            const records = matching.filter((r) => r.quality === quality);
            return (
              <p key={quality}>
                {quality === "clean" ? "Clean" : "Assisted"}:{" "}
                {records.length
                  ? `best total ${trialTime(Math.min(...records.map((r) => r.totalMs)))} · best lap ${trialTime(Math.min(...records.flatMap((r) => r.lapsMs)))}`
                  : "no matching record yet"}
              </p>
            );
          })}
          <p>{data.records.length} / 20 retained attempts</p>
          <Button type="button" variant="secondary" onClick={onClear}>
            Clear local records
          </Button>
        </>
      ) : null}
    </section>
  );
}
