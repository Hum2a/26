import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createKartRace, projectKartRace } from "@26/shared";
import KartGameWrapper from "./KartGameWrapper";
vi.mock("./KartCanvas", () => ({
  default: ({
    followPlayerId,
    spectator,
    vfxPreset,
    paused,
  }: {
    followPlayerId?: string;
    spectator?: boolean;
    vfxPreset?: { enabled: boolean };
    paused?: boolean;
  }) => (
    <div
      data-testid="stage-renderer"
      data-follow={followPlayerId}
      data-spectator={String(spectator)}
      data-effects={vfxPreset === undefined ? "legacy" : String(vfxPreset.enabled)}
      data-paused={String(paused)}
    >
      Real canvas adapter boundary
    </div>
  ),
}));
afterEach(() => vi.restoreAllMocks());
const fullRoom = () =>
  projectKartRace(
    createKartRace(
      "fifty",
      Array.from({ length: 50 }, (_, i) => ({
        playerId: "p" + i,
        name: "Driver " + (i + 1),
      })),
    ),
    null,
    100,
  );
it("passes the public effects switch and accepted pause to the stage renderer without diagnostics", async () => {
  const race = fullRoom();
  race.spectator = { mode: "overview", revision: 1 };
  const view = render(<KartGameWrapper race={race} />);
  const canvas = await screen.findByTestId("stage-renderer");
  expect(canvas.getAttribute("data-effects")).toBe("legacy");
  view.rerender(<KartGameWrapper race={{ ...race, effectsEnabled: true }} paused />);
  expect(canvas.getAttribute("data-effects")).toBe("true");
  expect(canvas.getAttribute("data-paused")).toBe("true");
  view.rerender(<KartGameWrapper race={{ ...race, effectsEnabled: false }} />);
  expect(canvas.getAttribute("data-effects")).toBe("false");
});

it("opts into server-selected 3D, returns to the whole map immediately and honours a later host selection", async () => {
  const race = fullRoom();
  race.spectator = { mode: "follow", followPlayerId: "p17", revision: 1 };
  const view = render(<KartGameWrapper race={race} />);
  const renderer = await screen.findByTestId("stage-renderer");
  expect(renderer.getAttribute("data-follow")).toBe("p17");
  expect(renderer.getAttribute("data-spectator")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Return to full-field map" }));
  expect(screen.queryByTestId("stage-renderer")).toBeNull();
  expect(document.querySelectorAll("[data-map-player]")).toHaveLength(50);
  view.rerender(
    <KartGameWrapper
      race={{ ...race, spectator: { ...race.spectator, revision: 2 } }}
    />,
  );
  await screen.findByTestId("stage-renderer");
  view.rerender(
    <KartGameWrapper race={{ ...race, spectator: { mode: "map", revision: 3 } }} />,
  );
  expect(screen.queryByTestId("stage-renderer")).toBeNull();
});
it("shows all 50 positions without overlapping labels or a WebGL dependency", () => {
  render(<KartGameWrapper race={fullRoom()} />);
  const map = screen.getByRole("img", { name: "Live race map: 50 drivers" });
  expect(map.querySelectorAll("[data-map-player]")).toHaveLength(50);
  expect(map.querySelectorAll(".kart-map-number")).toHaveLength(3);
  expect(document.querySelector("canvas")).toBeNull();
  expect(screen.getByText(/0 finished/)).toBeTruthy();
});
it("shows ten leaders and makes every driver reachable in pages of ten", () => {
  render(<KartGameWrapper race={fullRoom()} paused />);
  const seen = new Set<string>();
  for (let page = 0; page < 5; page++) {
    const list = screen.getByRole("list", { name: "Race leaders" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    for (let i = page * 10 + 1; i <= page * 10 + 10; i++) {
      expect(within(list).getByText("Driver " + i, { exact: true })).toBeTruthy();
      seen.add("Driver " + i);
    }
    if (page < 4) fireEvent.click(screen.getByRole("button", { name: "Next players" }));
  }
  expect(seen.size).toBe(50);
  expect(
    screen.getByRole("button", { name: "Next players" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Back to leaders" }));
  expect(screen.getByText("1–10 of 50")).toBeTruthy();
});
it("keeps the chosen page stable while racing and allows browsing while paused", () => {
  const interval = vi.spyOn(window, "setInterval");
  const view = render(<KartGameWrapper race={fullRoom()} />);
  expect(interval.mock.calls.some((call) => call[1] === 4000)).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Next players" }));
  view.rerender(<KartGameWrapper race={fullRoom()} paused />);
  expect(screen.getByText("11–20 of 50")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Previous players" }));
  expect(screen.getByText("1–10 of 50")).toBeTruthy();
});
