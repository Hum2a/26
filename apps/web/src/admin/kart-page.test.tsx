import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./sections-api", () => ({ readContent: vi.fn() }));
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
import { readContent } from "./sections-api";
import { AdminKartPage } from "./kart-page";
import { AdminShell } from "../ui/admin-shell";
import { safeAdminReturnTo } from "./admin-return";

beforeEach(() => vi.resetAllMocks());

function mount(path = "/admin/kart") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminShell account={<p>Administrator</p>}>
        <AdminKartPage />
      </AdminShell>
    </MemoryRouter>,
  );
}

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

it("keeps room actions in the existing controls and explains the birthday race", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Multiplayer" }));
  await screen.findByRole("heading", { name: "Race with phones" });
  await waitFor(() => expect(screen.queryByTitle("Solo kart practice")).toBeNull());
  expect(screen.getByRole("link", { name: "Open rooms →" }).getAttribute("href")).toBe(
    "/admin/rooms",
  );
  expect(screen.getByText(/birthday race uses this imported circuit/)).toBeTruthy();
  expect(readContent).not.toHaveBeenCalled();
});

it("preserves the dedicated page as an allowed sign-in return destination", () => {
  expect(safeAdminReturnTo("/admin/kart")).toBe("/admin/kart");
  expect(safeAdminReturnTo("/admin/kart/unknown")).toBe("/admin");
});
