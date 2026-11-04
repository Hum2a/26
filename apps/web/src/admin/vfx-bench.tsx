import { lazy, Suspense, useCallback, useState } from "react";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import {
  defaultKartVfxPreset,
  kartVfxPresetSchema,
  exportKartVfxPreset,
  kartRehearsalBeatSchema,
  type KartVfxPreset,
  kartVfxBudgets,
  kartVfxKinds,
} from "@26/shared";
import { Button } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { readKartPreview } from "./sections-api";
import { useSection } from "./use-section";
import { SoloPracticeFrame } from "../kart/SoloPracticeFrame";
import {
  readPracticePresentation,
  practicePresentationKind,
} from "../kart/practice-presentation";
import type { GraphicsTier } from "../kart/graphics";
import { vfxScripts, type VfxScript } from "../kart/vfx-rehearsal";
import type { VfxCounts } from "../kart/vfx-budget";
const KartCanvas = lazy(() => import("../kart/KartCanvas"));

/** Explicit isolated rendering rehearsal. Settings stay in this page, never a live room. */
export function VfxBench() {
  const [preset, setPreset] = useState<KartVfxPreset>(() =>
    kartVfxPresetSchema.parse(defaultKartVfxPreset),
  );
  const [beat, setBeat] = useState<"grid" | "turn" | "boost" | "finish">("turn");
  const [paused, setPaused] = useState(false);
  const [tier, setTier] = useState<GraphicsTier>("high");
  const [stats, setStats] = useState<VfxCounts>({ particles: 0, skids: 0 });
  const [script, setScript] = useState<VfxScript | "static">("static");
  const [run, setRun] = useState(0);
  const [exported, setExported] = useState("");
  const [error, setError] = useState("");
  const [solo, setSolo] = useState(false);
  const [soloEffects, setSoloEffects] = useState(true);
  const [sampleFace, setSampleFace] = useState<Blob | null>(null);
  const reduced = usePrefersReducedMotion();
  const read = useCallback(() => readKartPreview(beat), [beat]);
  const sample = useSection(read);
  const update = (patch: Partial<KartVfxPreset>) => {
    const next = kartVfxPresetSchema.safeParse({ ...preset, ...patch });
    if (next.success) {
      setPreset(next.data);
      setError("");
    } else setError("That setting is outside the supported range.");
  };
  return (
    <section className="admin-kart-pane vfx-bench" aria-label="Kart effects bench">
      <h2>Effects bench</h2>
      <label>
        Effects script
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
        Restart effects script
      </Button>
      <p>
        Scripts animate labelled stand-ins for a finite six-second visual rehearsal
        (finish at three seconds). They do not drive a room, test collisions or award
        points. Pause freezes the script. Solo below uses real driving controls.
      </p>
      <label>
        Effects quality
        <select
          value={tier}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "high" || value === "balanced" || value === "low")
              setTier(value);
          }}
        >
          <option value="high">High</option>
          <option value="balanced">Balanced</option>
          <option value="low">Low</option>
        </select>
      </label>
      <p>
        Isolated public stand-in poses with the real circuit and new effects renderer.
        Settings stay in this page. This bench does not change live races or ordinary
        practice. Solo rehearsal below is opt-in.
      </p>
      <label>
        Sample pose{" "}
        <select
          value={beat}
          onChange={(event) => {
            const next = kartRehearsalBeatSchema.safeParse(event.target.value);
            if (next.success) setBeat(next.data);
          }}
        >
          {kartRehearsalBeatSchema.options.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={preset.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
        />
        Enable sample effects
      </label>
      <Button variant="secondary" onClick={() => setPaused((value) => !value)}>
        {paused ? "Resume effects sample" : "Pause effects sample"}
      </Button>
      <fieldset>
        <legend>Effects</legend>
        {(Object.keys(preset.effects) as (keyof KartVfxPreset["effects"])[]).map(
          (kind) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={preset.effects[kind]}
                onChange={(event) =>
                  update({
                    effects: { ...preset.effects, [kind]: event.target.checked },
                  })
                }
              />
              {kind}
            </label>
          ),
        )}
      </fieldset>
      {(
        [
          ["rate", "Emission rate", 1, 60, 1],
          ["burstCount", "Burst count", 1, 32, 1],
          ["lifetimeMs", "Particle lifetime (ms)", 100, 3000, 100],
          ["size", "Particle size", 0.1, 2, 0.1],
          ["gravity", "Gravity", -4, 4, 0.1],
          ["trailLength", "Trail length", 0, 12, 0.5],
          ["skidLifetimeMs", "Tyre mark lifetime (ms)", 100, 8000, 100],
        ] as const
      ).map(([key, label, min, max, step]) => (
        <label key={key}>
          {label}
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={preset[key]}
            onChange={(event) => update({ [key]: event.target.valueAsNumber })}
          />
        </label>
      ))}
      <label>
        Emitter mode
        <select
          value={preset.mode}
          onChange={(event) =>
            update({ mode: event.target.value as KartVfxPreset["mode"] })
          }
        >
          <option value="time">Continuous</option>
          <option value="burst">State-change bursts</option>
        </select>
      </label>
      <label>
        Particle shape
        <select
          value={preset.renderMode}
          onChange={(event) =>
            update({ renderMode: event.target.value as KartVfxPreset["renderMode"] })
          }
        >
          <option value="mesh">Mesh</option>
          <option value="billboard">Billboard</option>
          <option value="stretch">Stretched</option>
        </select>
      </label>
      <label>
        Fade
        <select
          value={preset.fade}
          onChange={(event) =>
            update({ fade: event.target.value as KartVfxPreset["fade"] })
          }
        >
          <option value="linear">Linear</option>
          <option value="ease-out">Eased</option>
        </select>
      </label>
      <Button
        variant="secondary"
        onClick={() => {
          setPreset(kartVfxPresetSchema.parse(defaultKartVfxPreset));
          setPaused(false);
          setError("");
        }}
      >
        Reset effects preset
      </Button>
      <Button
        variant="secondary"
        onClick={() => setExported(exportKartVfxPreset(preset))}
      >
        Export effects preset
      </Button>
      <label>
        VFX preset export
        <textarea
          value={exported}
          onChange={(event) => setExported(event.target.value)}
          rows={6}
        />
      </label>
      <Button
        variant="secondary"
        onClick={() => {
          try {
            setPreset(kartVfxPresetSchema.parse(JSON.parse(exported)));
            setError("");
          } catch {
            setError(
              "This is not a supported version 1 effects preset. The current settings are unchanged.",
            );
          }
        }}
      >
        Apply exported preset
      </Button>
      <EntryNotice message={error || sample.error} />
      <p role="status">
        {stats.particles} particle instances · {stats.skids} tyre segments · {tier}
        budget: {kartVfxBudgets[tier].particles} / {kartVfxBudgets[tier].skids}. These
        are scene-buffer counts, not frame-rate or GPU-readiness measurements.
      </p>
      {stats.resources ? (
        <p aria-label="Local renderer resources">
          Last rendered frame: {stats.resources.calls} draw calls ·{" "}
          {stats.resources.triangles} triangles · {stats.resources.geometries}{" "}
          geometries · {stats.resources.textures} textures. Counts stay in this
          rehearsal. Low lowers active effects, not the fixed buffer allocation.
        </p>
      ) : null}
      {reduced ? (
        <p>
          Reduced motion is on: moving decoration is suppressed. Race feedback remains
          in the existing HUD.
        </p>
      ) : null}
      <dl aria-label="Effect counts" className="vfx-counts">
        {kartVfxKinds.map((kind) => (
          <div key={kind}>
            <dt>{kind}</dt>
            <dd>{stats.byKind?.[kind] ?? 0}</dd>
          </div>
        ))}
      </dl>
      {sample.loading ? (
        <p>Loading stand-in poses…</p>
      ) : sample.data ? (
        <>
          <p>{sample.data.label}</p>
          <div className="admin-vfx-viewport">
            <Suspense fallback={<p>Loading real effects viewport…</p>}>
              <KartCanvas
                race={sample.data.phone}
                mobile={false}
                followPlayerId={sample.data.phone.selfPlayerId ?? undefined}
                reducedMotion={Boolean(reduced)}
                graphicsTier={tier}
                vfxPreset={preset}
                paused={paused}
                vfxRehearsal={script === "static" ? undefined : { script, run }}
                onVfxStats={setStats}
              />
            </Suspense>
          </div>
        </>
      ) : null}
      <p>
        Solo rehearsal runs the real practice engine. Changing focus pauses practice;
        resume inside the frame after tuning. A sample photo stays in this page and
        frame.
      </p>
      <label>
        Solo sample face
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            const result = readPracticePresentation({
              kind: practicePresentationKind,
              style: "racer",
              face: file,
            });
            if (result) {
              setSampleFace(result.face ?? null);
              setError("");
            } else setError("Choose a PNG, JPEG or WebP up to 2 MB.");
          }}
        />
      </label>
      <Button
        variant="secondary"
        disabled={!sampleFace}
        onClick={() => setSampleFace(null)}
      >
        Clear solo sample face
      </Button>
      <Button
        variant="secondary"
        aria-expanded={solo}
        onClick={() => setSolo((value) => !value)}
      >
        {solo ? "Close solo effects rehearsal" : "Open solo effects rehearsal"}
      </Button>
      {solo ? (
        <>
          <label>
            <input
              type="checkbox"
              checked={soloEffects}
              onChange={(event) => setSoloEffects(event.target.checked)}
            />
            Use new effects in solo rehearsal
          </label>
          <SoloPracticeFrame
            sampleFace={sampleFace}
            effectsPreset={soloEffects ? preset : null}
          />
        </>
      ) : null}
      <p>
        Visual scripts rehearse presentation only. Use Live controls to switch a room's
        effects on or off and review its history. Physical-device frame rates, gameplay
        collisions and scoring need their separate checks.
      </p>
    </section>
  );
}
