// Adapted from mario-kart-js 0f7a430. See UPSTREAM.md and THIRD_PARTY_NOTICES.md.
// Rendering is upstream-derived; movement/contact use the shared pure model.
import { DriftEffects } from "../DriftEffects";
import { themes, DEFAULT_THEME_ID } from "../../../web/src/theme/themes";
import { driftPose } from "../../../web/src/kart/drift-effects";
import { kartVehiclePose } from "../../../web/src/kart/presentation";
import { vehiclePose } from "../../../web/src/kart/vehicle-pose";
import { Kart } from "./models/Kart";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Raycaster, Vector3 } from "three";
import {
  clearOfWalls,
  createDrivingBody,
  stepDriving,
  soloDriving,
  kartNeutral,
  createKartPowers,
  stepKartPowers,
  useKartPower,
  powerDrivingBody,
  soloItemBoxes,
  kartItemNames,
  soloCourse,
  courseEnabled,
  drivingDriftLevel,
  stepKartTrial,
  recoverKartTrial,
  createKartTrial,
  kartTrialRecord,
} from "@26/shared";
import {
  addKartRecord,
  browserKartRecordStorage,
  writeKartRecords,
} from "../../../web/src/kart/kart-records";
import { nearbySoloWalls } from "../track/collision-world";
import { useGameStore } from "./store";

export const PlayerController = () => {
  // Reset replaces this keyed controller. Until React commits that replacement,
  // an old render callback must not republish its previous run into the store.
  const generation = useRef(useGameStore.getState().soloReset);
  const playerRef = useRef(null),
    kartRef = useRef(null);
  const cameraGroupRef = useRef(null),
    cameraLookAtRef = useRef(null);
  const hop = useRef(0),
    heldDrift = useRef(false);
  const practice = soloCourse.find(
    (f) => f.id === useGameStore.getState().soloPractice,
  );
  const trial = useRef(useGameStore.getState().soloTrial);
  const start = trial.current
    ? { x: 0, z: 8 }
    : practice
      ? { x: practice.x, z: practice.z + 12 }
      : { x: 0, z: 0 };
  const body = useRef(createDrivingBody(start.x, start.z, -Math.PI / 2));
  const powers = useRef(createKartPowers()),
    oils = useRef([]),
    usedItem = useRef(useGameStore.getState().soloItemUse);
  const previous = useRef(body.current);
  const safe = useRef({
    ...start,
    heading: -Math.PI / 2,
    cursor: trial.current?.cursor,
    lap: 0,
  });
  const elapsed = useRef(0),
    accumulator = useRef(0),
    lastRecovery = useRef(-2000),
    recovery = useRef(useGameStore.getState().soloRecover);
  const speedRef = useRef(0),
    driftDirection = useRef(0),
    driftPower = useRef(0);
  const vehicleMotion = useRef({ speed: 0, turnRate: 0, travel: 0 });
  const lastRendered = useRef(null);
  const jumpOffset = useRef(0),
    backWheelOffset = useRef({ left: 0, right: 0 });
  const ray = useRef(new Raycaster()),
    meshes = useRef([]);
  const { scene } = useThree();
  const target = useRef(new Vector3()),
    look = useRef(new Vector3());
  useEffect(
    () => () => {
      meshes.current = [];
    },
    [],
  );

  function surfaceAt(x, z) {
    if (!meshes.current.length)
      scene.getObjectByName("solo-track")?.traverse((object) => {
        if (object.isMesh && ["ground road", "ground dirt"].includes(object.name))
          meshes.current.push(object);
      });
    ray.current.set(new Vector3(x, 3, z), new Vector3(0, -1, 0));
    ray.current.far = 8;
    ray.current.firstHitOnly = true;
    const hits = ray.current.intersectObjects(meshes.current, false);
    if (hits.some((hit) => hit.object.name === "ground road")) return "road";
    return hits.length ? "dirt" : "unsupported";
  }

  useFrame(({ camera }, delta) => {
    const store = useGameStore.getState();
    if (
      generation.current !== store.soloReset ||
      store.soloPaused ||
      !store.soloStarted ||
      trial.current?.finished ||
      !playerRef.current ||
      !kartRef.current
    ) {
      accumulator.current = 0;
      body.current = { ...body.current, driftMs: 0, wasDrifting: false };
      return;
    }
    if (recovery.current !== store.soloRecover) {
      powers.current = {
        ...powers.current,
        turboUntil: 0,
        shieldUntil: 0,
        slowedUntil: 0,
      };
      recovery.current = store.soloRecover;
      if (elapsed.current - lastRecovery.current >= 2000) {
        // A recovery anchor from the previous lap must not grant its gates again.
        const sameLap =
          !trial.current || safe.current.lap === trial.current.laps.length;
        const anchor = sameLap
          ? safe.current
          : {
              x: 0,
              z: 8,
              heading: -Math.PI / 2,
              cursor: createKartTrial(trial.current.config).cursor,
            };
        body.current = createDrivingBody(anchor.x, anchor.z, anchor.heading);
        if (trial.current)
          trial.current = recoverKartTrial(trial.current, anchor.cursor);
        previous.current = body.current;
        accumulator.current = 0;
        lastRecovery.current = elapsed.current;
        playerRef.current.position.set(body.current.x, 0, body.current.z);
        playerRef.current.rotation.y = -body.current.heading - Math.PI / 2;
        playerRef.current.updateMatrixWorld(true);
        camera.position.copy(cameraGroupRef.current.getWorldPosition(target.current));
        useGameStore.setState({
          soloRecoveryMessage: "Back on track — controls released",
        });
      }
      useGameStore.setState({
        soloRecovered: recovery.current,
        soloControls: { ...kartNeutral },
      });
    }
    if (store.soloItemsEnabled && usedItem.current !== store.soloItemUse) {
      usedItem.current = store.soloItemUse;
      const used = useKartPower(powers.current, "solo", body.current, elapsed.current);
      if (used) {
        powers.current = used.powers;
        if (used.oil) oils.current = [...oils.current, used.oil].slice(-64);
        useGameStore.setState({ soloPowerMessage: "Power-up used" });
      }
    }
    accumulator.current += Math.min(0.1, Math.max(0, delta)) * 1000;
    let surface = surfaceAt(body.current.x, body.current.z);
    while (accumulator.current >= 20) {
      const controls = useGameStore.getState().soloControls;
      const input = controls;
      const effective =
        surface === "unsupported" && !(body.current.height > 0) ? kartNeutral : input;
      previous.current = body.current;
      body.current = { ...body.current, courseMs: elapsed.current };
      body.current = powerDrivingBody(body.current, powers.current, elapsed.current);
      body.current = stepDriving(
        body.current,
        effective,
        20,
        soloDriving,
        nearbySoloWalls(
          body.current.x,
          body.current.z,
          soloDriving.radius + Math.hypot(body.current.vx, body.current.vz) * 0.02,
        ),
        surface !== "road" || powers.current.slowedUntil > elapsed.current,
        true,
        soloCourse.filter((f) => courseEnabled(f, store.soloCourseSettings)),
        store.soloHandling,
      );
      const effect = stepKartPowers(
        powers.current,
        "solo",
        previous.current,
        body.current,
        store.soloItemsEnabled && surface === "road" && !(body.current.height > 0)
          ? soloItemBoxes
          : [],
        body.current.height > 0 ? [] : oils.current,
        elapsed.current + 20,
        "solo",
      );
      if (effect.powers.collections > powers.current.collections)
        useGameStore.setState({
          soloPowerMessage: "Collected " + kartItemNames[effect.powers.item],
        });
      powers.current = effect.powers;
      if (effect.hit) {
        body.current = {
          ...body.current,
          vx: body.current.vx * 0.35,
          vz: body.current.vz * 0.35,
          driftMs: 0,
          boostMs: 0,
          wasDrifting: false,
        };
      }
      oils.current = oils.current.filter((o) => o.expiresAt > elapsed.current + 20);
      elapsed.current += 20;
      accumulator.current -= 20;
      if (trial.current) {
        trial.current = stepKartTrial(trial.current, {
          x: body.current.x,
          z: body.current.z,
          speed: Math.hypot(body.current.vx, body.current.vz),
          stepMs: 20,
          activeMs: elapsed.current,
        });
        if (trial.current.finished) {
          const record = kartTrialRecord(trial.current);
          const records = record
            ? addKartRecord(store.soloRecords, record)
            : store.soloRecords;
          const notice =
            record && records.enabled
              ? writeKartRecords(browserKartRecordStorage, records)
              : store.soloRecordNotice;
          useGameStore.setState({
            soloPaused: true,
            soloControls: { ...kartNeutral },
            soloRecords: records,
            soloRecordNotice: notice,
          });
          accumulator.current = 0;
          break;
        }
      }
      surface = surfaceAt(body.current.x, body.current.z);
      if (
        surface === "road" &&
        !(body.current.height > 0) &&
        !body.current.contact &&
        clearOfWalls(
          body.current.x,
          body.current.z,
          nearbySoloWalls(body.current.x, body.current.z, 4),
          soloDriving.radius + 3,
        )
      )
        safe.current = {
          x: body.current.x,
          z: body.current.z,
          heading: body.current.heading,
          cursor: trial.current?.cursor,
          lap: trial.current?.laps.length ?? 0,
        };
    }
    const d = body.current,
      player = playerRef.current;
    const alpha = accumulator.current / 20,
      old = previous.current;
    const turn = Math.atan2(
      Math.sin(d.heading - old.heading),
      Math.cos(d.heading - old.heading),
    );
    const renderPose = kartVehiclePose({
      x: old.x + (d.x - old.x) * alpha,
      z: old.z + (d.z - old.z) * alpha,
      height: (old.height ?? 0) + ((d.height ?? 0) - (old.height ?? 0)) * alpha,
      heading: old.heading + turn * alpha,
    });
    player.position.set(...renderPose.position);
    player.rotation.y = -renderPose.heading - Math.PI / 2;
    speedRef.current = d.vx * Math.cos(d.heading) + d.vz * Math.sin(d.heading);
    const oldPose = lastRendered.current;
    if (oldPose) {
      const dx = renderPose.position[0] - oldPose[0],
        dz = renderPose.position[2] - oldPose[2];
      if (Math.hypot(dx, dz) < 8)
        vehicleMotion.current.travel +=
          dx * Math.cos(renderPose.heading) + dz * Math.sin(renderPose.heading);
    }
    lastRendered.current = renderPose.position;
    vehicleMotion.current.speed = speedRef.current;
    vehicleMotion.current.turnRate = d.turn;
    driftDirection.current = d.wasDrifting
      ? -(d.driftSide || Math.sign(d.turn)) * 0.6
      : 0;
    driftPower.current = d.driftMs / 1000;
    if (d.wasDrifting && !heldDrift.current) hop.current = 250;
    heldDrift.current = d.wasDrifting;
    hop.current = Math.max(0, hop.current - delta * 1000);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    jumpOffset.current = reduced ? 0 : Math.sin((hop.current / 250) * Math.PI) * 0.5;
    const easing = 1 - Math.exp(-10 * Math.min(delta, 0.1));
    const pose = driftPose(d.heading, d.vx, d.vz, d.wasDrifting, d.driftSide || 0);
    const chassis = vehiclePose(vehicleMotion.current, reduced, {
      wheelBase: 1.4,
      wheelRadius: 0.2892,
    });
    kartRef.current.rotation.y +=
      ((reduced ? 0 : -pose) - kartRef.current.rotation.y) * easing;
    kartRef.current.rotation.z += (chassis.roll - kartRef.current.rotation.z) * easing;
    cameraGroupRef.current.position.x +=
      ((reduced ? 0 : driftDirection.current * 0.7) -
        cameraGroupRef.current.position.x) *
      easing;
    cameraGroupRef.current.position.z +=
      ((d.boostMs > 0 && !reduced ? 6 : 5) - cameraGroupRef.current.position.z) *
      easing;
    if (camera.isPerspectiveCamera) {
      const fov = reduced ? 65 : d.boostMs > 0 ? 73 : 65;
      camera.fov += (fov - camera.fov) * easing;
      camera.updateProjectionMatrix();
    }
    player.updateMatrixWorld(true);
    camera.position.lerp(
      cameraGroupRef.current.getWorldPosition(target.current),
      1 - Math.exp(-8 * Math.min(delta, 0.1)),
    );
    camera.lookAt(cameraLookAtRef.current.getWorldPosition(look.current));
    useGameStore.setState({
      playerPosition: new Vector3(d.x, 0, d.z),
      soloPowers: powers.current,
      soloOils: oils.current,
      soloElapsed: elapsed.current,
      soloTrial: trial.current,
      speed: speedRef.current,
      isBoosting: d.boostMs > 0,
      soloSurface: surface,
      soloContact: d.contact,
      soloStunMs: d.stunMs ?? 0,
      soloRecoveryReady: elapsed.current - lastRecovery.current >= 2000,
      soloHeight: d.height ?? 0,
      soloVerticalSpeed: d.verticalSpeed ?? 0,
      soloTrackNotice: d.trackNotice ?? "",
      soloChargeMs: d.driftMs,
      soloBoostLevel: d.boostLevel ?? 0,
      driftLevel: { level: drivingDriftLevel(d.driftMs), charging: d.wasDrifting },
    });
  });
  return (
    <group ref={playerRef}>
      <group ref={cameraGroupRef} position={[0, 2, 5]} />
      <DriftEffects body={body} />
      <group ref={kartRef}>
        <Glider body={body} />
        <Kart
          speed={speedRef}
          driftDirection={driftDirection}
          driftPower={driftPower}
          jumpOffset={jumpOffset}
          backWheelOffset={backWheelOffset}
          vehicleMotion={vehicleMotion}
        />
        <group ref={cameraLookAtRef} position={[0, -0.5, -9]} />
      </group>
    </group>
  );
};

function Glider({ body }) {
  const wing = useRef(null);
  useFrame((_, dt) => {
    if (!wing.current) return;
    const target = body.current.height > 0 ? 1 : 0.001;
    wing.current.scale.lerp(
      new Vector3(target, target, target),
      1 - Math.exp(-12 * Math.min(dt, 0.1)),
    );
  });
  return (
    <group ref={wing} scale={0.001} position={[0, 0.9, 0]}>
      <mesh rotation={[0, 0, -0.08]}>
        <boxGeometry args={[5, 0.12, 1.6]} />
        <meshStandardMaterial color={themes[DEFAULT_THEME_ID].colors.accent} />
      </mesh>
      <mesh position={[0, -1, 0.7]}>
        <boxGeometry args={[0.1, 2, 0.1]} />
        <meshStandardMaterial color={themes[DEFAULT_THEME_ID].colors.foreground} />
      </mesh>
    </group>
  );
}
