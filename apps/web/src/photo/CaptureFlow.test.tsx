import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaptureFlow } from "./CaptureFlow";

function installCamera() {
  const track = { stop: vi.fn(), kind: "video" as const };
  const getUserMedia = vi.fn(
    async () => ({ getTracks: () => [track] }) as unknown as MediaStream,
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

describe("CaptureFlow", () => {
  it("previews a capture, retakes, sends once, and offers retry after a failure", async () => {
    installCamera();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage() {},
    } as unknown as CanvasRenderingContext2D);
    HTMLCanvasElement.prototype.toBlob = (callback) => {
      callback?.(new Blob(["photo"], { type: "image/jpeg" }));
    };
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const upload = vi.fn(async () => true);
    const { unmount } = render(<CaptureFlow upload={upload} />);

    fireEvent.click(await screen.findByRole("button", { name: "Capture" }));
    expect(await screen.findByRole("img", { name: "Preview" })).toBeTruthy();
    expect(upload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retake" }));
    expect(await screen.findByRole("button", { name: "Capture" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Preview" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send" }));
    const sent = await screen.findByRole("button", { name: "Sent ✓" });
    expect((sent as HTMLButtonElement).disabled).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    unmount();

    const failed = vi.fn(async () => false);
    render(<CaptureFlow upload={failed} />);
    fireEvent.click(await screen.findByRole("button", { name: "Capture" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send" }));
    expect(await screen.findByText("Failed")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retry);
    expect(failed).toHaveBeenCalledTimes(2);
  });
});
