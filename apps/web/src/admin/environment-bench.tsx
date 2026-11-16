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
import { vfxScripts, type VfxScript } from "../kart/vfx-rehearsal";
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
const opticalControls = [
  ["wind", "Speed lines", 1, 0.05],
  ["chromatic", "Boost colour split", 1, 0.05],
  ["lensDirt", "Lens dirt", 0.15, 0.01],
  ["bloom", "Bloom", 0.35, 0.01],
  ["ao", "Ambient occlusion", 0.25, 0.01],
  ["tiltShift", "Tilt shift", 1, 0.05],
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
  const [script, setScript] = useState<VfxScript | "static">("static"),
    [run, setRun] = useState(0);
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
  const updateOptic = (
    key: keyof KartLookPreset["optics"],
    patch: Record<string, number | boolean>,
  ) => {
    const next = kartLookPresetSchema.safeParse({
      ...preset,
      optics: { ...preset.optics, [key]: { ...preset.optics[key], ...patch } },
    });
    if (next.success) {
      setPreset(next.data);
      setError("");
    } else setError("That optical setting is outside the supported range.");
  };
  return (
    <section
      className="admin-kart-pane vfx-bench environment-bench"
      aria-label="Kart look bench"
    >
      <h2>Look bench</h2>
      <p>
        Rehearse light, grading and optional effects with real stand-ins or the solo
        driving engine. Settings stay in this page. Live controls chooses the room's
        named look; every screen keeps its own graphics and reduced-motion settings.
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
          <option value="race">Race effects</option>
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
      <label>
        Look rehearsal script
        <select
          value={script}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "static" || vfxScripts.some((id) => id === next)) {
              setScript(next as VfxScript | "static");
              setRun((value) => (value + 1) % 1_000_000);
            }
          }}
        >
          <option value="static">Static pose</option>
          {vfxScripts.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="secondary"
        onClick={() => {
          setRun((value) => (value + 1) % 1_000_000);
          setPaused(false);
        }}
      >
        Restart look script
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
              vfxRehearsal={script === "static" ? undefined : { script, run }}
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
      {stats && !solo ? (
        <p aria-label="Optical rendering cost">
          {stats.depthTextures} depth textures · at most {stats.textureSamples} texture
          reads per fragment. Active effects:{" "}
          {Object.entries(stats.optics)
            .filter(([, enabled]) => enabled)
            .map(([name]) => name)
            .join(", ") || "none"}
          .
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
        <legend>Optional optical effects</legend>
        {opticalControls.map(([key, label, max, step]) => (
          <fieldset key={key} className="look-controls">
            <legend>{label}</legend>
            <label>
              <input
                type="checkbox"
                checked={preset.optics[key].enabled}
                onChange={(event) =>
                  updateOptic(key, { enabled: event.target.checked })
                }
              />
              Enable {label.toLocaleLowerCase("en-GB")}
            </label>
            <label>
              {label} strength
              <input
                type="number"
                min={0}
                max={max}
                step={step}
                value={preset.optics[key].strength}
                onChange={(event) =>
                  updateOptic(key, { strength: event.target.valueAsNumber })
                }
              />
            </label>
          </fieldset>
        ))}
        {(
          [
            [
              "bloom",
              "threshold",
              "Bloom threshold",
              0.5,
              3,
              0.1,
              preset.optics.bloom.threshold,
            ],
            [
              "ao",
              "radius",
              "Ambient occlusion radius (pixels)",
              1,
              6,
              1,
              preset.optics.ao.radius,
            ],
            [
              "tiltShift",
              "focusDistance",
              "Tilt shift focus distance (metres)",
              4,
              120,
              1,
              preset.optics.tiltShift.focusDistance,
            ],
            [
              "tiltShift",
              "focusRange",
              "Tilt shift focus range (metres)",
              2,
              60,
              1,
              preset.optics.tiltShift.focusRange,
            ],
          ] as const
        ).map(([key, field, label, min, max, step, value]) => (
          <label key={field}>
            {label}
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(event) =>
                updateOptic(key, { [field]: event.target.valueAsNumber })
              }
            />
          </label>
        ))}
      </fieldset>
      <p>
        Low skips optional optical effects. Reduced motion removes speed lines, moving
        colour split and tilt shift. Speed effects use the shown driver's accepted speed
        and turbo state; scripts are isolated visual stand-ins.
      </p>
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
