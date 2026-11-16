import {
  kartSettingKeys,
  kartSettingOptions,
  resolveKartSettings,
  type KartSettingKey,
} from "@26/shared";
import { Button } from "../ui/primitives";
import { useAdminRoom } from "./room-provider";
import { KartHandlingControls } from "./kart-handling-controls";

const settingLabels: Record<KartSettingKey, { title: string; help: string }> = {
  prediction: {
    title: "Own-kart prediction",
    help: "Phones draw their own kart from their controls straight away and ease towards the room. Switch off if karts rubber-band on poor Wi-Fi; conservative corrects more gently.",
  },
  glide: {
    title: "Other karts glide",
    help: "Carries other karts forward between room updates so they move smoothly on phones and the stage.",
  },
  steering: {
    title: "Sideways steering default",
    help: "What a phone held sideways starts with. Guests can still switch on their phone.",
  },
  countdown: {
    title: "Race start countdown",
    help: "3, 2, 1 on phones and the stage in the last seconds before the race opens, then GO. Timing is unchanged; the room still opens the race.",
  },
  frameCap: {
    title: "Phone frame rate",
    help: "Highest frame rate on phones. Auto uses 60 unless a phone is on Low graphics.",
  },
};

const valueLabels: Record<string, string> = {
  off: "Off",
  on: "On",
  "on-conservative": "Conservative",
  "pad-strip": "Steering strip",
  slider: "Slider",
  "pad-absolute": "Fixed-centre pad",
  "30": "30 fps",
  "60": "60 fps",
  auto: "Auto",
  "prompt-tail": "3-2-1-GO",
  none: "None",
};

/** Host driving-feel switches. Shown in a kart lobby and during a kart round. */
export function KartDrivingFeel() {
  const { snapshot, execute, busy, connection } = useAdminRoom();
  const kartRound = snapshot.play?.question.kind === "kart";
  if (!kartRound && !(snapshot.kartLobby && snapshot.phase === "lobby")) return null;
  const current = resolveKartSettings(
    snapshot.play?.kart?.settings ?? snapshot.kartSettings,
  );
  const locked = busy || connection !== "open";
  return (
    <>
      <KartHandlingControls />
      <section className="admin-task-section" aria-label="Kart driving feel">
        <h2>Driving feel</h2>
        <p>
          These change only how phones and the stage draw and steer. Race rules, timing
          and points stay the same. A change applies to this race at once and to every
          later race.
        </p>
        {kartSettingKeys.map((key) => (
          <div key={key} className="admin-setting-row">
            <h3 id={`kart-setting-${key}`}>{settingLabels[key].title}</h3>
            <p>{settingLabels[key].help}</p>
            <div role="group" aria-labelledby={`kart-setting-${key}`}>
              {(kartSettingOptions[key] as readonly string[]).map((value) => (
                <Button
                  key={value}
                  variant={current[key] === value ? "primary" : "secondary"}
                  aria-pressed={current[key] === value}
                  disabled={locked}
                  onClick={() =>
                    current[key] === value
                      ? undefined
                      : void execute(
                          { action: "kart-setting", kartSetting: { key, value } },
                          `Set ${settingLabels[key].title.toLowerCase()}`,
                          "kart",
                        )
                  }
                >
                  {valueLabels[value] ?? value}
                </Button>
              ))}
            </div>
          </div>
        ))}
        {snapshot.kartSettingsHistory?.length ? (
          <ol aria-label="Driving feel history">
            {[...snapshot.kartSettingsHistory].reverse().map((entry, index) => (
              <li key={`${entry.atMs}:${index}`}>
                {settingLabels[entry.key].title}:{" "}
                {valueLabels[entry.value] ?? entry.value} at{" "}
                {new Date(entry.atMs).toLocaleTimeString("en-GB")}
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </>
  );
}
