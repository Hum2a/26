import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResultsPage } from "./results-page";
const ready = {
  state: "ready",
  standings: [
    { nickname: "Amina", position: 1, points: 250 },
    { nickname: "Bilal", position: 2, points: -25 },
  ],
  highlights: [],
  gallery: [
    {
      mediaId: "00000000-0000-4000-8000-000000000001",
      nickname: "Amina",
      kind: "photo",
      attribution: "Shared by Amina",
    },
  ],
  galleryNote: "Shared with the room",
  retentionNote: "Stored with this game",
};
const mine = {
  nickname: "Amina",
  position: 1,
  points: 250,
  given: 1,
  received: 2,
  best: [],
  recap: [],
};
const fetcher = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockImplementation(async (url: string) =>
    Response.json(url.includes("/mine") ? mine : ready),
  );
});
afterEach(() => vi.unstubAllGlobals());
function mount(path = "/r/ABCDEFGH") {
  const router = createMemoryRouter(
    [{ path: "/r/:gameId", element: <ResultsPage /> }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
it("presents a public podium/report and a separately labelled personal result", async () => {
  mount();
  await screen.findByRole("heading", { name: "What a night." });
  expect(screen.getByRole("region", { name: "Podium" }).textContent).toContain("250");
  await screen.findByText("Amina, you finished in position 1 with 250 points.");
  expect(screen.getByLabelText("Your private result")).toBeTruthy();
  expect(screen.queryByRole("navigation", { name: "Admin workspace" })).toBeNull();
  expect(screen.getByAltText("Photo shared by Amina").getAttribute("src")).toContain(
    "/gallery/",
  );
});
it("does not invent standings while an archive is preparing and can retry", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ state: "preparing" }));
  mount();
  await screen.findByRole("heading", { name: "Preparing results." });
  expect(screen.queryByRole("region", { name: "Podium" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Check again" }));
  await screen.findByRole("heading", { name: "What a night." });
});
it("reports an unavailable archive without stale scaffold claims", async () => {
  fetcher.mockRejectedValue(new Error("Offline"));
  mount();
  await screen.findByText(/We couldn’t load this information/);
  expect(
    (screen.getByRole("button", { name: "Check again" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  expect(screen.queryByText(/not built yet/)).toBeNull();
});
it("uses a private recap link without offering someone else's email form", async () => {
  mount("/r/ABCDEFGH?recap=private-token");
  await screen.findByText("Amina, you finished in position 1 with 250 points.");
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining("/mine?token=private-token"),
    expect.anything(),
  );
  expect(screen.queryByLabelText("Email address")).toBeNull();
});
it("handles optional email failure without claiming delivery or losing entered values", async () => {
  mount();
  await screen.findByLabelText("Email address");
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "guest@example.test" },
  });
  fetcher.mockResolvedValueOnce(Response.json({ status: "sent" }, { status: 503 }));
  fireEvent.click(screen.getByRole("button", { name: "Email my result" }));
  await screen.findByText(/We couldn’t confirm that email request/);
  expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe(
    "guest@example.test",
  );
  expect(screen.queryByText(/message is with the mail service/)).toBeNull();
});
it("does not request an invalid game and clears private data when the game changes", async () => {
  const router = mount();
  await screen.findByLabelText("Email address");
  await router.navigate("/r/nope");
  await waitFor(() => expect(screen.queryByLabelText("Email address")).toBeNull());
  expect(screen.getByRole("heading", { name: "Check this address" })).toBeTruthy();
  expect(fetcher.mock.calls.some((call) => String(call[0]).includes("/nope/"))).toBe(
    false,
  );
});
