import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import { Bvh, useProgress } from "@react-three/drei";
import { TouchController } from "../../web/src/kart/TouchController";
import {
  themeDocumentHead,
  themes,
  DEFAULT_THEME_ID,
} from "../../web/src/theme/themes";
import { TrackItems } from "./TrackItems";
import { Course } from "./Course";
import { DriftGauge } from "../../web/src/kart/DriftGauge";
import {
  defaultCourseSettings,
  clearCourseSettings,
  soloCourse,
  type CourseSettings,
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
  useEffect(() => {
    camera.position.set(0, 2, 5);
    camera.lookAt(0, -2, -9);
    useGameStore.setState({
      soloStarted: true,
      soloPaused: useGameStore.getState().soloPaused || document.hidden,
    });
  }, [camera]);
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
            : contact
              ? "Barrier contact — steer away"
              : surface === "dirt"
                ? "Off-road — reduced grip and speed"
                : drift
                  ? "Release drift to boost"
                  : sliding
                    ? "Drifting — hold to charge"
                    : "Hold A to drive"}
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
  const item = useGameStore((s) => s.soloPowers.item),
    shield = useGameStore((s) => s.soloPowers.shieldUntil > s.soloElapsed),
    slowed = useGameStore((s) => s.soloPowers.slowedUntil > s.soloElapsed);
  const disabled = useGameStore(
      (s) => s.soloPaused || s.soloRecover !== s.soloRecovered,
    ),
    notice = useGameStore((s) => s.soloPowerMessage);
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

function SoloGame() {
  const [mounted, setMounted] = useState(false);
  const [lost, setLost] = useState(false);
  const paused = useGameStore((state) => state.soloPaused);
  const ready = useGameStore((state) => state.soloStarted);
  const recoveryPending = useGameStore(
    (state) => state.soloRecover !== state.soloRecovered,
  );
  const recoveryReady = useGameStore((state) => state.soloRecoveryReady);
  const recoveryMessage = useGameStore((state) => state.soloRecoveryMessage);
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
    <main className="solo-game" data-ready={ready} aria-label="Solo kart practice">
      <div className="solo-world">
        {mounted ? (
          <GameBoundary>
            {lost ? (
              <Recovery />
            ) : (
              <Canvas
                dpr={1}
                shadows={false}
                frameloop={paused && ready ? "demand" : "always"}
                camera={{ position: [0, 2, 5], far: 2500, fov: 65 }}
                gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
                fallback={<Recovery />}
                onCreated={({ camera, gl }) => {
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
              On a phone, hold A and steer with your other thumb.
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
            <button onClick={paused ? continueDriving : pause}>
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
      <SoloCourseSettings />
      {ready && !lost ? (
        <>
          <Telemetry />
          <SoloPowerInventory />
          {paused ? (
            <div className="solo-message solo-paused" role="status">
              <h2>Taking a pit stop.</h2>
              <button onClick={continueDriving}>Keep driving</button>
            </div>
          ) : null}
          <aside className="solo-controls" aria-label="Driving controls">
            <TouchController disabled={paused || recoveryPending} onChange={drive} />
            <p role="status">
              {recoveryMessage ||
                "Arrows: drive · Space: drift · Back to track if you get stuck"}
            </p>
          </aside>
        </>
      ) : null}
    </main>
  );
}

function SoloCourseSettings() {
  const [open, setOpen] = useState(false);
  const settings = useGameStore((state) => state.soloCourseSettings);
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
          <p>Changes reset the kart and pause practice.</p>
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
                useGameStore.setState({ soloPractice: feature.id });
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

const element = document.getElementById("root");
if (!element) throw new Error("Missing game root");
createRoot(element).render(<SoloGame />);
