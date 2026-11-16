import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./sections-api", () => ({
  readContent: vi.fn(),
  readKartAssets: vi.fn(),
  readKartTracks: vi.fn(),
}));
vi.mock("../live/room-api", () => ({ createLobby: vi.fn() }));
vi.mock("./phone-preview-panel", () => ({
  PhonePreviewPanel: ({
    version,
    questionId,
  }: {
    version: string;
    questionId: string;
  }) => (
    <p>
      Shared preview: {version}/{questionId}
    </p>
  ),
}));
import { readContent, readKartAssets, readKartTracks } from "./sections-api";
import { kartTrackPreview } from "@26/shared";
import { kartAssetManifest } from "@26/shared";
import { createLobby } from "../live/room-api";
import { AdminKartPage } from "./kart-page";
import { AdminShell } from "../ui/admin-shell";
import { safeAdminReturnTo } from "./admin-return";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readKartAssets).mockResolvedValue(kartAssetManifest);
  vi.mocked(readKartTracks).mockResolvedValue(kartTrackPreview({}));
});

it("creates only a kart lobby and reuses the request after uncertain creation", async () => {
  vi.mocked(createLobby).mockResolvedValue({ error: "Connection lost" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Create kart lobby" }));
  await screen.findByText("Connection lost");
  fireEvent.click(screen.getByRole("button", { name: "Retry kart lobby" }));
  await waitFor(() => expect(createLobby).toHaveBeenCalledTimes(2));
  expect(vi.mocked(createLobby).mock.calls[0]).toEqual(
    vi.mocked(createLobby).mock.calls[1],
  );
  expect(createLobby).toHaveBeenCalledWith(expect.any(String), undefined, "kart");
});

function mount(path = "/admin/kart") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminShell account={<p>Administrator</p>}>
        <AdminKartPage />
      </AdminShell>
    </MemoryRouter>,
  );
}
it("opens the authenticated track catalogue in its existing Kart navigation", async () => {
  mount("/admin/kart?view=tracks");
  expect(
    screen.getByRole("button", { name: "Tracks & modes", pressed: true }),
  ).toBeTruthy();
  await screen.findByRole("heading", { name: "Tracks & modes" });
  await screen.findByText(/Mario circuit · Imported circuit/);
});

it("opens the actual time-trial rehearsal from its Kart view", () => {
  mount("/admin/kart?view=trials");
  expect(
    screen.getByRole("button", { name: "Time trials", pressed: true }),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Time trials" })).toBeTruthy();
  expect(screen.getByTitle("Time trial practice").getAttribute("src")).toBe(
    "/kart-engine/index.html",
  );
});

it("opens the real isolated Controls bench from the Kart navigation", async () => {
  mount("/admin/kart?view=controls");
  expect(await screen.findByRole("heading", { name: "Controls bench" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Controls", pressed: true })).toBeTruthy();
  fireEvent.keyDown(window, { key: "w" });
  expect(screen.getByLabelText("Current driving input").textContent).toContain(
    "Accelerate on",
  );
});

it("opens the playable circuit from its own active admin tab without needing rooms or content", () => {
  mount();
  expect(screen.getByRole("link", { name: "Kart" }).getAttribute("aria-current")).toBe(
    "page",
  );
  expect(document.title).toBe("Kart · 26");
  expect(screen.getByTitle("Solo kart practice").getAttribute("src")).toBe(
    "/kart-engine/index.html",
  );
  expect(
    screen.getByRole("link", { name: "Open kart full screen ↗" }).getAttribute("href"),
  ).toBe("/kart");
  expect(readContent).not.toHaveBeenCalled();
});

it("unloads the driving iframe and discovers the birthday kart for the existing screen comparison", async () => {
  const question = {
    id: "kart-sprint",
    title: "Kart sprint",
    prompt: "Drive",
    mechanic: "kart",
    presentation: "standard",
    status: "ready" as const,
    order: null,
    missing: [],
  };
  vi.mocked(readContent).mockResolvedValue({
    packs: [
      {
        id: "demo",
        version: "demo-v1",
        release: "released",
        illustrative: true,
        questions: [question],
      },
      {
        id: "birthday",
        version: "birthday-draft",
        release: "draft",
        illustrative: false,
        questions: [question],
      },
    ],
  });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Phone & stage" }));
  await screen.findByText("Shared preview: birthday-draft/kart-sprint");
  expect(screen.queryByTitle("Solo kart practice")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Open kart question details →" })
      .getAttribute("href"),
  ).toBe("/admin/content/birthday-draft/kart-sprint");
});

it("reports unavailable layouts and retries without inventing a race or a question", async () => {
  vi.mocked(readContent)
    .mockResolvedValueOnce({ error: "Packs unavailable" })
    .mockResolvedValue({ packs: [] });
  mount("/admin/kart?view=layouts");
  await screen.findByText("Packs unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Refresh kart previews" }));
  await screen.findByText(
    "No kart question is available in the current question packs.",
  );
  expect(screen.queryByText(/Shared preview/)).toBeNull();
});

it("keeps race actions in the existing room controls and explains multiplayer", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Multiplayer" }));
  await screen.findByRole("heading", { name: "Race with phones" });
  await waitFor(() => expect(screen.queryByTitle("Solo kart practice")).toBeNull());
  expect(screen.getByRole("link", { name: "Open rooms →" }).getAttribute("href")).toBe(
    "/admin/rooms",
  );
  expect(screen.getByText(/multiplayer race uses this imported circuit/)).toBeTruthy();
  expect(readContent).not.toHaveBeenCalled();
});

it("preserves the dedicated page as an allowed sign-in return destination", () => {
  expect(safeAdminReturnTo("/admin/kart")).toBe("/admin/kart");
  expect(safeAdminReturnTo("/admin/kart/unknown")).toBe("/admin");
});

it("keeps file diagnostics in their own view and rehearses with the real engine", async () => {
  mount();
  expect(readKartAssets).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Files & limits" }));
  await screen.findByText(/kart-assets-v1/);
  expect(screen.getByTitle("Solo kart practice").getAttribute("src")).toBe(
    "/kart-engine/index.html",
  );
  expect(readKartAssets).toHaveBeenCalledTimes(1);
  expect(readContent).not.toHaveBeenCalled();
});

it("opens the real collision bench as a dedicated kart view", async () => {
  mount("/admin/kart?view=collisions");
  expect(screen.getByRole("heading", { name: "Collision bench" })).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "Actual course collision boundaries" }),
  ).toBeTruthy();
  expect(screen.queryByTitle("Solo kart practice")).toBeNull();
});
