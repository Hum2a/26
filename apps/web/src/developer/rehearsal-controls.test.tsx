import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { defaultRehearsalConfig } from "@26/shared";
vi.mock("../admin/rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({
  playRoom: vi.fn(),
  issueTransfer: vi.fn(),
  createLobby: vi.fn(),
}));
import { readAdminRoom } from "../admin/rooms-api";
import { playRoom } from "../live/room-api";
import {
  setupControls,
  mountControls,
  playingFixture,
  update,
} from "../admin/controls.test-support";
import { RehearsalControls } from "./rehearsal-controls";
import { PhoneLauncher } from "./phone-launcher";
beforeEach(() =>
  setupControls({
    ...playingFixture,
    developerTools: {
      revision: 1,
      bots: [],
      history: [],
      rehearsal: {
        config: defaultRehearsalConfig,
        revision: 1,
        runner: "running",
        reason: "Running",
        startedAt: 1,
        scenario: null,
        questions: [{ id: "test-question", title: "Test question" }],
        events: [
          {
            id: 1,
            at: 1,
            kind: "phase",
            actor: "Server",
            detail: "Entered collect",
            status: "info",
            phase: "collect",
            questionId: "test-question",
          },
        ],
        checks: [{ id: "scores", status: "pass", detail: "No duplicate scores" }],
      },
    },
  }),
);
it("sends each rehearsal control through validated host commands and shows diagnostics", async () => {
  await mountControls(
    <>
      <h1>Test controls</h1>
      <RehearsalControls />
    </>,
  );
  expect(screen.getByText("No duplicate scores", { exact: false })).toBeTruthy();
  expect(screen.getByText("Entered collect", { exact: false })).toBeTruthy();
  for (const [label, expected] of [
    ["Pause automatic show", { action: "developer-stop" }],
    ["Repeat this question", { action: "developer-repeat" }],
    [
      "Jump and reset selected question",
      { action: "developer-jump", questionIndex: 0 },
    ],
    [
      "Apply rehearsal settings",
      { action: "developer-configure", rehearsalConfig: defaultRehearsalConfig },
    ],
    [
      "Disconnect 25% of bots",
      { action: "developer-scenario", scenario: "disconnect" },
    ],
    ["Add late bot", { action: "developer-scenario", scenario: "late-join" }],
    [
      "Answer near deadline",
      { action: "developer-scenario", scenario: "deadline-burst" },
    ],
    [
      "Lose host for five seconds",
      { action: "developer-scenario", scenario: "host-loss" },
    ],
  ] as const) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() =>
      expect(playRoom).toHaveBeenLastCalledWith(expect.objectContaining(expected)),
    );
  }
});
it("continues a paused rehearsal with the existing host command", async () => {
  const initial = await readAdminRoom("ABCDEFGH");
  if ("error" in initial || !initial.developerTools?.rehearsal)
    throw new Error("Missing rehearsal fixture");
  await mountControls(
    <>
      <h1>Test controls</h1>
      <RehearsalControls />
    </>,
  );
  update({
    ...initial,
    paused: true,
    developerTools: {
      ...initial.developerTools,
      rehearsal: { ...initial.developerTools.rehearsal, runner: "paused" },
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Run or continue show" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "developer-run" }),
    ),
  );
});
it("launches the real phone and stage only on request and changes phone dimensions", async () => {
  await mountControls(
    <>
      <h1>Test phone</h1>
      <PhoneLauncher gameId="ABCDEFGH" joinCode="ABCDEF" />
    </>,
  );
  expect(screen.queryByTitle("Live rehearsal phone")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open test phone" }));
  expect(screen.getByTitle("Live rehearsal phone").getAttribute("src")).toMatch(
    /^\/admin\/phone-preview\/room\/ABCDEFGH\?take=/,
  );
  fireEvent.change(screen.getByLabelText("Phone size"), {
    target: { value: "Landscape" },
  });
  expect(screen.getByTitle("Live rehearsal phone").style.width).toBe("740px");
  expect(screen.getByTitle("Live rehearsal phone").style.height).toBe("390px");
  fireEvent.click(screen.getByRole("button", { name: "Show stage preview" }));
  expect(screen.getByTitle("Live rehearsal stage").getAttribute("src")).toBe(
    "/host?code=ABCDEF&rehearsal=1",
  );
});
