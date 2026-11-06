import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { importedWalls, ringWalls } from "@26/shared";
import { KartCollisionBench, KartCollisionOverlay } from "./kart-collision-overlay";

it("draws the exact baked solver segments, named accepted history and local eased switches", async () => {
  const view = render(
    <KartCollisionOverlay
      trackId="mario-circuit-v1"
      history={[
        {
          eventId: 2001,
          atMs: 20,
          kind: "impact",
          number: 1,
          playerId: "a",
          x: 4,
          z: 5,
          speed: 10,
        },
      ]}
      names={{ a: "Amina" }}
    />,
  );
  const path = view.container.querySelector('[data-layer="walls"]')!;
  expect(path.getAttribute("data-segments")).toBe(String(importedWalls.length));
  expect(path.getAttribute("d")).toBe(
    importedWalls
      .map((wall) => `M${wall.ax},${wall.az}L${wall.bx},${wall.bz}`)
      .join(""),
  );
  expect(screen.getByRole("listitem").textContent).toContain(
    "Kart 1 · Amina · Barrier impact · 0.02s · 36km/h",
  );
  fireEvent.click(screen.getByLabelText("Show collision boundaries"));
  await waitFor(() => expect((path as HTMLElement).style.opacity).toBe("0"));
  expect(view.container.querySelector("circle")?.getAttribute("cx")).toBe("4");
  fireEvent.click(screen.getByLabelText("Show accepted impacts and recoveries"));
  await waitFor(() => expect(view.container.querySelector("circle")).toBeNull());
});

it("rehearses real swept contacts on both actual courses without a room", async () => {
  const view = render(<KartCollisionBench />);
  const history = screen.getByRole("list", {
    name: "Recent kart contacts and recoveries",
  });
  fireEvent.click(screen.getByRole("button", { name: "Rehearse a swept wall impact" }));
  expect(within(history).getAllByRole("listitem")).toHaveLength(1);
  expect(history.textContent).toContain("Stand-in driver");
  fireEvent.change(screen.getByLabelText("Rehearsal course"), {
    target: { value: "party-ring-v1" },
  });
  await waitFor(() =>
    expect(screen.queryByLabelText("Collision handling result")).toBeNull(),
  );
  expect(
    view.container.querySelector('[data-layer="walls"]')?.getAttribute("data-segments"),
  ).toBe(String(ringWalls.length));
  fireEvent.click(screen.getByRole("button", { name: "Rehearse a swept wall impact" }));
  expect(
    screen.getByText(
      "Stand-in attempts: 1. The real solver decides whether a contact occurred.",
    ),
  ).toBeTruthy();
  expect(
    within(
      screen.getByRole("list", { name: "Recent kart contacts and recoveries" }),
    ).getAllByRole("listitem"),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Clear collision rehearsal" }));
  await waitFor(() =>
    expect(
      screen.getByRole("list", { name: "Recent kart contacts and recoveries" })
        .children,
    ).toHaveLength(0),
  );
});

it("rehearses both actual handling profiles and reports a bounded rebound/stun", async () => {
  render(<KartCollisionBench />);
  fireEvent.change(screen.getByLabelText("Rehearsal course"), {
    target: { value: "party-ring-v1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Rehearse a swept wall impact" }));
  expect(screen.getByLabelText("Collision handling result").textContent).toContain(
    "Stun 0ms · Cooldown 0ms",
  );
  fireEvent.change(screen.getByLabelText("Rehearsal handling"), {
    target: { value: "bounce-v1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Rehearse a swept wall impact" }));
  await screen.findByText(
    /Arcade bounce · Rebounded from the wall · Stun 180ms · Cooldown 600ms/,
  );
  fireEvent.change(screen.getByLabelText("Rehearsal handling"), {
    target: { value: "slide-v1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Rehearse a swept wall impact" }));
  await screen.findByText(/Original slide · Slid along the wall · Stun 0ms/);
});
