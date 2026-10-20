import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { KartRaceView } from "@26/shared";

/** WebGL is lazy-loaded by the stage only. Phones use the SVG HUD by default. */
export default function KartCanvas({
  race,
  mobile,
  reducedMotion,
}: {
  race: KartRaceView;
  mobile: boolean;
  reducedMotion: boolean;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const live = useRef(race),
    reduced = useRef(reducedMotion);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    live.current = race;
    reduced.current = reducedMotion;
  }, [race, reducedMotion]);
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
      const unavailable = document.createElement("p");
      unavailable.setAttribute("role", "status");
      unavailable.textContent =
        "WebGL is unavailable. Race timing and the leaderboard continue; try another stage browser for the circuit.";
      root.append(unavailable);
      return () => unavailable.remove();
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
    renderer.shadowMap.enabled = false;
    root.append(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Live kart circuit");
    const scene = new THREE.Scene();
    const colour = (role: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--${role})`;
      root.append(probe);
      const result = getComputedStyle(probe).color;
      probe.remove();
      return new THREE.Color(result);
    };
    const ground = colour("background"),
      road = colour("surface"),
      accent = colour("accent"),
      highlight = colour("highlight"),
      ink = colour("foreground"),
      muted = colour("muted");
    scene.background = ground;
    const camera = new THREE.OrthographicCamera(-64, 64, 64, -64, 0.1, 500);
    camera.position.set(0, 105, 70);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(ink, ground, 2));
    const sun = new THREE.DirectionalLight(ink, 2);
    sun.position.set(25, 70, 10);
    scene.add(sun);
    const material = (color: THREE.Color) => new THREE.MeshLambertMaterial({ color });
    const roadMesh = new THREE.Mesh(
      new THREE.RingGeometry(34, 50, mobile ? 64 : 96),
      material(road),
    );
    roadMesh.rotation.x = -Math.PI / 2;
    scene.add(roadMesh);
    const curbMat = material(accent),
      curbGeo = new THREE.BoxGeometry(3, 0.5, 1);
    for (let i = 0; i < 64; i++)
      for (const radius of [33.5, 50.5]) {
        const a = (i * Math.PI) / 32,
          curb = new THREE.Mesh(curbGeo, i % 2 ? material(ink) : curbMat);
        curb.position.set(Math.cos(a) * radius, 0.15, Math.sin(a) * radius);
        curb.rotation.y = -a + Math.PI / 2;
        scene.add(curb);
      }
    const checkGeometry = new THREE.BoxGeometry(2, 0.12, 1);
    const lightMat = material(ink),
      darkMat = material(ground);
    for (let x = 0; x < 8; x++)
      for (let z = 0; z < 2; z++) {
        const square = new THREE.Mesh(checkGeometry, (x + z) % 2 ? lightMat : darkMat);
        square.position.set(35 + x * 2, 0.1, z - 0.5);
        scene.add(square);
      }
    const poleGeometry = new THREE.CylinderGeometry(0.25, 0.25, 5, 6),
      poleMat = material(highlight);
    for (const x of [33, 51]) {
      const pole = new THREE.Mesh(poleGeometry, poleMat);
      pole.position.set(x, 2.5, 0);
      scene.add(pole);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(18, 1.5, 0.5), poleMat);
    banner.position.set(42, 5, 0);
    scene.add(banner);
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(29, 29, 1, 48),
      material(muted),
    );
    island.position.y = -0.6;
    scene.add(island);
    // Static direction markers, no decorative particles, bloom, post-processing or shadow maps.
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 2);
    arrowShape.lineTo(-1.5, -1);
    arrowShape.lineTo(1.5, -1);
    arrowShape.closePath();
    const arrowGeo = new THREE.ShapeGeometry(arrowShape),
      arrowMat = new THREE.MeshBasicMaterial({
        color: highlight,
        side: THREE.DoubleSide,
      });
    for (let i = 1; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.rotation.x = -Math.PI / 2;
      arrow.rotation.z = Math.PI - a;
      arrow.position.set(Math.cos(a) * 42, 0.12, Math.sin(a) * 42);
      scene.add(arrow);
    }
    const cars = new Map<string, { group: THREE.Group; number: THREE.Sprite }>();
    const textures: THREE.Texture[] = [];
    const bodyGeo = new THREE.BoxGeometry(2.8, 0.7, 1.5),
      wheelGeo = new THREE.BoxGeometry(0.7, 0.65, 0.35),
      seatGeo = new THREE.BoxGeometry(0.7, 0.9, 0.6);
    const wheelMat = material(ground),
      seatMat = material(ink);
    function addCar(driver: KartRaceView["participants"][number]) {
      const group = new THREE.Group(),
        body = new THREE.Mesh(
          bodyGeo,
          material(driver.number % 2 ? accent : highlight),
        );
      body.position.y = 0.6;
      group.add(body);
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.set(-0.3, 1, 0.0);
      group.add(seat);
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 12, 8),
        material(highlight),
      );
      helmet.position.set(-0.3, 1.65, 0);
      group.add(helmet);
      for (const x of [-0.7, 0.7])
        for (const z of [-0.75, 0.75]) {
          const wheel = new THREE.Mesh(wheelGeo, wheelMat);
          wheel.position.set(x, 0.4, z);
          group.add(wheel);
        }
      group.position.set(driver.x, 0, driver.z);
      group.rotation.y = -driver.heading;
      scene.add(group);
      const label = document.createElement("canvas");
      label.width = 64;
      label.height = 64;
      const ctx = label.getContext("2d")!;
      ctx.fillStyle = `#${ground.getHexString()}`;
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `#${ink.getHexString()}`;
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(driver.number), 32, 34);
      const texture = new THREE.CanvasTexture(label);
      textures.push(texture);
      const number = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false }),
      );
      number.scale.set(5, 5, 1);
      number.position.set(driver.x, 3.5, driver.z);
      scene.add(number);
      cars.set(driver.playerId, { group, number });
    }
    const resize = new ResizeObserver(() => {
      const width = Math.max(1, root.clientWidth),
        height = Math.max(1, root.clientHeight),
        aspect = width / height;
      renderer.setSize(width, height, false);
      camera.left = -64 * Math.max(1, aspect);
      camera.right = -camera.left;
      camera.top = 64 * Math.max(1, 1 / aspect);
      camera.bottom = -camera.top;
      camera.updateProjectionMatrix();
    });
    resize.observe(root);
    const contextLost = (event: Event) => {
      event.preventDefault();
      renderer.setAnimationLoop(null);
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    const targetPosition = new THREE.Vector3();
    renderer.setAnimationLoop(() => {
      for (const driver of live.current.participants) {
        if (!cars.has(driver.playerId)) addCar(driver);
        const car = cars.get(driver.playerId)!;
        const alpha = reduced.current ? 1 : 0.25;
        car.group.position.lerp(targetPosition.set(driver.x, 0, driver.z), alpha);
        // Position interpolation is visual only. Never run physics or finish detection on the stage.
        car.group.rotation.y = -driver.heading;
        car.number.position.set(car.group.position.x, 3.5, car.group.position.z);
      }
      renderer.render(scene, camera);
    });
    return () => {
      resize.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          for (const m of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(m);
        }
        if (object instanceof THREE.Sprite) materials.add(object.material);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mobile, race.raceId]);
  return (
    <div ref={mount} style={{ width: "100%", height: "100%" }}>
      {failed ? (
        <p role="status">
          WebGL is unavailable. Race timing and the leaderboard continue; try another
          stage browser for the circuit.
        </p>
      ) : null}
    </div>
  );
}
