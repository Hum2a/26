// Adapted from mario-kart-js 0f7a430. See UPSTREAM.md and THIRD_PARTY_NOTICES.md.
// Rendering is upstream-derived; movement/contact use the shared pure model.
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
} from "@26/shared";
import { readGamepad } from "../gamepad";
import { nearbySoloWalls } from "../track/collision-world";
import { useGameStore } from "./store";

export const PlayerController = () => {
  const playerRef = useRef(null),
    kartRef = useRef(null);
  const cameraGroupRef = useRef(null),
    cameraLookAtRef = useRef(null);
  const gamepadArmed = useRef(true);
  const hop = useRef(0),
    heldDrift = useRef(false);
  const body = useRef(createDrivingBody(0, 0, -Math.PI / 2));
  const previous = useRef(body.current);
  const safe = useRef({ x: 0, z: 0, heading: -Math.PI / 2 });
  const elapsed = useRef(0),
    accumulator = useRef(0),
    lastRecovery = useRef(-2000),
    recovery = useRef(useGameStore.getState().soloRecover);
  const speedRef = useRef(0),
    driftDirection = useRef(0),
    driftPower = useRef(0);
  const jumpOffset = useRef(0),
    backWheelOffset = useRef({ left: 0, right: 0 }),
    inputTurn = useRef(0);
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
      store.soloPaused ||
      !store.soloStarted ||
      !playerRef.current ||
      !kartRef.current
    ) {
      gamepadArmed.current = false;
      accumulator.current = 0;
      body.current = { ...body.current, driftMs: 0, wasDrifting: false };
      return;
    }
    if (recovery.current !== store.soloRecover) {
      gamepadArmed.current = false;
      recovery.current = store.soloRecover;
      if (elapsed.current - lastRecovery.current >= 2000) {
        body.current = createDrivingBody(
          safe.current.x,
          safe.current.z,
          safe.current.heading,
        );
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
    accumulator.current += Math.min(0.1, Math.max(0, delta)) * 1000;
    const pad = readGamepad();
    if (!pad.gas && !pad.brake && !pad.drift && !pad.steer) gamepadArmed.current = true;
    let surface = surfaceAt(body.current.x, body.current.z);
    while (accumulator.current >= 20) {
      const controls = useGameStore.getState().soloControls;
      const input = gamepadArmed.current
        ? {
            ...controls,
            steer: controls.steer || pad.steer,
            gas: controls.gas || pad.gas,
            brake: controls.brake || pad.brake,
            drift: controls.drift || pad.drift,
          }
        : controls;
      const effective = surface === "unsupported" ? kartNeutral : input;
      previous.current = body.current;
      body.current = stepDriving(
        body.current,
        effective,
        20,
        soloDriving,
        nearbySoloWalls(
          body.current.x,
          body.current.z,
          soloDriving.radius + soloDriving.boostSpeed * 0.02,
        ),
        surface !== "road",
      );
      elapsed.current += 20;
      accumulator.current -= 20;
      surface = surfaceAt(body.current.x, body.current.z);
      if (
        surface === "road" &&
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
        };
    }
    const d = body.current,
      player = playerRef.current;
    const alpha = accumulator.current / 20,
      old = previous.current;
    player.position.set(
      old.x + (d.x - old.x) * alpha,
      0,
      old.z + (d.z - old.z) * alpha,
    );
    const turn = Math.atan2(
      Math.sin(d.heading - old.heading),
      Math.cos(d.heading - old.heading),
    );
    player.rotation.y = -(old.heading + turn * alpha) - Math.PI / 2;
    speedRef.current = d.vx * Math.cos(d.heading) + d.vz * Math.sin(d.heading);
    inputTurn.current = -d.turn * 0.1;
    driftDirection.current = d.wasDrifting
      ? Math.sign(store.soloControls.steer) * -1.4
      : 0;
    driftPower.current = d.driftMs / 1000;
    if (store.soloControls.drift && !heldDrift.current) hop.current = 250;
    heldDrift.current = store.soloControls.drift;
    hop.current = Math.max(0, hop.current - delta * 1000);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    jumpOffset.current = reduced ? 0 : Math.sin((hop.current / 250) * Math.PI) * 0.5;
    kartRef.current.rotation.y = reduced ? 0 : driftDirection.current * 0.1;
    player.updateMatrixWorld(true);
    camera.position.lerp(
      cameraGroupRef.current.getWorldPosition(target.current),
      1 - Math.exp(-8 * Math.min(delta, 0.1)),
    );
    camera.lookAt(cameraLookAtRef.current.getWorldPosition(look.current));
    useGameStore.setState({
      playerPosition: new Vector3(d.x, 0, d.z),
      speed: speedRef.current,
      isBoosting: d.boostMs > 0,
      soloSurface: surface,
      soloContact: d.contact,
      soloRecoveryReady: elapsed.current - lastRecovery.current >= 2000,
    });
  });
  return (
    <group ref={playerRef}>
      <group ref={cameraGroupRef} position={[0, 2, 5]} />
      <group ref={kartRef}>
        <Kart
          speed={speedRef}
          driftDirection={driftDirection}
          driftPower={driftPower}
          jumpOffset={jumpOffset}
          backWheelOffset={backWheelOffset}
          inputTurn={inputTurn}
        />
        <group ref={cameraLookAtRef} position={[0, -0.5, -9]} />
      </group>
    </group>
  );
};
