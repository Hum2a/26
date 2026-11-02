import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { playingFixture } from "../admin/controls.test-support";
import { roomFixture } from "../admin/room-fixture.test-support";
import { PhoneTimer } from "./phone-timer";

it("shows the room's clock while answering", () => {
  const now = Date.now();
  render(
    <PhoneTimer
      snapshot={{ ...playingFixture, deadlineAt: now + 20_000, serverNow: now }}
      observedAt={now}
    />,
  );
  expect(screen.getByRole("timer").getAttribute("aria-label")).toMatch(
    /^Time left: 0:(19|20)$/,
  );
});

it("says when the game is paused and stays out of the lobby", () => {
  const view = render(
    <PhoneTimer
      snapshot={{
        ...playingFixture,
        paused: true,
        remainingMs: 9_000,
        deadlineAt: null,
      }}
      observedAt={Date.now()}
    />,
  );
  expect(screen.getByRole("timer").textContent).toContain("Paused");
  view.rerender(<PhoneTimer snapshot={roomFixture} observedAt={Date.now()} />);
  expect(screen.queryByRole("timer")).toBeNull();
});
