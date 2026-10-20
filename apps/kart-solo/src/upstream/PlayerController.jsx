// Adapted from mario-kart-js 0f7a430. See UPSTREAM.md and THIRD_PARTY_NOTICES.md.
import { Kart } from "./models/Kart";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { damp } from "three/src/math/MathUtils.js";
import { kartSettings } from "./constants";
import { useGameStore } from "./store";
import gsap from "gsap";

export const PlayerController = () => {
  const rbRef = useRef(null);
  const playerRef = useRef(null);
  const cameraGroupRef = useRef(null);
  const cameraLookAtRef = useRef(null);
  const kartRef = useRef(null);
  const jumpIsHeld = useRef(false);
  const driftDirections = {
    none: 0,
    left: 1.4,
    right: -1.4,
  };
  const jumpOffset = useRef(0);
  const driftDirection = useRef(driftDirections.none);
  const driftPower = useRef(0);
  const turbo = useRef(0);
  const isJumping = useRef(false);
  const backWheelOffset = useRef({
    left: 0,
    right: 0,
  });
  const gamepadRef = useRef(null);
  const inputTurn = useRef(0);

  const speedRef = useRef(0);
  const rotationSpeedRef = useRef(0);
  const smoothedDirectionRef = useRef(new Vector3(0, 0, -1));

  const setPlayerPosition = useGameStore((state) => state.setPlayerPosition);
  const setIsBoosting = useGameStore((state) => state.setIsBoosting);
  const setSpeed = useGameStore((state) => state.setSpeed);
  const setGamepad = useGameStore((state) => state.setGamepad);

  const isTimeTrial = false;

  const getGamepad = () => {
    if (navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      if (gamepads.length > 0) {
        gamepadRef.current = gamepads[0];
        setGamepad(gamepadRef.current);
      }
    }
  };

  useEffect(
    () => () => {
      gsap.killTweensOf(jumpOffset);
      gsap.killTweensOf(backWheelOffset.current);
    },
    [],
  );

  const jumpAnim = () => {
    gsap.to(jumpOffset, {
      current: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.3,
      duration: 0.125,
      ease: "power2.out",
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        isJumping.current = false;
      },
    });
  };

  function updateSpeed(forward, backward, delta) {
    // Apply time trial speed factor if in time trial mode
    const isTimeTrialMode = false;
    const speedFactor = isTimeTrialMode
      ? kartSettings.timeTrialSpeedFactor || 1.5
      : 1.0;

    // Adjust max speed for time trial mode
    const baseMaxSpeed = kartSettings.speed.max;
    const maxSpeed = baseMaxSpeed * speedFactor + (turbo.current > 0 ? 40 : 0);

    maxSpeed > baseMaxSpeed ? setIsBoosting(true) : setIsBoosting(false);

    const gamepadButtons = {
      forward: false,
      backward: false,
    };

    if (gamepadRef.current) {
      gamepadButtons.forward = gamepadRef.current.buttons[0]?.pressed;
      gamepadButtons.backward = gamepadRef.current.buttons[1]?.pressed;
    }
    const forwardAccel = Number(forward || gamepadButtons.forward);

    // Make the damping more responsive in time trial mode
    const dampingFactor = isTimeTrialMode ? 2.5 : 1.5;

    speedRef.current = damp(
      speedRef.current,
      maxSpeed * forwardAccel +
        kartSettings.speed.min * Number(backward || gamepadButtons.backward),
      dampingFactor,
      delta,
    );
    setSpeed(speedRef.current);
    if (speedRef.current < 20) {
      driftDirection.current = driftDirections.none;
      driftPower.current = 0;
    }
    turbo.current -= delta;
  }

  function rotatePlayer(left, right, player, joystickX, delta) {
    // Apply time trial mode handling adjustments
    const isTimeTrialMode = false;
    const handlingFactor = isTimeTrialMode ? 1.5 : 1.0;

    const gamepadJoystick = {
      x: 0,
    };

    if (gamepadRef.current) {
      gamepadJoystick.x = gamepadRef.current.axes[0];
    }

    // Make turning more responsive in time trial mode
    const turnSensitivity = isTimeTrialMode ? 0.15 : 0.1;

    inputTurn.current =
      (-gamepadJoystick.x -
        joystickX +
        (Number(left) - Number(right)) +
        driftDirection.current) *
      turnSensitivity;

    // Faster rotation response in time trial mode
    const rotationDampFactor = isTimeTrialMode ? 6 : 4;

    rotationSpeedRef.current = damp(
      rotationSpeedRef.current,
      inputTurn.current,
      rotationDampFactor,
      delta,
    );

    const targetRotation =
      player.rotation.y +
      ((rotationSpeedRef.current * (speedRef.current > 40 ? 40 : speedRef.current)) /
        kartSettings.speed.max) *
        handlingFactor;

    // More responsive rotation damping in time trial mode
    const finalDampFactor = isTimeTrialMode ? 12 : 8;
    player.rotation.y = damp(player.rotation.y, targetRotation, finalDampFactor, delta);
  }

  function jumpPlayer(spaceKey, left, right, joystickX) {
    if (spaceKey && !jumpIsHeld.current && !isJumping.current) {
      // rb.applyImpulse({ x: 0, y: 45, z: 0 }, true);

      jumpAnim();
      isJumping.current = true;
      jumpIsHeld.current = true;
      driftDirection.current =
        left || joystickX < 0
          ? driftDirections.left
          : right || joystickX > 0
            ? driftDirections.right
            : driftDirections.none;
    }

    if (!spaceKey) {
      jumpIsHeld.current = false;
      if (turbo.current <= 0) {
        turbo.current = useGameStore.getState().boostPower
          ? useGameStore.getState().boostPower
          : 0;
      }
      driftDirection.current = driftDirections.none;
      driftPower.current = 0;
    }
  }

  function driftPlayer(delta) {
    if (driftDirection.current !== driftDirections.none) {
      driftPower.current += delta;
    }
  }

  function updatePlayer(player, speed, camera, kart, delta) {
    // Apply time trial specific adjustments
    const isTimeTrialMode = false;
    const movementFactor = isTimeTrialMode ? 1.5 : 1.0;

    const desiredDirection = new Vector3(
      -Math.sin(player.rotation.y),
      0,
      -Math.cos(player.rotation.y),
    );

    // More responsive direction change in time trial mode
    const directionLerpFactor = isTimeTrialMode ? 18 : 12;
    smoothedDirectionRef.current.lerp(
      desiredDirection,
      Math.min(1, directionLerpFactor * delta),
    );
    const dir = smoothedDirectionRef.current;

    const angle = Math.atan2(
      desiredDirection.x * dir.z - desiredDirection.z * dir.x,
      desiredDirection.x * dir.x + desiredDirection.z * dir.z,
    );

    // More responsive kart rotation in time trial mode
    const kartRotationDampFactor = isTimeTrialMode ? 9 : 6;
    kart.rotation.y = damp(
      kart.rotation.y,
      angle * 1.3 + driftDirection.current * 0.1,
      kartRotationDampFactor,
      delta,
    );

    // Camera responsiveness in time trial mode
    const cameraLerpFactor = isTimeTrialMode ? 12 : 8;
    camera.lookAt(cameraLookAtRef.current.getWorldPosition(new Vector3()));
    camera.position.lerp(
      cameraGroupRef.current.getWorldPosition(new Vector3()),
      Math.min(1, cameraLerpFactor * delta),
    );

    // const body = useGameStore.getState().body;
    // if(body){
    //   cameraGroupRef.current.position.y = lerp(cameraGroupRef.current.position.y, body.position.y + 2, 8 * delta);
    //   cameraLookAtRef.current.position.y = body.position.y;
    // }
    const direction = smoothedDirectionRef.current;

    // Apply time trial movement factor to player position updates
    player.position.x += direction.x * speed * delta * movementFactor;
    player.position.z += direction.z * speed * delta * movementFactor;

    setPlayerPosition(player.position);
  }

  useFrame((state, delta) => {
    if (useGameStore.getState().soloPaused || !useGameStore.getState().soloStarted)
      return;
    if (!playerRef.current && !rbRef.current) return;
    const player = playerRef.current;
    const cameraGroup = cameraGroupRef.current;
    const kart = kartRef.current;
    const camera = state.camera;

    if (!player || !cameraGroup || !kart) return;

    // Get time trial status from the game manager
    const isTimeTrial = false;

    // Use a smaller delta cap for time trial mode to ensure fast responses
    // This ensures physics updates are more consistent and responsive
    const maxDelta = isTimeTrial ? 0.05 : 0.1;
    const cappedDelta = Math.min(delta, maxDelta);

    const controls = useGameStore.getState().soloControls;
    const joystick = { x: controls.steer };
    const jumpButtonPressed = controls.drift;

    const { gas: forward, brake: backward } = controls;
    const left = false,
      right = false,
      jump = false;

    const gamepadButtons = {
      jump: false,
      x: 0,
    };

    if (gamepadRef.current) {
      gamepadButtons.jump =
        gamepadRef.current.buttons[5]?.pressed ||
        gamepadRef.current.buttons[7]?.pressed;
      gamepadButtons.x = gamepadRef.current.axes[0];
    }
    updateSpeed(forward, backward, cappedDelta);
    rotatePlayer(left, right, player, joystick.x, cappedDelta);
    updatePlayer(player, speedRef.current, camera, kart, cappedDelta);
    const isJumpPressed = jumpButtonPressed || jump || gamepadButtons.jump;
    jumpPlayer(isJumpPressed, left, right, joystick.x || gamepadButtons.x);
    driftPlayer(cappedDelta);
    getGamepad();
  });

  return (
    <>
      <group></group>
      <group ref={playerRef}>
        <group ref={cameraGroupRef} position={[0, 2, 5]}></group>

        <group ref={kartRef}>
          <Kart
            speed={speedRef}
            driftDirection={driftDirection}
            driftPower={driftPower}
            jumpOffset={jumpOffset}
            backWheelOffset={backWheelOffset}
            inputTurn={inputTurn}
          />

          <group ref={cameraLookAtRef} position={[0, -2, -9]}></group>
        </group>
      </group>

      {/* <OrbitControls/> */}
    </>
  );
};
