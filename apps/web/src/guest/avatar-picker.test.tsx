import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../photo/CaptureFlow", () => ({
  CaptureFlow: ({ facing, square }: { facing?: string; square?: boolean }) => (
    <p>
      Camera {facing} {square ? "square" : ""}
    </p>
  ),
}));
import { AvatarPicker } from "./avatar-picker";
import { avatarPromptSkipped, skipAvatarPrompt } from "./avatar-prompt";

const playerId = "00000000-0000-4000-8000-000000000001";
const photo = "00000000-0000-4000-8000-0000000000f1";

beforeEach(() => {
  window.sessionStorage.clear();
});

function draw(props: Partial<Parameters<typeof AvatarPicker>[0]> = {}) {
  const onChoose = vi.fn();
  const onSkip = vi.fn();
  render(
    <AvatarPicker
      gameId="ABCDEFGH"
      playerId={playerId}
      nickname="Amina"
      avatarMediaId={undefined}
      pending={false}
      onChoose={onChoose}
      onSkip={onSkip}
      {...props}
    />,
  );
  return { onChoose, onSkip };
}

it("invites a selfie on the front camera with a square crop, or a later skip", () => {
  const { onSkip } = draw();
  expect(screen.getByRole("heading", { name: "Add your face" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(onSkip).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Take a selfie" }));
  expect(screen.getByText(/Camera user square/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close camera" })).toBeTruthy();
});

it("shows the saved photo and removes it through the room", () => {
  const { onChoose } = draw({ avatarMediaId: photo });
  expect(screen.getByRole("heading", { name: "Your photo" })).toBeTruthy();
  expect(document.querySelector("img")?.getAttribute("src")).toContain(photo);
  fireEvent.click(screen.getByRole("button", { name: "Remove my photo" }));
  expect(onChoose).toHaveBeenCalledWith(null);
});

it("says it is saving, and holds the buttons, until the room acknowledges", () => {
  draw({ avatarMediaId: photo, pending: true });
  expect(screen.getByRole("status").textContent).toBe("Saving your photo…");
  expect(
    (screen.getByRole("button", { name: "Remove my photo" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("remembers a skipped prompt for this game only", () => {
  expect(avatarPromptSkipped("ABCDEFGH")).toBe(false);
  skipAvatarPrompt("abcdefgh");
  expect(avatarPromptSkipped("ABCDEFGH")).toBe(true);
  expect(avatarPromptSkipped("OTHERONE")).toBe(false);
});
