import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GraphicsControls } from "../../web/src/kart/graphics-controls";
import {
  GraphicsTierContext,
  useKartGraphics,
} from "../../web/src/kart/graphics-preferences";
import {
  createFrameProbe,
  graphicsProfiles,
  safeGraphicsProfile,
  type FrameHealth,
} from "../../web/src/kart/graphics";
import { Bvh, useProgress } from "@react-three/drei";
import { TouchController } from "../../web/src/kart/TouchController";
import { useKartContactFeedback } from "../../web/src/kart/useKartContactFeedback";
import {
  themeDocumentHead,
  themes,
  DEFAULT_THEME_ID,
} from "../../web/src/theme/themes";
import { TrackItems } from "./TrackItems";
import { Course } from "./Course";
import { PracticePresentation } from "./PracticePresentation";
import { DriftGauge } from "../../web/src/kart/DriftGauge";
import { KartTimeTrial } from "../../web/src/kart/KartTimeTrial";
import { KartTrialRecords } from "../../web/src/kart/KartTrialRecords";
import {
  browserKartRecordStorage,
  writeKartRecords,
} from "../../web/src/kart/kart-records";
import {
  defaultCourseSettings,
  clearCourseSettings,
  soloCourse,
  type CourseSettings,
  kartHandlingSchema,
  kartHandlingNames,
} from "@26/shared";
import { PowerUpControl } from "../../web/src/kart/PowerUpControl";
import { PlayerController } from "./upstream/PlayerController.jsx";
import { Track } from "./upstream/models/Mario-circuit-test.jsx";
import { useGameStore } from "./upstream/store.js";
import { drive, pause, resume, reset, recover, useItem } from "./session";
import "./solo.css";

const themeStyle = document.createElement("style");
themeStyle.textContent = themeDocumentHead().style;
document.head.append(themeStyle);

function Ready() {
  const camera = useThree((state) => state.camera);
  const lookReady = useGameStore(
    (state) => !state.soloLookPreset || state.soloLookReady,
  );
  useEffect(() => {
    camera.position.set(0, 2, 5);
    camera.lookAt(0, -2, -9);
    if (lookReady)
      useGameStore.setState({
        soloStarted: true,
        soloPaused: useGameStore.getState().soloPaused || document.hidden,
      });
  }, [camera, lookReady]);
  return null;
}

function Circuit() {
  const revision = useGameStore((state) => state.soloReset);
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[30, 80, 20]} intensity={2} />
      <Bvh firstHitOnly>
        <Track name="solo-track" />
      </Bvh>
      <PlayerController key={revision} />
      <TrackItems />
      <Course />
      <Ready key={`camera-${revision}`} />
    </>
  );
}

function Telemetry() {
  const speed = useGameStore((state) => Math.round(Math.abs(state.speed ?? 0) * 3.6));
  const distance = useGameStore((state) =>
    Math.round(Math.hypot(state.playerPosition?.x ?? 0, state.playerPosition?.z ?? 0)),
  );
  const boost = useGameStore((state) => state.isBoosting);
  const drift = useGameStore((state) => state.driftLevel?.level ?? 0);
  const sliding = useGameStore((state) => state.driftLevel?.charging ?? false);
  const surface = useGameStore((state) => state.soloSurface);
  const contact = useGameStore((state) => state.soloContact);
  const stunned = useGameStore((state) => state.soloStunMs > 0);
  const chargeMs = useGameStore((state) => state.soloChargeMs);
  const boostLevel = useGameStore((state) => state.soloBoostLevel);
  const height = useGameStore((state) => Math.round(state.soloHeight * 10) / 10);
  const notice = useGameStore((state) => state.soloTrackNotice);
  return (
    <div className="solo-telemetry">
      <output aria-label="Speed">
        {speed}
        <small>km/h</small>
      </output>
      <output className="solo-distance" aria-label="Distance from start">
        {distance} m from grid
      </output>
      <span>
        {boost
          ? "Boost!"
          : surface === "unsupported"
            ? "Off track — use Back to track"
            : stunned
              ? "Barrier impact — controls resume in a moment"
              : contact
                ? "Barrier contact — steer away"
                : surface === "dirt"
                  ? "Off-road — reduced grip and speed"
                  : drift
                    ? "Release drift to boost"
                    : sliding
                      ? "Drifting — hold to charge"
                      : "Push up to drive"}
      </span>
      {boost && surface !== "road" ? (
        <span>
          {surface === "unsupported"
            ? "Off track — use Back to track"
            : "Off-road — reduced grip and speed"}
        </span>
      ) : null}
      <DriftGauge chargeMs={chargeMs} boostLevel={boost ? boostLevel || 1 : 0} />
      <output aria-label="Track feedback">
        {height > 0
          ? `Gliding · ${height} m · A: glide · B: descend`
          : notice === "boost"
            ? "Floor boost"
            : notice === "hazard"
              ? "Sweeper hit — keep driving"
              : notice === "landed"
                ? "Landed"
                : "Look for boost chevrons and ramps"}
      </output>
    </div>
  );
}

function Loading() {
  const progress = useProgress((state) => Math.round(state.progress));
  return (
    <div className="solo-message" role="status">
      <h2>Loading the circuit</h2>
      <p>Preparing your kart · {progress}%</p>
    </div>
  );
}

function Recovery() {
  return (
    <div className="solo-message" role="alert">
      <h2>The circuit could not load</h2>
      <p>Check your connection and that WebGL is enabled in your browser.</p>
      <button onClick={() => location.reload()}>Retry circuit</button>
      <a href="/" target="_top">
        Back to 26
      </a>
    </div>
  );
}
class GameBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    pause();
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Recovery /> : this.props.children;
  }
}

function SoloPowerInventory() {
  const enabled = useGameStore((s) => s.soloItemsEnabled);
  const item = useGameStore((s) => s.soloPowers.item),
    shield = useGameStore((s) => s.soloPowers.shieldUntil > s.soloElapsed),
    slowed = useGameStore((s) => s.soloPowers.slowedUntil > s.soloElapsed);
  const disabled = useGameStore(
      (s) => s.soloPaused || s.soloRecover !== s.soloRecovered,
    ),
    notice = useGameStore((s) => s.soloPowerMessage);
  if (!enabled) return null;
  return (
    <aside className="solo-power">
      <PowerUpControl
        item={item}
        disabled={disabled}
        notice={notice}
        effect={
          shield
            ? "Shield active — blocks one slick"
            : slowed
              ? "Oil hit — slowing down"
              : ""
        }
        onUse={useItem}
      />
    </aside>
  );
}

/** Keep accepted contact updates out of the Canvas owner and graphics setup. */
function SoloDrivingControls() {
  const paused = useGameStore((state) => state.soloPaused);
  const recoveryPending = useGameStore(
    (state) => state.soloRecover !== state.soloRecovered,
  );
  const recoveryReady = useGameStore((state) => state.soloRecoveryReady);
  const heldPower = useGameStore((state) => state.soloPowers.item);
  const recoveryMessage = useGameStore((state) => state.soloRecoveryMessage);
  const contact = useGameStore((state) => state.soloContact);
  const elapsedMs = useGameStore((state) => state.soloElapsed);
  const itemsEnabled = useGameStore((state) => state.soloItemsEnabled);
  const revision = useGameStore((state) => state.soloReset);
  const feedback = useKartContactFeedback({
    raceId: `solo-${revision}`,
    elapsedMs,
    active: !paused && !recoveryPending,
    contact,
  });
  return (
    <>
      {feedback.overlay}
      <aside className="solo-controls" aria-label="Driving controls">
        <TouchController
          key={revision}
          extraSettings={feedback.settings}
          disabled={paused || recoveryPending}
          onChange={drive}
          onUseItem={itemsEnabled ? useItem : undefined}
          onRecover={recover}
          itemDisabled={!heldPower}
          recoveryDisabled={!recoveryReady}
        />
        <p role="status">
          {recoveryMessage ||
            "Arrows/WASD: drive · Space: drift · E: item · R: back to track"}
        </p>
      </aside>
    </>
  );
}

function SoloGame() {
  const [graphicsPlayers, setGraphicsPlayers] = useState(1);
  const graphics = useKartGraphics(graphicsPlayers);
  const [maxTextureSize, setMaxTextureSize] = useState<number | null>(null);
  // Fiber retains its existing supersampling policy; capability limits can still
  // reduce both scene detail and pixel ratio without changing the user's choice.
  const profile =
    maxTextureSize === null
      ? { tier: graphics.tier, ...graphicsProfiles[graphics.tier] }
      : safeGraphicsProfile(graphics.tier, {
          webgl: true,
          maxTextureSize,
          pixelRatioLimit: graphicsProfiles[graphics.tier].pixelRatio,
        });
  const [mounted, setMounted] = useState(false);
  const [lost, setLost] = useState(false);
  const paused = useGameStore((state) => state.soloPaused);
  const trialFinished = useGameStore((state) => state.soloTrial?.finished ?? false);
  const ready = useGameStore((state) => state.soloStarted);
  const recoveryPending = useGameStore(
    (state) => state.soloRecover !== state.soloRecovered,
  );
  const recoveryReady = useGameStore((state) => state.soloRecoveryReady);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const start = () => {
    resume();
    setMounted(true);
    // Keyboard driving should work immediately after pressing a menu button.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const continueDriving = () => {
    resume();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  return (
    <GraphicsTierContext value={profile?.tier ?? "low"}>
      <main className="solo-game" data-ready={ready} aria-label="Solo kart practice">
        <div className="solo-world">
          {mounted ? (
            <GameBoundary>
              {lost ? (
                <Recovery />
              ) : (
                <Canvas
                  dpr={profile?.pixelRatio ?? graphicsProfiles.low.pixelRatio}
                  shadows={false}
                  frameloop={paused && ready ? "demand" : "always"}
                  camera={{ position: [0, 2, 5], far: 2500, fov: 65 }}
                  gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
                  fallback={<Recovery />}
                  onCreated={({ camera, gl }) => {
                    const limit = gl.capabilities.maxTextureSize;
                    setMaxTextureSize(limit);
                    if (
                      !safeGraphicsProfile(graphics.tier, {
                        webgl: true,
                        maxTextureSize: limit,
                        pixelRatioLimit: graphicsProfiles[graphics.tier].pixelRatio,
                      })
                    ) {
                      pause();
                      setLost(true);
                    }
                    camera.layers.enable(1);
                    gl.domElement.setAttribute(
                      "aria-label",
                      "Mario Kart 3.js driving view",
                    );
                    gl.domElement.addEventListener(
                      "webglcontextlost",
                      (event) => {
                        event.preventDefault();
                        pause();
                        setLost(true);
                      },
                      { once: true },
                    );
                  }}
                >
                  <color
                    attach="background"
                    args={[themes[DEFAULT_THEME_ID].colors.background]}
                  />
                  <Suspense fallback={null}>
                    <GraphicsMonitor onHealth={graphics.onHealth} />
                    <Circuit />
                  </Suspense>
                </Canvas>
              )}
              {!ready && !lost ? <Loading /> : null}
            </GameBoundary>
          ) : (
            <section className="solo-message solo-intro">
              <p className="solo-eyebrow">Mario Kart 3.js · solo practice</p>
              <h1>Your own starting grid.</h1>
              <p>
                Explore the upstream circuit in 3D. No room, time limit or party points.
              </p>
              <button className="solo-start" onClick={start}>
                Start driving
              </button>
              <a
                href="https://github.com/Nathan-Richard-21/mario-kart-js"
                target="_blank"
                rel="noreferrer"
              >
                Based on Mario Kart 3.js
              </a>
              <p>
                Arrow keys to drive · Space to hop and drift.
                <br />
                On a phone held sideways, one thumb steers and pushes up to accelerate;
                the other holds R to drift.
              </p>
            </section>
          )}
        </div>
        <header className="solo-toolbar">
          <a href="/" target="_top" aria-label="Back to 26">
            ← 26
          </a>
          <span>Solo practice</span>
          {ready && !lost ? (
            <nav aria-label="Practice actions">
              <button
                disabled={trialFinished}
                onClick={paused ? continueDriving : pause}
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={recover}
                disabled={paused || recoveryPending || !recoveryReady}
              >
                {recoveryPending ? "Returning…" : "Back to track"}
              </button>
              <button
                onClick={() => {
                  reset();
                  continueDriving();
                }}
              >
                Reset kart
              </button>
            </nav>
          ) : null}
        </header>
        <SoloCourseSettings
          graphics={
            <>
              <GraphicsControls {...graphics} />
              <label>
                Graphics rehearsal: room size
                <input
                  aria-label="Graphics rehearsal room size"
                  type="number"
                  min={1}
                  max={80}
                  value={graphicsPlayers}
                  onChange={(event) =>
                    setGraphicsPlayers(
                      Math.max(1, Math.min(80, Number(event.target.value) || 1)),
                    )
                  }
                />
              </label>
              <p>
                This tests the automatic detail policy; it does not create players or
                change driving.
              </p>
            </>
          }
        />
        {profile && profile.tier !== graphics.tier ? (
          <p role="status">Graphics limited to Low on this screen.</p>
        ) : null}
        {ready && !lost ? (
          <>
            <Telemetry />
            <SoloTrialStatus />
            <SoloPowerInventory />
            {paused && !trialFinished ? (
              <div className="solo-message solo-paused" role="status">
                <h2>Taking a pit stop.</h2>
                <button onClick={continueDriving}>Keep driving</button>
              </div>
            ) : null}
            <SoloDrivingControls />
          </>
        ) : null}
      </main>
    </GraphicsTierContext>
  );
}

function GraphicsMonitor({ onHealth }: { onHealth: (health: FrameHealth) => void }) {
  const [probe] = useState(createFrameProbe);
  useFrame(() => {
    const state = useGameStore.getState();
    if (state.soloPaused || !state.soloStarted || document.hidden) {
      probe.reset();
      return;
    }
    const next = probe.sample(performance.now());
    if (next) onHealth(next);
  });
  return null;
}

function SoloCourseSettings({ graphics }: { graphics: ReactNode }) {
  const [open, setOpen] = useState(false);
  const settings = useGameStore((state) => state.soloCourseSettings);
  const handling = useGameStore((state) => state.soloHandling);
  const mode = useGameStore((state) => state.soloMode);
  const itemsEnabled = useGameStore((state) => state.soloItemsEnabled);
  const update = (value: CourseSettings) => {
    pause();
    useGameStore.setState({ soloCourseSettings: value });
    reset();
  };
  return (
    <section className="solo-course-settings" data-open={open}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Course set-up
      </button>
      <div className="solo-course-options" aria-hidden={!open} inert={!open}>
        <div>
          <PracticePresentation />
          {graphics}
          <label>
            Practice mode
            <select
              value={mode}
              onChange={(event) => {
                const mode = event.target.value;
                if (!["free", "trial-1", "trial-3"].includes(mode)) return;
                pause();
                useGameStore.setState({ soloMode: mode, soloPractice: null });
                reset();
              }}
            >
              <option value="free">Free drive</option>
              <option value="trial-1">One-lap time trial</option>
              <option value="trial-3">Three-lap time trial</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={itemsEnabled}
              onChange={(event) => {
                pause();
                useGameStore.setState({ soloItemsEnabled: event.target.checked });
                reset();
              }}
            />
            Item boxes in practice
          </label>
          <SoloTrialRecords />
          <p>
            Time trials start at the coloured line ahead of the kart, require all eight
            sectors and stop the clock while paused. Recovery is recorded as assisted.
            Mode and item changes also reset and pause practice.
          </p>
          <p>Course and handling changes reset the kart and pause practice.</p>
          <label>
            Contact handling
            <select
              value={handling}
              onChange={(event) => {
                const parsed = kartHandlingSchema.safeParse(event.target.value);
                if (!parsed.success) return;
                pause();
                useGameStore.setState({ soloHandling: parsed.data });
                reset();
              }}
            >
              {kartHandlingSchema.options.map((preset) => (
                <option key={preset} value={preset}>
                  {kartHandlingNames[preset]}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["boosts", "Floor boosts"],
              ["ramps", "Ramps and gliding"],
              ["hazards", "Moving sweepers"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(event) =>
                  update({ ...settings, [key]: event.target.checked })
                }
              />
              {label}
            </label>
          ))}
          <button onClick={() => update({ ...clearCourseSettings })}>
            Clear track
          </button>
          <button onClick={() => update({ ...defaultCourseSettings })}>
            Restore course
          </button>
          {soloCourse.map((feature) => (
            <button
              key={feature.id}
              onClick={() => {
                useGameStore.setState({ soloPractice: feature.id, soloMode: "free" });
                update({ ...defaultCourseSettings });
              }}
            >
              Rehearse{" "}
              {feature.kind === "boost"
                ? "floor boost"
                : feature.kind === "ramp"
                  ? "ramp and glide"
                  : "sweeper"}
            </button>
          ))}
          <button
            onClick={() => {
              useGameStore.setState({ soloPractice: null });
              update(settings);
            }}
          >
            Return to starting grid
          </button>
          <p>
            On the opening straight: left lane for boost and ramp; right lane for the
            sweeper.
          </p>
        </div>
      </div>
    </section>
  );
}

function SoloTrialStatus() {
  const trial = useGameStore((state) => state.soloTrial);
  const paused = useGameStore((state) => state.soloPaused);
  if (!trial) return null;
  return (
    <div className="solo-trial-panel" data-finished={trial.finished}>
      <KartTimeTrial
        trial={trial}
        paused={paused}
        onRestart={() => {
          pause();
          reset();
        }}
      />
    </div>
  );
}

function SoloTrialRecords() {
  const data = useGameStore((state) => state.soloRecords);
  const notice = useGameStore((state) => state.soloRecordNotice);
  const config = useGameStore((state) => state.soloTrial?.config);
  const update = (next: typeof data) => {
    const notice = writeKartRecords(browserKartRecordStorage, next);
    useGameStore.setState({ soloRecords: next, soloRecordNotice: notice });
  };
  return (
    <KartTrialRecords
      data={data}
      config={config}
      notice={notice}
      onEnabled={(enabled) =>
        update({ ...data, enabled, records: enabled ? data.records : [] })
      }
      onClear={() => update({ ...data, records: [] })}
    />
  );
}

const element = document.getElementById("root");
if (!element) throw new Error("Missing game root");
createRoot(element).render(<SoloGame />);
