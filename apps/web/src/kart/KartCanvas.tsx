import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { KartRaceView, KartVfxPreset } from "@26/shared";
import { importedRoute } from "../../../../packages/shared/src/kart-route";
import { createCircuit } from "./circuit";
import type { SelfPrediction } from "./self-prediction";
import type { KartRenderState } from "./view-readiness";
import { serverRoundTrip } from "../live/server-clock";
import { kartCameraPose, boostCameraAmount } from "./presentation";
import { vfxRehearsalRace, type VfxScript } from "./vfx-rehearsal";
import type { VfxCounts } from "./vfx-budget";
import {
  neutralKartLook,
  resolveKartSettings,
  parkTrackId,
  parkRoute,
  type KartLookPreset,
} from "@26/shared";
import { createNativeKartLook, type KartLookStats } from "./look-renderer";
import { driverFaceUrl } from "./driver-face";
import { useKartDrivers, type KartDrivers } from "./drivers-context";
import {
  createFrameProbe,
  safeGraphicsProfile,
  type GraphicsTier,
  type FrameHealth,
} from "./graphics";

/** Interpolates public poses only; phone rendering is bounded to self plus nearby racers. */
export default function KartCanvas({
  race,
  mobile,
  reducedMotion,
  followPlayerId,
  graphicsTier = "balanced",
  onFrameHealth,
  spectator = false,
  vfxPreset,
  paused = false,
  onVfxStats,
  vfxRehearsal,
  lookPreset,
  onLookStats,
  prediction,
  onRenderState,
}: {
  race: KartRaceView;
  mobile: boolean;
  reducedMotion: boolean;
  followPlayerId?: string;
  graphicsTier?: GraphicsTier;
  onFrameHealth?: (health: FrameHealth) => void;
  spectator?: boolean;
  vfxPreset?: KartVfxPreset;
  paused?: boolean;
  onVfxStats?: (stats: VfxCounts) => void;
  vfxRehearsal?: { script: VfxScript; run: number };
  lookPreset?: KartLookPreset;
  onLookStats?: (stats: KartLookStats) => void;
  /** Draws the followed kart from local prediction; the room stays authoritative. */
  prediction?: SelfPrediction;
  onRenderState?: (state: KartRenderState) => void;
}) {
  const focusPlayerId = spectator ? undefined : followPlayerId;
  const perspective = Boolean(followPlayerId);
  const following = useRef(followPlayerId);
  const predictor = useRef(prediction);
  const readiness = useRef(onRenderState);
  useEffect(() => {
    readiness.current = onRenderState;
  }, [onRenderState]);
  useEffect(() => {
    predictor.current = prediction;
  }, [prediction]);
  const effects = useRef({ preset: vfxPreset, paused, rehearsal: vfxRehearsal });
  const lookConfig = useRef({ preset: lookPreset, report: onLookStats });
  useEffect(() => {
    lookConfig.current = { preset: lookPreset, report: onLookStats };
  }, [lookPreset, onLookStats]);
  const mount = useRef<HTMLDivElement>(null);
  const live = useRef(race),
    reduced = useRef(reducedMotion);
  const drivers = useKartDrivers();
  const liveDrivers = useRef(drivers);
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const [vehicleState, setVehicleState] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");
  const [assetState, setAssetState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const quality = useRef(graphicsTier);
  const report = useRef(onFrameHealth);
  const vfxReport = useRef(onVfxStats);
  useEffect(() => {
    quality.current = graphicsTier;
    report.current = onFrameHealth;
    vfxReport.current = onVfxStats;
  }, [graphicsTier, onFrameHealth, onVfxStats]);
  useEffect(() => {
    following.current = followPlayerId;
    effects.current = { preset: vfxPreset, paused, rehearsal: vfxRehearsal };
    live.current = race;
    reduced.current = reducedMotion;
    liveDrivers.current = drivers;
  }, [race, reducedMotion, drivers, followPlayerId, vfxPreset, paused, vfxRehearsal]);
  useEffect(() => {
    const root = mount.current;
    if (!root) return;
    readiness.current?.("loading");
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !mobile,
        powerPreference: mobile ? "low-power" : "high-performance",
        alpha: false,
      });
    } catch {
      readiness.current?.("failed");
      // Constructor failure has no renderer to subscribe to. Keep the existing
      // imperative fallback and report its local availability to the phone.
      const message = document.createElement("p"),
        retry = document.createElement("button");
      message.setAttribute("role", "status");
      message.textContent =
        "The circuit could not load. Race timing and the leaderboard continue.";
      retry.type = "button";
      retry.textContent = "Retry circuit";
      retry.onclick = () => {
        readiness.current?.("loading");
        setRevision((value) => value + 1);
      };
      root.append(message, retry);
      return () => {
        message.remove();
        retry.remove();
      };
    }
    const chooseProfile = () =>
      safeGraphicsProfile(quality.current, {
        webgl: true,
        maxTextureSize: renderer.capabilities.maxTextureSize,
        pixelRatioLimit: window.devicePixelRatio,
      });
    const initialProfile = chooseProfile();
    if (!initialProfile) {
      renderer.dispose();
      setFailed(true);
      readiness.current?.("failed");
      return;
    }
    let profile = initialProfile;
    renderer.setPixelRatio(profile.pixelRatio);
    renderer.shadowMap.enabled = false;
    root.append(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      focusPlayerId ? "Your driving view" : "Live kart circuit",
    );
    const colour = (role: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--${role})`;
      root.append(probe);
      const value = new THREE.Color(getComputedStyle(probe).color);
      probe.remove();
      return value;
    };
    let dirty = true;
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
      focusPlayerId,
      race.trackId,
      () => setFailed(true),
      (state) => {
        dirty = true;
        setAssetState(state);
        readiness.current?.(state === "ready" ? "usable" : state);
      },
      8,
      (state) => {
        dirty = true;
        setVehicleState(state);
      },
      () => {
        dirty = true;
      },
    );
    const camera = perspective
      ? new THREE.PerspectiveCamera(65, 1, 0.1, 1000)
      : new THREE.OrthographicCamera(-64, 64, 64, -64, 0.1, 500);
    const route =
      race.trackId === parkTrackId
        ? parkRoute.points
        : race.trackId === "mario-circuit-v1"
          ? importedRoute
          : [
              [-63, -63],
              [63, 63],
            ];
    const xs = route.map((point) => point[0]!);
    const zs = route.map((point) => point[1]!);
    const centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centreZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const extent = Math.max(
      63,
      (Math.max(...xs) - Math.min(...xs)) * 0.6,
      (Math.max(...zs) - Math.min(...zs)) * 0.6,
    );
    camera.position.set(centreX, extent * 2, centreZ + 0.01);
    camera.lookAt(centreX, 0, centreZ);
    let lastFrame = 0,
      lastSnapshot: KartRaceView | undefined,
      lastDrivers: KartDrivers | undefined;
    let lastQuality = quality.current;
    let lastEffects = effects.current;
    let lastLook = lookConfig.current;
    let look: ReturnType<typeof createNativeKartLook> | undefined;
    let configuredLook: KartLookPreset | undefined;
    let lastLookReport = 0;
    let boost = 0;
    let lastVfxReport = 0;
    let sampleTime = 0,
      sampleKey = "";
    const probe = createFrameProbe();
    const resize = new ResizeObserver(() => {
      const width = Math.max(1, root.clientWidth),
        height = Math.max(1, root.clientHeight),
        aspect = width / height;
      renderer.setSize(width, height, false);
      if (camera instanceof THREE.PerspectiveCamera) camera.aspect = aspect;
      else {
        camera.left = -extent * Math.max(1, aspect);
        camera.right = -camera.left;
        camera.top = extent * Math.max(1, 1 / aspect);
        camera.bottom = -camera.top;
      }
      camera.updateProjectionMatrix();
      dirty = true;
    });
    resize.observe(root);
    const frame = (now: number) => {
      if (document.hidden) return;
      let forceStats = false;
      if (lastEffects !== effects.current) {
        lastEffects = effects.current;
        dirty = true;
        forceStats = true;
      }
      if (lastLook !== lookConfig.current) {
        lastLook = lookConfig.current;
        dirty = true;
        forceStats = true;
      }
      if (
        !reduced.current &&
        !effects.current.paused &&
        live.current.participants.some((driver) => driver.status === "RACING")
      ) {
        const health = probe.sample(now);
        if (health) report.current?.(health);
      }
      if (lastQuality !== quality.current) {
        lastQuality = quality.current;
        profile = chooseProfile() ?? profile;
        renderer.setPixelRatio(profile.pixelRatio);
        renderer.setSize(
          Math.max(1, root.clientWidth),
          Math.max(1, root.clientHeight),
          false,
        );
        dirty = true;
      }
      // Host frame cap; "auto" keeps Low at a battery-friendly 30 fps and
      // draws richer tiers at 60 so prediction looks smooth.
      const feel = resolveKartSettings(live.current.settings);
      const frameMs =
        feel.frameCap === "30" || (feel.frameCap === "auto" && profile.tier === "low")
          ? 1000 / 30
          : 1000 / 60;
      circuit.setGlide(feel.glide !== "off");
      if (mobile && lastFrame && now - lastFrame < frameMs - 1) return;
      const delta = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
      lastFrame = now;
      if (lastDrivers !== liveDrivers.current) {
        const { gameId, byPlayer } = liveDrivers.current;
        circuit.setDrivers(byPlayer, (mediaId) => driverFaceUrl(gameId, mediaId));
        lastDrivers = liveDrivers.current;
        dirty = true;
      }
      if (reduced.current && lastSnapshot === live.current && !dirty) return;
      const rehearsal = effects.current.rehearsal;
      const key = rehearsal ? `${rehearsal.script}:${rehearsal.run}` : "";
      if (sampleKey !== key) {
        sampleKey = key;
        sampleTime = 0;
      } else if (rehearsal && !effects.current.paused && !reduced.current)
        sampleTime = Math.min(
          10_000,
          sampleTime + Math.max(0, Math.min(0.1, delta)) * 1000,
        );
      const predicted =
        !rehearsal && !effects.current.paused && predictor.current && following.current
          ? predictSelf(predictor.current, live.current, now)
          : undefined;
      circuit.setPredicted(predicted ? following.current : undefined);
      const displayRace = rehearsal
        ? vfxRehearsalRace(live.current, rehearsal.script, sampleTime, rehearsal.run)
        : (predicted ?? live.current);
      circuit.update(
        displayRace,
        effects.current.paused ? 0 : delta,
        reduced.current,
        profile.sparkStride,
        profile.sparkLimit,
        profile.nearbyLimit,
        profile.tier !== "low",
        effects.current.preset
          ? {
              preset: effects.current.preset,
              paused: effects.current.paused,
              tier: profile.tier,
            }
          : undefined,
      );
      const stats = circuit.renderStats();
      renderer.domElement.dataset.playerId = following.current ?? "";
      renderer.domElement.dataset.roomLook = displayRace.look ?? "off";
      renderer.domElement.dataset.karts = String(stats.drivers);
      renderer.domElement.dataset.vehicleDetail = stats.detailed
        ? "detailed"
        : "simple";
      const pose = following.current ? circuit.pose(following.current) : undefined;
      const followedDriver = following.current
        ? displayRace.participants.find(
            (driver) => driver.playerId === following.current,
          )
        : undefined;
      // Drawn position of the followed kart, for browser checks of responsiveness.
      renderer.domElement.dataset.followPose = pose
        ? `${pose.x.toFixed(2)},${pose.z.toFixed(2)},${pose.heading.toFixed(3)}`
        : "";
      if (pose) {
        boost = boostCameraAmount(
          boost,
          Boolean(followedDriver?.boostRemainingMs),
          delta,
          reduced.current,
        );
        const framing = kartCameraPose(pose, reduced.current, boost);
        camera.position.set(...framing.position);
        camera.lookAt(...framing.target);
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = 65 + boost * 6;
          camera.updateProjectionMatrix();
        }
      }
      circuit.renderVfx(camera);
      const effectStats = circuit.vfxStats();
      renderer.domElement.dataset.vfxParticles = String(effectStats.particles);
      renderer.domElement.dataset.vfxSkids = String(effectStats.skids);
      renderer.domElement.dataset.vfxDust = String(effectStats.byKind?.dust ?? 0);
      renderer.domElement.dataset.vfxSparks = String(effectStats.byKind?.spark ?? 0);
      renderer.domElement.dataset.vfxConfetti = String(
        effectStats.byKind?.confetti ?? 0,
      );
      renderer.domElement.dataset.vfxSampleMs = String(displayRace.elapsedMs);
      renderer.domElement.dataset.vfxPaused = String(effects.current.paused);
      if (lookConfig.current.preset && !look)
        look = createNativeKartLook(THREE, renderer, {
          ground: colour("background"),
          road: colour("surface"),
          accent: colour("accent"),
          highlight: colour("highlight"),
          muted: colour("muted"),
          ink: colour("foreground"),
        });
      if (look && configuredLook !== lookConfig.current.preset) {
        configuredLook = lookConfig.current.preset;
        look.configure(configuredLook ?? neutralKartLook);
      }
      if (look)
        look.render(circuit.scene, camera, profile.tier, {
          dt: delta,
          paused: effects.current.paused,
          reducedMotion: reduced.current,
          speed: Math.abs(followedDriver?.speed ?? 0),
          boost: followedDriver?.boostRemainingMs ? 1 : 0,
          focus: pose ? [pose.x, pose.height ?? 0, pose.z] : [centreX, 0, centreZ],
        });
      else renderer.render(circuit.scene, camera);
      if (look && lookConfig.current.report) {
        const lookStats = {
          ...look.stats(),
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        };
        renderer.domElement.dataset.lookActive = String(lookStats.active);
        renderer.domElement.dataset.lookBuffers = String(lookStats.buffers);
        renderer.domElement.dataset.lookPasses = String(lookStats.passes);
        renderer.domElement.dataset.lookWidth = String(lookStats.width);
        renderer.domElement.dataset.lookHeight = String(lookStats.height);
        renderer.domElement.dataset.lookSky = String(
          lookStats.environment?.sky ?? false,
        );
        renderer.domElement.dataset.lookReflection = String(
          lookStats.environment?.reflection ?? false,
        );
        renderer.domElement.dataset.lookShadows = String(
          lookStats.environment?.shadows ?? false,
        );
        renderer.domElement.dataset.lookShadowSize = String(
          lookStats.environment?.shadowSize ?? 0,
        );
        renderer.domElement.dataset.lookDepthTextures = String(lookStats.depthTextures);
        renderer.domElement.dataset.lookTextureSamples = String(
          lookStats.textureSamples,
        );
        for (const key of [
          "wind",
          "chromatic",
          "lensDirt",
          "bloom",
          "ao",
          "tiltShift",
        ] as const)
          renderer.domElement.dataset[`look${key[0]!.toUpperCase()}${key.slice(1)}`] =
            String(lookStats.optics[key]);
        if (!lastLookReport || forceStats || now - lastLookReport >= 500) {
          lookConfig.current.report(lookStats);
          lastLookReport = now;
        }
      }
      // Local admin opt-in only: never add renderer diagnostics to room snapshots.
      if (vfxReport.current) {
        const resources = {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        };
        renderer.domElement.dataset.vfxCalls = String(resources.calls);
        renderer.domElement.dataset.vfxTriangles = String(resources.triangles);
        renderer.domElement.dataset.vfxGeometries = String(resources.geometries);
        renderer.domElement.dataset.vfxTextures = String(resources.textures);
        if (!lastVfxReport || forceStats || now - lastVfxReport >= 500) {
          vfxReport.current({ ...effectStats, resources });
          lastVfxReport = now;
        }
      }
      lastSnapshot = live.current;
      dirty = false;
    };
    const lost = (event: Event) => {
      event.preventDefault();
      renderer.setAnimationLoop(null);
      setFailed(true);
      readiness.current?.("failed");
    };
    const restored = () => {
      readiness.current?.("loading");
      setFailed(false);
      setRevision((value) => value + 1);
    };
    const visibility = () => {
      circuit.resetVfx();
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
      look?.dispose();
      circuit.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [
    mobile,
    focusPlayerId,
    perspective,
    spectator,
    race.raceId,
    race.trackId,
    revision,
  ]);
  return (
    <div className="kart-canvas-root">
      <div ref={mount} className="kart-canvas-mount" />
      {vehicleState === "loading" ? (
        <p role="status">Loading detailed karts… Simple karts remain available.</p>
      ) : null}
      {vehicleState === "failed" ? (
        <p role="status">
          Detailed karts unavailable. Using simple karts.{" "}
          <button
            type="button"
            onClick={() => {
              setVehicleState("idle");
              setRevision((value) => value + 1);
            }}
          >
            Retry detailed karts
          </button>
        </p>
      ) : null}
      {assetState === "loading" && !failed ? (
        <p role="status">Loading circuit model… Race timing follows the room.</p>
      ) : null}
      {failed ? (
        <div className="kart-canvas-recovery" role="status">
          <p>The circuit was interrupted. Race timing and the leaderboard continue.</p>
          <button
            type="button"
            onClick={() => {
              readiness.current?.("loading");
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

/** The live race with this phone's own kart drawn where prediction puts it. */
function predictSelf(prediction: SelfPrediction, race: KartRaceView, now: number) {
  prediction.server(race, now, serverRoundTrip() ?? 120);
  const pose = prediction.pose(now);
  if (!pose) return undefined;
  return {
    ...race,
    participants: race.participants.map((driver) =>
      driver.playerId === race.selfPlayerId ? { ...driver, ...pose } : driver,
    ),
  };
}
