import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
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
  render(
    <MemoryRouter>
      <ContentPage />
    </MemoryRouter>,
  );
  await screen.findByText("Photo: Photo not supplied");
  fireEvent.click(screen.getByRole("button", { name: /Pack details/ }));
  expect(screen.getByText(/Versioned question source/)).toBeTruthy();
  expect(screen.getByText(/Not in running order/)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "View Draft question" }).getAttribute("href"),
  ).toContain(
    "/admin/content/birthday-draft/draft-question?pack=birthday-draft&question=draft-question",
  );
  fireEvent.click(screen.getByRole("button", { name: /Phone and stage rehearsal/ }));
  expect(screen.getByTitle("Interactive phone preview").getAttribute("src")).toContain(
    "/admin/phone-preview/birthday-draft/draft-question",
  );
  expect(
    screen.queryByRole("button", { name: /Start|Publish|Save|Release/ }),
  ).toBeNull();
});
it("recovers a failed readiness request", async () => {
  vi.mocked(readContent)
    .mockResolvedValueOnce({ error: "Content unavailable" })
    .mockResolvedValue({ packs: [] });
  render(
    <MemoryRouter>
      <ContentPage />
    </MemoryRouter>,
  );
  await screen.findByText("Content unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Refresh packs" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /How to update a question/ }),
  );
  await screen.findByText("How to update a question", { selector: "h2" });
  expect(readContent).toHaveBeenCalledTimes(2);
});

it("browses grouped questions with search, readiness filters and previous/next instead of a dropdown", async () => {
  const base = {
    prompt: "Fixture wording",
    presentation: "standard",
    order: null,
    missing: [],
  };
  vi.mocked(readContent).mockResolvedValue({
    packs: [
      {
        id: "birthday",
        version: "birthday-draft",
        release: "draft",
        illustrative: false,
        questions: [
          {
            ...base,
            id: "first",
            title: "First choice",
            mechanic: "choice",
            status: "ready",
          },
          {
            ...base,
            id: "second",
            title: "Second typed",
            mechanic: "typed",
            status: "draft",
          },
          {
            ...base,
            id: "third",
            title: "Third choice",
            mechanic: "choice",
            status: "ready",
          },
        ],
      },
    ],
  });
  render(
    <MemoryRouter>
      <ContentPage />
    </MemoryRouter>,
  );
  await screen.findByRole("button", { name: "Preview First choice" });
  expect(screen.queryByLabelText("Preview a question")).toBeNull();
  expect(
    (screen.getByRole("button", { name: "← Previous" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next →" }));
  expect(
    screen
      .getByRole("button", { name: "Preview Third choice" })
      .getAttribute("aria-current"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: /Phone and stage rehearsal/ }));
  expect(screen.getByTitle("Interactive phone preview").getAttribute("src")).toContain(
    "/third?",
  );
  fireEvent.click(screen.getByRole("button", { name: "Drafts (1)" }));
  expect(screen.queryByRole("button", { name: "Preview First choice" })).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Preview Second typed" })
      .getAttribute("aria-current"),
  ).toBe("true");
  fireEvent.change(screen.getByLabelText("Search questions"), {
    target: { value: "missing" },
  });
  expect(screen.getByText(/No questions match/)).toBeTruthy();
  expect(screen.queryByTitle("Interactive phone preview")).toBeNull();
});
it("restores a deep-linked selected question", async () => {
  vi.mocked(readContent).mockResolvedValue({
    packs: [
      {
        id: "birthday",
        version: "birthday-draft",
        release: "draft",
        illustrative: false,
        questions: ["a", "b"].map((id) => ({
          id,
          title: `Question ${id}`,
          prompt: "Fixture",
          mechanic: "choice",
          presentation: "standard",
          status: "ready",
          order: null,
          missing: [],
        })),
      },
    ],
  });
  render(
    <MemoryRouter initialEntries={["/admin/content?pack=birthday-draft&question=b"]}>
      <ContentPage />
    </MemoryRouter>,
  );
  expect(
    (await screen.findByRole("button", { name: "Preview Question b" })).getAttribute(
      "aria-current",
    ),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: /Phone and stage rehearsal/ }));
  expect(screen.getByTitle("Interactive phone preview").getAttribute("src")).toContain(
    "/b?",
  );
});
