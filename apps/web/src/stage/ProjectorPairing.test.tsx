import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../live/room-api", () => ({ pairProjector: vi.fn() }));
import { pairProjector } from "../live/room-api";
import { cleanPairingCode, ProjectorPairing } from "./ProjectorPairing";

beforeEach(() => vi.clearAllMocks());

function mount(joinCode = "ABCDEF") {
  const onPaired = vi.fn();
  render(<ProjectorPairing joinCode={joinCode} onPaired={onPaired} />);
  const field = screen.getByLabelText("Pairing code");
  const submit = () =>
    fireEvent.click(screen.getByRole("button", { name: "Pair this screen" }));
  return { onPaired, field, submit };
}

it("cleans the code a person types from the admin screen", () => {
  expect(cleanPairingCode(" abcd-efgh ")).toBe("ABCDEFGH");
  expect(cleanPairingCode("ab cd ef gh")).toBe("ABCDEFGH");
});

it("asks for the join code and a whole pairing code before sending", async () => {
  const first = mount("");
  fireEvent.change(first.field, { target: { value: "ABCD-EFGH" } });
  first.submit();
  expect(
    await screen.findByText("Enter the room’s six-character join code above first."),
  ).toBeTruthy();
  cleanup();
  const second = mount();
  fireEvent.change(second.field, { target: { value: "ABC" } });
  second.submit();
  expect(
    await screen.findByText(
      "Enter the eight-character pairing code from Live controls.",
    ),
  ).toBeTruthy();
  expect(pairProjector).not.toHaveBeenCalled();
});

it("pairs with the cleaned codes and hands the room to the setup page", async () => {
  vi.mocked(pairProjector).mockResolvedValue({
    gameId: "ABCDEFGH",
    joinCode: "ABCDEF",
    expiresAt: "2026-11-21T23:00:00.000Z",
  });
  const { onPaired, field, submit } = mount("abcdef ");
  fireEvent.change(field, { target: { value: "wxyz-2345" } });
  submit();
  await waitFor(() => expect(onPaired).toHaveBeenCalledWith("ABCDEF"));
  expect(pairProjector).toHaveBeenCalledWith({
    joinCode: "ABCDEF",
    code: "WXYZ2345",
    requestId: expect.any(String),
  });
  expect(await screen.findByText("Paired. Connecting the room…")).toBeTruthy();
  expect((field as HTMLInputElement).value).toBe("");
});

it("shows the room's refusal and retries the same code with the same request", async () => {
  vi.mocked(pairProjector)
    .mockResolvedValueOnce({ error: "This screen could not reach the room." })
    .mockResolvedValueOnce({ error: "That pairing code has expired." });
  const { onPaired, field, submit } = mount();
  fireEvent.change(field, { target: { value: "WXYZ2345" } });
  submit();
  expect(await screen.findByText("This screen could not reach the room.")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Pair this screen" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  submit();
  expect(await screen.findByText("That pairing code has expired.")).toBeTruthy();
  const [first, second] = vi.mocked(pairProjector).mock.calls;
  expect(second?.[0].requestId).toBe(first?.[0].requestId);
  // A different code is a different request.
  vi.mocked(pairProjector).mockResolvedValueOnce({ error: "Not accepted." });
  fireEvent.change(field, { target: { value: "WXYZ2346" } });
  submit();
  await screen.findByText("Not accepted.");
  expect(vi.mocked(pairProjector).mock.calls[2]?.[0].requestId).not.toBe(
    first?.[0].requestId,
  );
  expect(onPaired).not.toHaveBeenCalled();
});
