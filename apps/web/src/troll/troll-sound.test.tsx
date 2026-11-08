import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShatteredScreen } from "./classic-trolls";
import { NetanyahuFlood } from "./screen-trolls";
import { useTrollSoundUnlock } from "./troll-sound";

describe("Netanyahu troll", () => {
  it("floods the phone with his face and plays the clip until it ends", () => {
    const sound = { playUrl: vi.fn(async () => true), stop: vi.fn() };
    const view = render(<NetanyahuFlood label="Benjamin Netanyahu" sound={sound} />);
    const faces = document.querySelectorAll("img.troll-flood-face");
    expect(faces.length).toBeGreaterThan(10);
    expect(faces[0]?.getAttribute("src")).toBe("/assets/netanyahu.webp");
    expect(sound.playUrl).toHaveBeenCalledWith("/assets/netanyahu.mp3");
    expect(sound.stop).not.toHaveBeenCalled();
    view.unmount();
    expect(sound.stop).toHaveBeenCalledTimes(1);
  });
});

describe("cracked screen", () => {
  it("plays the glass smash as the screen cracks and stops it when cleared", () => {
    const sound = { playUrl: vi.fn(async () => true), stop: vi.fn() };
    const view = render(
      <ShatteredScreen
        label="Shattered screen"
        seed={7}
        escape="Dismiss"
        sound={sound}
      />,
    );
    expect(sound.playUrl).toHaveBeenCalledWith("/assets/glass-crack.mp3");
    view.unmount();
    expect(sound.stop).toHaveBeenCalledTimes(1);
  });
});

function Unlocker({ sound }: { sound: { unlock(): boolean } }) {
  useTrollSoundUnlock(sound);
  return null;
}

describe("troll sound unlock", () => {
  it("unlocks on a tap or key press, and stops listening when unmounted", () => {
    const sound = { unlock: vi.fn(() => true) };
    const view = render(<Unlocker sound={sound} />);
    expect(sound.unlock).not.toHaveBeenCalled();
    fireEvent.pointerDown(window);
    fireEvent.keyDown(window, { key: "a" });
    expect(sound.unlock).toHaveBeenCalledTimes(2);
    view.unmount();
    fireEvent.pointerDown(window);
    expect(sound.unlock).toHaveBeenCalledTimes(2);
  });
});
