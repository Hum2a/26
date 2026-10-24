import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { KartRaceView } from "@26/shared";
import { createCircuit } from "./circuit";
import { kartCameraPose } from "./presentation";
import { driverFaceUrl } from "./driver-face";
import { useKartDrivers, type KartDrivers } from "./drivers-context";
import {
  createFrameProbe,
  graphicsProfiles,
  type GraphicsTier,
  type FrameHealth,
} from "./graphics";

/** Interpolates public poses only. Phone rendering is bounded to its own kart. */
export default function KartCanvas({
  race,
  mobile,
  reducedMotion,
  followPlayerId,
  graphicsTier = "balanced",
  onFrameHealth,
}: {
  race: KartRaceView;
  mobile: boolean;
  reducedMotion: boolean;
  followPlayerId?: string;
  graphicsTier?: GraphicsTier;
  onFrameHealth?: (health: FrameHealth) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const live = useRef(race),
    reduced = useRef(reducedMotion);
  const drivers = useKartDrivers();
  const liveDrivers = useRef(drivers);
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const quality = useRef(graphicsTier);
  const report = useRef(onFrameHealth);
  useEffect(() => {
    quality.current = graphicsTier;
    report.current = onFrameHealth;
  }, [graphicsTier, onFrameHealth]);
  useEffect(() => {
    live.current = race;
    reduced.current = reducedMotion;
    liveDrivers.current = drivers;
  }, [race, reducedMotion, drivers]);
  useEffect(() => {
    const root = mount.current;
    if (!root) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !mobile,
        powerPreference: mobile ? "low-power" : "high-performance",
        alpha: false,
      });
    } catch {
      const message = document.createElement("p"),
        retry = document.createElement("button");
      message.setAttribute("role", "status");
      message.textContent =
        "The circuit could not load. Race timing and the leaderboard continue.";
      retry.type = "button";
      retry.textContent = "Retry circuit";
      retry.onclick = () => setRevision((value) => value + 1);
      root.append(message, retry);
      return () => {
        message.remove();
        retry.remove();
      };
    }
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        graphicsProfiles[quality.current].pixelRatio,
      ),
    );
    renderer.shadowMap.enabled = false;
    root.append(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      followPlayerId ? "Your driving view" : "Live kart circuit",
    );
    if (followPlayerId) renderer.domElement.dataset.playerId = followPlayerId;
    const colour = (role: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--${role})`;
      root.append(probe);
      const value = new THREE.Color(getComputedStyle(probe).color);
      probe.remove();
      return value;
    };
    const circuit = createCircuit(
      {
        ground: colour("background"),
        road: colour("surface"),
        accent: colour("accent"),
        highlight: colour("highlight"),
        ink: colour("foreground"),
        muted: colour("muted"),
      },
      mobile,
      followPlayerId,
      race.trackId,
      () => setFailed(true),
    );
    const camera = followPlayerId
      ? new THREE.PerspectiveCamera(65, 1, 0.1, 1000)
      : new THREE.OrthographicCamera(-64, 64, 64, -64, 0.1, 500);
    camera.position.set(0, 112, 72);
    camera.lookAt(0, 0, -3);
    let dirty = true,
      lastFrame = 0,
      lastSnapshot: KartRaceView | undefined,
      lastDrivers: KartDrivers | undefined;
    let lastQuality = quality.current;
    const probe = createFrameProbe();
    const resize = new ResizeObserver(() => {
      const width = Math.max(1, root.clientWidth),
        height = Math.max(1, root.clientHeight),
        aspect = width / height;
      renderer.setSize(width, height, false);
      if (camera instanceof THREE.PerspectiveCamera) camera.aspect = aspect;
      else {
        camera.left = -63 * Math.max(1, aspect);
        camera.right = -camera.left;
        camera.top = 63 * Math.max(1, 1 / aspect);
        camera.bottom = -camera.top;
      }
      camera.updateProjectionMatrix();
      dirty = true;
    });
    resize.observe(root);
    const frame = (now: number) => {
      if (document.hidden) return;
      if (
        !reduced.current &&
        live.current.participants.some((driver) => driver.status === "RACING")
      ) {
        const health = probe.sample(now);
        if (health) report.current?.(health);
      }
      if (lastQuality !== quality.current) {
        lastQuality = quality.current;
        renderer.setPixelRatio(
          Math.min(
            window.devicePixelRatio || 1,
            graphicsProfiles[lastQuality].pixelRatio,
          ),
        );
        renderer.setSize(
          Math.max(1, root.clientWidth),
          Math.max(1, root.clientHeight),
          false,
        );
        dirty = true;
      }
      if (mobile && lastFrame && now - lastFrame < 1000 / 30 - 1) return;
      const delta = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
      lastFrame = now;
      if (lastDrivers !== liveDrivers.current) {
        const { gameId, byPlayer } = liveDrivers.current;
        circuit.setDrivers(byPlayer, (mediaId) => driverFaceUrl(gameId, mediaId));
        lastDrivers = liveDrivers.current;
        dirty = true;
      }
      if (reduced.current && lastSnapshot === live.current && !dirty) return;
      circuit.update(
        live.current,
        delta,
        reduced.current,
        graphicsProfiles[quality.current].sparkStride,
      );
      const pose = followPlayerId ? circuit.pose(followPlayerId) : undefined;
      if (pose) {
        const framing = kartCameraPose(pose, reduced.current);
        camera.position.set(...framing.position);
        camera.lookAt(...framing.target);
      }
      renderer.render(circuit.scene, camera);
      lastSnapshot = live.current;
      dirty = false;
    };
    const lost = (event: Event) => {
      event.preventDefault();
      renderer.setAnimationLoop(null);
      setFailed(true);
    };
    const restored = () => {
      setFailed(false);
      setRevision((value) => value + 1);
    };
    const visibility = () => {
      probe.reset();
      lastFrame = 0;
      dirty = true;
      renderer.setAnimationLoop(document.hidden ? null : frame);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.addEventListener("webglcontextrestored", restored);
    document.addEventListener("visibilitychange", visibility);
    // Rebuild material colours when the existing theme adapter changes the document.
    const theme = new MutationObserver(() => setRevision((value) => value + 1));
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    renderer.setAnimationLoop(frame);
    return () => {
      resize.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("webglcontextrestored", restored);
      renderer.setAnimationLoop(null);
      circuit.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mobile, followPlayerId, race.raceId, race.trackId, revision]);
  return (
    <div className="kart-canvas-root">
      <div ref={mount} className="kart-canvas-mount" />
      {failed ? (
        <div className="kart-canvas-recovery" role="status">
          <p>The circuit was interrupted. Race timing and the leaderboard continue.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setRevision((value) => value + 1);
            }}
          >
            Retry circuit
          </button>
        </div>
      ) : null}
    </div>
  );
}
