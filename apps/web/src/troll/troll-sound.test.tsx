import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayerResult } from "../device/audio";
import { CallFromMum, ShatteredScreen } from "./classic-trolls";
import { AirDropSpam, LowBattery } from "./chrome-trolls";
import { FakeExit, FakeLastPlace } from "./identity-trolls";
import { NetanyahuFlood, ScreenTroll } from "./screen-trolls";
import { trollAssets } from "./troll-assets";
import { TrollSoundContext, useTrollLayer, useTrollSoundUnlock } from "./troll-sound";

function fakeSound(layer: (url: string) => LayerResult = () => "played") {
  return {
    playUrl: vi.fn<(url: string) => Promise<boolean>>(async () => true),
    layerUrl: vi.fn(async (url: string) => layer(url)),
    stop: vi.fn(),
  };
}

function withSound(sound: ReturnType<typeof fakeSound>, ui: ReactNode) {
  return render(
    <TrollSoundContext.Provider value={sound}>{ui}</TrollSoundContext.Provider>,
  );
}

const played = (sound: ReturnType<typeof fakeSound>) =>
  sound.playUrl.mock.calls.map(([url]) => url);
const layered = (sound: ReturnType<typeof fakeSound>) =>
  sound.layerUrl.mock.calls.map(([url]) => url);

afterEach(() => {
  vi.useRealTimers();
});

describe("one-shot troll sounds", () => {
  it("floods the phone with Netanyahu's face and plays the clip until it ends", () => {
    const sound = fakeSound();
    const view = withSound(sound, <NetanyahuFlood label="Benjamin Netanyahu" />);
    const faces = document.querySelectorAll("img.troll-flood-face");
    expect(faces.length).toBeGreaterThan(10);
    expect(faces[0]?.getAttribute("src")).toBe("/assets/netanyahu.webp");
    expect(played(sound)).toEqual(["/assets/netanyahu.mp3"]);
    expect(sound.stop).not.toHaveBeenCalled();
    view.unmount();
    expect(sound.stop).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "the glass smash as the screen cracks",
      <ShatteredScreen key="crack" label="Crack" seed={7} escape="Dismiss" />,
      trollAssets.glassCrack,
    ],
    [
      "the party horn as the confetti fires",
      <ScreenTroll key="confetti" kind="confetti" label="Confetti" escape={null} />,
      trollAssets.partyHorn,
    ],
    [
      "the error blip as the fake crash appears",
      <ScreenTroll key="crash" kind="fake-crash" label="Crash" escape={null} />,
      trollAssets.crashError,
    ],
    [
      "the chirp as the battery warning appears",
      <LowBattery key="battery" label="Battery" escape="Close" />,
      trollAssets.batteryChirp,
    ],
    [
      "the door slam as the fake exit appears",
      <FakeExit key="exit" label="Exit" />,
      trollAssets.doorSlam,
    ],
  ])("plays %s, once, and stops it when the gag ends", (_name, ui, url) => {
    const sound = fakeSound();
    const view = withSound(sound, ui);
    expect(played(sound)).toEqual([url]);
    view.unmount();
    expect(sound.stop).toHaveBeenCalled();
  });

  it("plays the sad trombone when the LAST row lands, not before", () => {
    vi.useFakeTimers();
    const sound = fakeSound();
    const view = withSound(
      sound,
      <FakeLastPlace label="Last" others={["Amina", "Bilal", "Chen"]} />,
    );
    expect(sound.playUrl).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(played(sound)).toEqual([trollAssets.sadTrombone]);
    view.unmount();
    expect(sound.stop).toHaveBeenCalled();
  });

  it("drops a pending trombone if the gag ends before the reveal", () => {
    vi.useFakeTimers();
    const sound = fakeSound();
    const view = withSound(sound, <FakeLastPlace label="Last" others={["Amina"]} />);
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(sound.playUrl).not.toHaveBeenCalled();
  });
});

describe("call from Mum", () => {
  it("shows the stand-in Mum photo and rings until answered, then plays the voice once", () => {
    const sound = fakeSound();
    const view = withSound(sound, <CallFromMum label="Call" escape="Decline" />);
    expect(document.querySelector("img.troll-call-photo")?.getAttribute("src")).toBe(
      trollAssets.mumPhoto,
    );
    expect(played(sound)).toEqual([trollAssets.mumRingtone]);
    const stopsBeforeAnswer = sound.stop.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(sound.stop.mock.calls.length).toBe(stopsBeforeAnswer + 1);
    expect(played(sound)).toEqual([trollAssets.mumRingtone, trollAssets.mumVoice]);
    view.rerender(
      <TrollSoundContext.Provider value={sound}>
        <CallFromMum label="Call" escape="Decline" />
      </TrollSoundContext.Provider>,
    );
    expect(played(sound)).toEqual([trollAssets.mumRingtone, trollAssets.mumVoice]);
    view.unmount();
    expect(sound.stop.mock.calls.length).toBe(stopsBeforeAnswer + 2);
  });

  it("stops the ringtone when declined", () => {
    const sound = fakeSound();
    const onEscape = vi.fn();
    const view = withSound(
      sound,
      <CallFromMum label="Call" escape="Decline" onEscape={onEscape} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onEscape).toHaveBeenCalledTimes(1);
    // The room ends the troll, which unmounts the call.
    view.unmount();
    expect(sound.stop).toHaveBeenCalledTimes(1);
    expect(played(sound)).toEqual([trollAssets.mumRingtone]);
  });

  it("falls back to the letter M when the photo is missing", () => {
    withSound(fakeSound(), <CallFromMum label="Call" escape="Decline" />);
    const photo = document.querySelector("img.troll-call-photo");
    if (!photo) throw new Error("The photo is missing.");
    fireEvent.error(photo);
    expect(document.querySelector("img.troll-call-photo")).toBeNull();
    expect(document.querySelector(".troll-call-avatar")?.textContent).toBe("M");
  });
});

describe("repeated troll sounds", () => {
  it("pops on every bubble pressed", () => {
    const sound = fakeSound();
    withSound(
      sound,
      <ScreenTroll kind="bubble-wrap" label="Pop" escape="Pop them all" />,
    );
    const bubbles = screen.getAllByRole("button", { name: "Pop bubble" });
    fireEvent.click(bubbles[0]!);
    fireEvent.click(bubbles[1]!);
    fireEvent.click(bubbles[2]!);
    expect(layered(sound)).toEqual([
      trollAssets.bubblePop,
      trollAssets.bubblePop,
      trollAssets.bubblePop,
    ]);
    expect(sound.layerUrl).toHaveBeenLastCalledWith(trollAssets.bubblePop, {
      maxVoices: 4,
      minGapMs: undefined,
    });
  });

  it("dings for each notification within its overlap limits", () => {
    vi.useFakeTimers();
    const sound = fakeSound();
    const view = withSound(
      sound,
      <ScreenTroll kind="notification-storm" label="Storm" escape={null} />,
    );
    // One tick at a time, as a browser renders each notification.
    for (let tick = 0; tick < 3; tick += 1) {
      act(() => {
        vi.advanceTimersByTime(350);
      });
    }
    expect(layered(sound)).toEqual(Array(4).fill(trollAssets.notificationDing));
    expect(sound.layerUrl).toHaveBeenLastCalledWith(trollAssets.notificationDing, {
      maxVoices: 2,
      minGapMs: 300,
    });
    view.unmount();
    expect(sound.stop).toHaveBeenCalled();
  });

  it("chimes once for each AirDrop request, including ones that come back", () => {
    vi.useFakeTimers();
    const sound = fakeSound();
    withSound(
      sound,
      <AirDropSpam label="AirDrop" from={{ nickname: "Bilal", faceSrc: null }} />,
    );
    expect(layered(sound)).toEqual([trollAssets.airdropChime]);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    act(() => {
      vi.advanceTimersByTime(1_800);
    });
    expect(layered(sound)).toEqual([
      trollAssets.airdropChime,
      trollAssets.airdropChime,
    ]);
  });
});

function Layer({
  onReady,
}: {
  onReady: (play: ReturnType<typeof useTrollLayer>) => void;
}) {
  onReady(useTrollLayer({ maxVoices: 2 }));
  return null;
}

describe("layer fallback", () => {
  it("tries the fallback only when the first file fails, not when it is skipped", async () => {
    let play!: ReturnType<typeof useTrollLayer>;
    const missing = fakeSound((url) => (url === "/a.mp3" ? "failed" : "played"));
    withSound(missing, <Layer onReady={(value) => (play = value)} />);
    expect(await play("/a.mp3", "/b.mp3")).toBe("played");
    expect(layered(missing)).toEqual(["/a.mp3", "/b.mp3"]);

    const busy = fakeSound(() => "skipped");
    withSound(busy, <Layer onReady={(value) => (play = value)} />);
    expect(await play("/a.mp3", "/b.mp3")).toBe("skipped");
    expect(layered(busy)).toEqual(["/a.mp3"]);
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

describe("shipped troll files", () => {
  const shipped = Object.keys(import.meta.glob("../../public/assets/trolls/*")).map(
    (path) => path.replace("../../public", ""),
  );

  it("has every file a phone gag uses", () => {
    const all = Object.keys(import.meta.glob("../../public/assets/**/*")).map((path) =>
      path.replace("../../public", ""),
    );
    for (const url of Object.values(trollAssets)) {
      expect(all, url).toContain(url);
    }
  });

  it("ships only the selected pack files and their credits", () => {
    expect(shipped.sort()).toEqual(
      [
        "01_call-from-mum_ringtone.mp3",
        "02_call-from-mum_voice-line.mp3",
        "03_call-from-mum_photo_web.jpg",
        "04_bubble-wrap_pop.mp3",
        "05_notification-storm_ding.mp3",
        "05b_notification-storm_ding-alt.mp3",
        "06_confetti-cannon_party-horn.mp3",
        "07_fake-crash_error.mp3",
        "08_airdrop-spam_generic-chime.mp3",
        "09_low-battery_chirp.mp3",
        "10_fake-last-place_sad-trombone.mp3",
        "11_fake-exit_door-slam.mp3",
        "12_sponsor-break_ad-jingle.mp3",
        "13_speech_drumroll.mp3",
        "13b_speech_applause.mp3",
        "14_zoom-enhance_beep.mp3",
        "CREDITS.txt",
      ]
        .map((name) => `/assets/trolls/${name}`)
        .sort(),
    );
  });
});
