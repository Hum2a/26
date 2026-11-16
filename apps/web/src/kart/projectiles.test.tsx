import { render, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { KartProjectileLayer } from "./KartProjectileLayer";
import { createKartRace, projectKartRace } from "@26/shared";
import { KartMap } from "./KartMap";
it("places live imported-course projectiles in the same coordinates as the map", () => {
  const race = projectKartRace(
    createKartRace("items", [], {
      trackId: "mario-circuit-v1",
      itemRules: { version: 2, allowed: ["tennis"] },
    }),
    null,
    0,
  );
  if (race.presentation?.version !== 3)
    throw new Error("Expanded presentation required");
  race.presentation.items.projectiles = [
    { id: "projectile-1", kind: "tennis", x: 180, z: 10, height: 0, createdAt: 0 },
  ];
  const view = render(<KartMap race={race} />);
  const style =
    view.container.querySelector('[data-projectile="tennis"]')?.getAttribute("style") ??
    "";
  expect(Number(style.match(/translateX\(([-\d.]+)px\)/)?.[1])).toBeCloseTo(10.2);
  expect(Number(style.match(/translateY\(([-\d.]+)px\)/)?.[1])).toBeCloseTo(3.4);
});
it("renders bounded original poses/fuse without reading private owner/target history", async () => {
  const item = {
    id: "one",
    kind: "bomb" as const,
    x: 0,
    z: 0,
    height: 0.7,
    createdAt: 0,
    owner: "private-owner",
    targetId: "private-target",
    hitPlayers: ["private-hit"],
  };
  const view = render(
    <svg>
      <KartProjectileLayer projectiles={[item]} elapsedMs={1000} />
    </svg>,
  );
  expect(view.container.querySelector("title")?.textContent).toContain("0.5 seconds");
  expect(view.container.innerHTML).not.toContain("private-");
  view.rerender(
    <svg>
      <KartProjectileLayer
        projectiles={Array.from({ length: 70 }, (_, i) => ({ ...item, id: String(i) }))}
        elapsedMs={1000}
      />
    </svg>,
  );
  await waitFor(() =>
    expect(view.container.querySelectorAll("[data-projectile]")).toHaveLength(64),
  );
});
