import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceTake } from "./voice-take";
import { recordWav } from "./wav";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("VoiceTake", () => {
  it("revokes its preview object URL on unmount and ignores clips arriving after unmount", async () => {
    let finishRecording!: (blob: Blob) => void;
    const stopTrack = vi.fn();
    const closeContext = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn();
    const createObjectURL = vi.fn(() => "blob:voice-preview");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    });
    class FakeAudioContext {
      sampleRate = 8_000;
      destination = {};
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect });
      createScriptProcessor = () => {
        const node = {
          onaudioprocess: null as ((event: unknown) => void) | null,
          connect: () => {
            queueMicrotask(() => {
              node.onaudioprocess?.({
                inputBuffer: { getChannelData: () => new Float32Array(256) },
              });
            });
          },
          disconnect,
        };
        return node;
      };
      createGain = () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect });
      close = closeContext;
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);

    // First verify normal recording cleans up tracks & closes AudioContext and revokes on unmount.
    const onClip = vi.fn();
    const first = render(<VoiceTake disabled={false} onClip={onClip} />);
    vi.useFakeTimers();
    fireEvent.click(first.getByRole("button", { name: "Record the clip" }));
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    await waitFor(() => expect(onClip).toHaveBeenCalledTimes(1));
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(closeContext).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    first.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice-preview");

    // Second: ignore late resolution when unmounted mid-recording without leaking an Object URL.
    const delayed = new Promise<MediaStream>((resolve) => {
      finishRecording = () =>
        resolve({
          getTracks: () => [{ stop: stopTrack }],
        } as unknown as MediaStream);
    });
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn(() => delayed) },
    });
    const onClipLate = vi.fn();
    const second = render(<VoiceTake disabled={false} onClip={onClipLate} />);
    fireEvent.click(second.getByRole("button", { name: "Record the clip" }));
    second.unmount();
    vi.useFakeTimers();
    finishRecording(new Blob([new Uint8Array([1, 2])], { type: "audio/wav" }));
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect(onClipLate).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe("recordWav cleanup", () => {
  it("stops media tracks even if AudioContext construction throws", async () => {
    const stopTrack = vi.fn();
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    });
    vi.stubGlobal("AudioContext", class {
      constructor() {
        throw new Error("AudioContext failed");
      }
    });

    await expect(recordWav()).rejects.toThrow("AudioContext failed");
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
});

