import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  defaultRehearsalConfig,
  rehearsalConfigSchema,
  type RehearsalConfig,
} from "@26/shared";
import { Button, TextField } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { createLobby } from "../live/room-api";
import { builtInProfiles, deleteProfile, readProfiles, saveProfile } from "./profiles";

export function RehearsalFields({
  value,
  onChange,
  disabled = false,
  frozenPack = false,
}: {
  value: RehearsalConfig;
  onChange: (next: RehearsalConfig) => void;
  disabled?: boolean;
  frozenPack?: boolean;
}) {
  function number(
    label: string,
    field: "botCount" | "delayMs" | "participation" | "beatMs" | "collectMs",
    min: number,
    max: number,
  ) {
    return (
      <TextField
        key={field}
        label={label}
        hint={`${min} to ${max}`}
        type="number"
        min={min}
        max={max}
        step={1}
        value={Number.isNaN(value[field]) ? "" : value[field]}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, [field]: e.target.valueAsNumber })}
      />
    );
  }
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend>Rehearsal settings</legend>
      <label className="block">
        Question pack{" "}
        <select
          disabled={frozenPack}
          value={value.pack}
          onChange={(e) =>
            onChange({ ...value, pack: e.target.value as RehearsalConfig["pack"] })
          }
        >
          <option value="demo">Illustrative demo</option>
          <option value="birthday">Saved birthday running order</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {number("Rehearsal bot count", "botCount", 0, 100)}
        {number("Answer delay (ms)", "delayMs", 0, 8000)}
        {number("Participation (%)", "participation", 0, 100)}
        {number("Presentation beat (ms)", "beatMs", 250, 15000)}
        {number("Answering window (ms)", "collectMs", 3000, 120000)}
      </div>
      {(
        [
          ["autoAnswers", "Automatic answers"],
          ["kart", "Kart traffic"],
          ["pauseAtReveal", "Pause at each reveal"],
          ["stopOnFailure", "Stop on failed checks"],
        ] as const
      ).map(([field, label]) => (
        <label key={field} className="block">
          <input
            type="checkbox"
            checked={value[field]}
            onChange={(e) => onChange({ ...value, [field]: e.target.checked })}
          />{" "}
          {label}
        </label>
      ))}
    </fieldset>
  );
}

export function RehearsalSetup() {
  const [config, setConfig] = useState(defaultRehearsalConfig),
    [profiles, setProfiles] = useState(readProfiles);
  const [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<{ id: string; config: RehearsalConfig } | undefined>(
    undefined,
  );
  const [uncertain, setUncertain] = useState(false);
  const navigate = useNavigate();
  async function create() {
    const parsed = rehearsalConfigSchema.safeParse(config);
    if (!parsed.success) {
      setError("Check the settings and their limits.");
      return;
    }
    pending.current ??= { id: crypto.randomUUID(), config: parsed.data };
    // Reserve the stage during the click so browsers allow the new tab.
    const stage = window.open("about:blank", "26-rehearsal-stage");
    setUncertain(true);
    setBusy(true);
    setError("");
    try {
      const result = await createLobby(pending.current.id, pending.current.config);
      if ("error" in result) {
        setError(result.error);
        stage?.close();
        return;
      }
      pending.current = undefined;
      setUncertain(false);
      if (stage) {
        stage.opener = null;
        stage.location.href = `/host?code=${result.joinCode}&rehearsal=1`;
      }
      try {
        localStorage.setItem("26-admin-room-change", crypto.randomUUID());
      } catch {
        /* Optional hint. */
      }
      await navigate(`/admin/rooms/${result.gameId}/developer?autostart=1`);
    } catch {
      setError(
        "Creation was not confirmed. Retry to reuse the same request and setup.",
      );
      stage?.close();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="skin-panel min-w-0 p-4 space-y-3" aria-label="Fresh rehearsal">
      <h2>Fresh rehearsal</h2>
      <p>
        Create an isolated room, connect bots and run the show. The stage opens in
        another tab. Keep Developer tools open for bot traffic.
      </p>
      <div className="admin-actions">
        {[...builtInProfiles, ...profiles].map((profile, i) => (
          <Button
            key={`${i}-${profile.name}`}
            variant="secondary"
            disabled={busy || uncertain}
            onClick={() => setConfig(profile.config)}
          >
            Load {profile.name}
          </Button>
        ))}
      </div>
      <RehearsalFields
        value={config}
        onChange={setConfig}
        disabled={busy || uncertain}
      />
      <TextField
        label="Setup name"
        hint="Saved in this browser, up to ten setups."
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="admin-actions">
        <Button
          variant="secondary"
          disabled={!name.trim() || !rehearsalConfigSchema.safeParse(config).success}
          onClick={() => {
            try {
              setProfiles(saveProfile(name, config));
              setError("");
            } catch {
              setError("This browser could not save the setup.");
            }
          }}
        >
          Save setup
        </Button>
        {profiles.map((p) => (
          <Button
            key={p.name}
            variant="secondary"
            onClick={() => {
              try {
                setProfiles(deleteProfile(p.name));
              } catch {
                setError("This browser could not remove the setup.");
              }
            }}
          >
            Delete {p.name}
          </Button>
        ))}
        <Button
          disabled={busy || !rehearsalConfigSchema.safeParse(config).success}
          onClick={() => void create()}
        >
          {busy
            ? "Creating rehearsal…"
            : uncertain
              ? "Retry fresh rehearsal"
              : "Start fresh rehearsal"}
        </Button>
      </div>
      {uncertain && !busy ? (
        <Button
          variant="secondary"
          onClick={() => {
            pending.current = undefined;
            setUncertain(false);
            setError("");
          }}
        >
          Choose another setup
        </Button>
      ) : null}
      <EntryNotice message={error} />
    </section>
  );
}
