import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./sections-api", () => ({ readContent: vi.fn() }));
import { readContent } from "./sections-api";
import { ContentPage } from "./content-page";
beforeEach(() => vi.resetAllMocks());
it("shows draft readiness and order without editing or releasing a pack", async () => {
  vi.mocked(readContent).mockResolvedValue({
    packs: [
      {
        id: "birthday",
        version: "birthday-draft",
        release: "draft",
        illustrative: false,
        questions: [
          {
            id: "draft-question",
            title: "Draft question",
            prompt: "Supplied wording",
            mechanic: "choice",
            presentation: "standard",
            status: "draft",
            order: null,
            missing: [{ code: "media", name: "Photo", detail: "Photo not supplied" }],
          },
        ],
      },
    ],
  });
  render(<ContentPage />);
  await screen.findByText("Photo: Photo not supplied");
  expect(screen.getByText(/Preparation only/)).toBeTruthy();
  expect(screen.getByText(/Not in running order/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: /Start|Publish|Save|Release/ }),
  ).toBeNull();
});
it("recovers a failed readiness request", async () => {
  vi.mocked(readContent)
    .mockResolvedValueOnce({ error: "Content unavailable" })
    .mockResolvedValue({ packs: [] });
  render(<ContentPage />);
  await screen.findByText("Content unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Refresh packs" }));
  await screen.findByText("How to update a question", { selector: "h2" });
  expect(readContent).toHaveBeenCalledTimes(2);
});
