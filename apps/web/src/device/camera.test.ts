import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCamera } from "./camera";

function fakeStream() {
  const track = { stop: vi.fn(), kind: "video" as const };
  const media = { getTracks: () => [track] } as unknown as MediaStream;
  return { track, media };
}

function installCamera(getUserMedia: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useCamera", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("toggles facing, falls back when the camera rejects, and stops tracks on unmount", async () => {
    const rear = fakeStream();
    const front = fakeStream();
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(rear.media)
      .mockResolvedValueOnce(front.media);
    installCamera(getUserMedia);

    const opened = renderHook(() => useCamera(true));
    await flush();
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment" },
      audio: false,
    });

    act(() => {
      opened.result.current.toggleFacing();
    });
    await flush();
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: { facingMode: "user" },
      audio: false,
    });
    expect(rear.track.stop).toHaveBeenCalled();

    opened.unmount();
    expect(front.track.stop).toHaveBeenCalled();

    const denied = vi.fn().mockRejectedValue(new Error("denied"));
    installCamera(denied);
    const failed = renderHook(() => useCamera(true));
    await flush();
    expect(failed.result.current.fallback).toBe(true);
    failed.unmount();
  });
});
