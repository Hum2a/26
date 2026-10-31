import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { roomFixture } from "../admin/room-fixture.test-support";
import { GuestTrolls } from "./guest-troll";

it("keeps screen escape controls outside the phone scroll and removes them with the effect", () => {
  const effectId = "00000000-0000-4000-8000-000000000026";
  const onEscape = vi.fn();
  const snapshot = {
    ...roomFixture,
    trolls: {
      ...roomFixture.trolls,
      active: [
        {
          effectId,
          kind: "crack" as const,
          role: "target" as const,
          status: "active" as const,
          expiresAt: null,
          label: "Cracked screen",
          assetLabel: "Shattered screen",
          escape: "Dismiss",
        },
      ],
    },
  };
  const view = render(
    <main className="phone-scroll">
      <GuestTrolls
        snapshot={snapshot}
        gameId={snapshot.gameId}
        selfId="self"
        pending={false}
        onSend={vi.fn()}
        onEscape={onEscape}
      />
    </main>,
  );
  const overlay = screen.getByRole("status", { name: "Shattered screen" });
  expect(overlay.parentElement).toBe(document.body);
  expect(overlay.closest(".phone-scroll")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(onEscape).toHaveBeenCalledWith(effectId);
  view.unmount();
  expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
});
