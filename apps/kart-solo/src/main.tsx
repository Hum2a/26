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
import { PlayerController } from "./upstream/PlayerController.jsx";
import { Track } from "./upstream/models/Mario-circuit-test.jsx";
import { useGameStore } from "./upstream/store.js";
import { drive, pause, resume, reset } from "./session";
import "./solo.css";

const themeStyle = document.createElement("style");
themeStyle.textContent = themeDocumentHead().style;
document.head.append(themeStyle);

function Ready() {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.position.set(0, 2, 5);
    camera.lookAt(0, -2, -9);
    useGameStore.setState({ soloStarted: true, soloPaused: document.hidden });
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
        {boost ? "Boost!" : drift ? "Release drift to boost" : "Hold A to drive"}
      </span>
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

function SoloGame() {
  const [mounted, setMounted] = useState(false);
  const [lost, setLost] = useState(false);
  const paused = useGameStore((state) => state.soloPaused);
  const ready = useGameStore((state) => state.soloStarted);
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
      {ready && !lost ? (
        <>
          <Telemetry />
          {paused ? (
            <div className="solo-message solo-paused" role="status">
              <h2>Taking a pit stop.</h2>
              <button onClick={continueDriving}>Keep driving</button>
            </div>
          ) : null}
          <aside className="solo-controls" aria-label="Driving controls">
            <TouchController disabled={paused} onChange={drive} />
            <p>Arrows: drive · Space: drift · Reset if you get stuck</p>
          </aside>
        </>
      ) : null}
    </main>
  );
}

const element = document.getElementById("root");
if (!element) throw new Error("Missing game root");
createRoot(element).render(<SoloGame />);
