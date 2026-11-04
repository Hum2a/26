import { lazy, Suspense, useState } from "react";
import {
  kartLookPresetSchema,
  kartLookPresets,
  kartHueBands,
  kartLookTones,
  neutralKartLook,
  exportKartLookPreset,
  type KartLookPreset,
} from "@26/shared";
import { Button } from "../ui/primitives";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { readKartPreview } from "./sections-api";
import { useSection } from "./use-section";
import type { GraphicsTier } from "../kart/graphics";
import type { KartLookStats } from "../kart/look-renderer";
import { SoloPracticeFrame } from "../kart/SoloPracticeFrame";
import { practiceFaceLimit } from "../kart/practice-presentation";
const KartCanvas = lazy(() => import("../kart/KartCanvas"));
const read = () => readKartPreview("turn");
const numeric = [
  ["brightness", "Brightness", -0.3, 0.3, 0.01],
  ["contrast", "Contrast", 0.5, 1.5, 0.01],
  ["exposure", "Exposure (stops)", -2, 2, 0.1],
  ["gamma", "Gamma", 0.5, 2, 0.05],
  ["temperature", "Temperature", -1, 1, 0.05],
  ["tint", "Tint", -1, 1, 0.05],
  ["hue", "Hue rotation (degrees)", -180, 180, 1],
  ["saturation", "Saturation", 0, 2, 0.05],
  ["vibrance", "Vibrancy", -1, 1, 0.05],
  ["splitAmount", "Split tone amount", 0, 0.3, 0.01],
  ["splitBalance", "Split tone balance", 0.1, 0.9, 0.05],
] as const;
/** Isolated real render bench. Only implemented controls appear; no room is changed. */
export function EnvironmentBench() {
  const [preset, setPreset] = useState(() =>
    kartLookPresetSchema.parse(neutralKartLook),
  );
  const [before, setBefore] = useState(false),
    [paused, setPaused] = useState(true),
    [tier, setTier] = useState<GraphicsTier>("high");
  const [stats, setStats] = useState<KartLookStats>(),
    [json, setJson] = useState(""),
    [error, setError] = useState("");
  const [solo, setSolo] = useState(false),
    [soloLook, setSoloLook] = useState(true),
    [sampleFace, setSampleFace] = useState<Blob | null>(null);
  const sample = useSection(read),
    reduced = usePrefersReducedMotion();
  const update = (patch: Partial<KartLookPreset["grading"]>) => {
    const next = kartLookPresetSchema.safeParse({
      ...preset,
      grading: { ...preset.grading, ...patch },
    });
    if (next.success) {
      setPreset(next.data);
      setError("");
    } else setError("That setting is outside the supported range.");
  };
  const pick = (value: string) => {
    if (Object.hasOwn(kartLookPresets, value)) {
      setPreset(
        kartLookPresetSchema.parse(
          kartLookPresets[value as keyof typeof kartLookPresets],
        ),
      );
      setBefore(false);
      setError("");
    }
  };
  const updateEnvironment = (patch: Partial<KartLookPreset["environment"]>) => {
    const next = kartLookPresetSchema.safeParse({
      ...preset,
      environment: { ...preset.environment, ...patch },
    });
    if (next.success) {
      setPreset(next.data);
      setError("");
    } else setError("That environment setting is outside the supported range.");
  };
  return (
    <section
      className="admin-kart-pane vfx-bench environment-bench"
      aria-label="Kart look bench"
    >
      <h2>Look bench · work in progress</h2>
      <p>
        Grading preview with real stand-ins. Settings stay here; rooms and ordinary
        practice keep their current look. Optical effects and solo integration are still
        to follow.
      </p>
      <label>
        Look preset
        <select
          aria-label="Look preset"
          onChange={(event) => pick(event.target.value)}
          defaultValue="neutral"
        >
          <option value="neutral">Neutral</option>
          <option value="daylight">Daylight look</option>
          <option value="warm">Warm grade</option>
          <option value="crisp">Crisp grade</option>
          <option value="cool">Cool grade</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={before}
          onChange={(event) => setBefore(event.target.checked)}
        />
        Show original before grading
      </label>
      <label>
        <input
          type="checkbox"
          checked={preset.grading.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
        />
        Enable colour grading
      </label>
      <label>
        Look quality
        <select
          value={tier}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "low" || value === "balanced" || value === "high")
              setTier(value);
          }}
        >
          <option value="high">High</option>
          <option value="balanced">Balanced</option>
          <option value="low">Low</option>
        </select>
      </label>
      <Button variant="secondary" onClick={() => setPaused((value) => !value)}>
        {paused ? "Resume look sample" : "Pause look sample"}
      </Button>
      {sample.loading ? (
        <p>Loading stand-ins…</p>
      ) : sample.data && !solo ? (
        <div className="admin-vfx-viewport">
          <Suspense fallback={<p>Preparing look preview…</p>}>
            <KartCanvas
              race={sample.data.phone}
              mobile={false}
              followPlayerId={sample.data.phone.selfPlayerId ?? undefined}
              reducedMotion={reduced}
              paused={paused}
              graphicsTier={tier}
              lookPreset={before ? neutralKartLook : preset}
              onLookStats={setStats}
            />
          </Suspense>
        </div>
      ) : null}
      {stats && !solo ? (
        <p aria-label="Look rendering cost">
          {stats.active ? "Look active" : "Original image"} · {stats.passes} render
          passes · {stats.buffers} colour buffers · {stats.width} × {stats.height} ·{" "}
          {stats.buffers
            ? stats.hdr
              ? "HDR"
              : "LDR fallback"
            : "No postprocess target"}{" "}
          · {stats.samples} antialiasing samples · {stats.calls ?? 0} draw calls ·{" "}
          {stats.geometries ?? 0} geometries · {stats.textures ?? 0} textures. Local
          counts only; no frame-rate guarantee.
        </p>
      ) : null}
      <Button
        variant="secondary"
        onClick={() => {
          setPreset(kartLookPresetSchema.parse(neutralKartLook));
          setBefore(false);
          setError("");
        }}
      >
        Reset to neutral look
      </Button>
      <fieldset className="look-controls">
        <legend>Environment and light</legend>
        <label>
          <input
            type="checkbox"
            checked={preset.environment.enabled}
            onChange={(event) => updateEnvironment({ enabled: event.target.checked })}
          />
          Enable environment
        </label>
        <label>
          <input
            type="checkbox"
            checked={preset.environment.sky}
            onChange={(event) => updateEnvironment({ sky: event.target.checked })}
          />
          Gradient sky and sun
        </label>
        <label>
          <input
            type="checkbox"
            checked={preset.environment.shadows}
            onChange={(event) => updateEnvironment({ shadows: event.target.checked })}
          />
          Follow light shadows
        </label>
        {(
          [
            ["sunElevation", "Sun elevation (degrees)", 10, 80, 1],
            ["sunAzimuth", "Sun azimuth (degrees)", -180, 180, 1],
            ["intensity", "Sun intensity", 0.2, 3, 0.1],
            ["reflection", "Reflection strength", 0, 1, 0.05],
          ] as const
        ).map(([key, label, min, max, step]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={preset.environment[key]}
              onChange={(event) =>
                updateEnvironment({ [key]: event.target.valueAsNumber })
              }
            />
          </label>
        ))}
      </fieldset>
      <p>
        Sky and environment light use this theme's palette. Low omits reflection
        captures and shadows; High alone enables the bounded shadow map. Stand-in motion
        stays paused until resumed.
      </p>
      {stats?.environment ? (
        <p aria-label="Environment rendering cost">
          Sky {stats.environment.sky ? "on" : "off"} · local reflections{" "}
          {stats.environment.reflection ? "on" : "off"} · shadows{" "}
          {stats.environment.shadows ? "on" : "off"} · shadow map{" "}
          {stats.environment.shadowSize}px.
        </p>
      ) : null}
      {numeric.map(([key, label, min, max, step]) => (
        <label key={key}>
          {label}
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={preset.grading[key]}
            onChange={(event) => update({ [key]: event.target.valueAsNumber })}
          />
        </label>
      ))}
      <label>
        Filmic tone mapping
        <select
          value={preset.grading.toneMapping}
          onChange={(event) => {
            const next = kartLookPresetSchema.shape.grading.shape.toneMapping.safeParse(
              event.target.value,
            );
            if (next.success) update({ toneMapping: next.data });
          }}
        >
          {["source", "linear", "reinhard", "aces", "agx"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {(["shadows", "highlights"] as const).map((key) => (
        <label key={key}>
          Split tone {key}
          <select
            value={preset.grading[key]}
            onChange={(event) => {
              const value = event.target.value;
              if (kartLookTones.some((t) => t === value)) update({ [key]: value });
            }}
          >
            {kartLookTones.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      ))}
      <fieldset className="look-controls">
        <legend>RGB channel mixer</legend>
        {["red", "green", "blue"].flatMap((output, row) =>
          ["red", "green", "blue"].map((input, col) => {
            const index = row * 3 + col;
            return (
              <label key={index}>
                {output} from {input}
                <input
                  type="number"
                  min={-2}
                  max={2}
                  step={0.05}
                  value={preset.grading.mixer[index]}
                  onChange={(event) => {
                    const mixer = [...preset.grading.mixer];
                    mixer[index] = event.target.valueAsNumber;
                    update({ mixer });
                  }}
                />
              </label>
            );
          }),
        )}
      </fieldset>
      {kartHueBands.map((band) => (
        <fieldset key={band} className="look-controls">
          <legend>{band} HSL</legend>
          {(["hue", "saturation", "lightness"] as const).map((key) => (
            <label key={key}>
              {band} {key}
              <input
                type="number"
                min={key === "hue" ? -30 : key === "saturation" ? -1 : -0.25}
                max={key === "hue" ? 30 : key === "saturation" ? 1 : 0.25}
                step={key === "hue" ? 1 : 0.05}
                value={preset.grading.hsl[band][key]}
                onChange={(event) =>
                  update({
                    hsl: {
                      ...preset.grading.hsl,
                      [band]: {
                        ...preset.grading.hsl[band],
                        [key]: event.target.valueAsNumber,
                      },
                    },
                  })
                }
              />
            </label>
          ))}
        </fieldset>
      ))}
      <Button variant="secondary" onClick={() => setJson(exportKartLookPreset(preset))}>
        Export look preset
      </Button>
      <label>
        Look preset JSON
        <textarea
          value={json}
          onChange={(event) => setJson(event.target.value)}
          spellCheck={false}
        />
      </label>
      <Button
        variant="secondary"
        onClick={() => {
          try {
            const next = kartLookPresetSchema.parse(JSON.parse(json));
            setPreset(next);
            setBefore(false);
            setError("");
          } catch {
            setError("This is not a supported version 1 look preset.");
          }
        }}
      >
        Apply look preset
      </Button>
      {error ? <p role="status">{error}</p> : null}
      <label>
        Look solo sample face
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setSampleFace(null);
              return;
            }
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
              file.size > practiceFaceLimit
            ) {
              setError("Choose a PNG, JPEG or WebP photo up to 2 MB.");
              return;
            }
            setSampleFace(file);
            setError("");
          }}
        />
      </label>
      <Button variant="secondary" onClick={() => setSampleFace(null)}>
        Clear look sample face
      </Button>
      <Button variant="secondary" onClick={() => setSolo((value) => !value)}>
        {solo ? "Close solo look rehearsal" : "Open solo look rehearsal"}
      </Button>
      {solo ? (
        <>
          <label>
            <input
              type="checkbox"
              checked={soloLook}
              onChange={(event) => setSoloLook(event.target.checked)}
            />
            Use new look in solo rehearsal
          </label>
          <SoloPracticeFrame
            sampleFace={sampleFace}
            lookPreset={soloLook ? (before ? neutralKartLook : preset) : null}
          />
        </>
      ) : null}
    </section>
  );
}
