import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import type { AdminQuestionDetail } from "@26/shared";
import { QuestionPage } from "./question-page";
import { readQuestion } from "./sections-api";
vi.mock("./sections-api", () => ({ readQuestion: vi.fn() }));
const detail: AdminQuestionDetail = {
  version: "fixture-pack",
  release: "draft",
  question: {
    id: "first",
    title: "First question",
    prompt: "Choose a test shape",
    mechanic: "choice",
    presentation: "standard",
    status: "ready",
    order: null,
    missing: [],
    instructions: "Choose one",
    notes: "Private fixture note",
    explanation: "Fixture explanation",
    options: [
      { id: "circle", label: "Test circle" },
      { id: "square", label: "Test square" },
    ],
    settings: [
      { label: "Points", value: "100" },
      { label: "Answer window", value: "20 seconds" },
    ],
    answer: { status: "recorded", lines: ["Fixture recorded answer"] },
    media: [],
  },
};
beforeEach(() => vi.resetAllMocks());
function mount() {
  const router = createMemoryRouter(
    [
      { path: "/admin/content/:version/:questionId", element: <QuestionPage /> },
      { path: "/admin/content", element: <h1>Pack list</h1> },
    ],
    { initialEntries: ["/admin/content/fixture-pack/first"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
it("opens an individual read-only question with settings and a deliberate private answer disclosure", async () => {
  vi.mocked(readQuestion).mockResolvedValue(detail);
  mount();
  const heading = await screen.findByRole("heading", {
    level: 1,
    name: "First question",
  });
  expect(readQuestion).toHaveBeenCalledWith("fixture-pack", "first");
  await waitFor(() => expect(document.activeElement).toBe(heading));
  expect(screen.getByText("Test circle")).toBeTruthy();
  expect(screen.getByText("100")).toBeTruthy();
  expect(screen.queryByText("Private fixture note")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Answer & author notes/ }));
  expect(await screen.findByText("Fixture recorded answer")).toBeTruthy();
  expect(screen.getByText("Private fixture note")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Back to question packs/ }).getAttribute("href"),
  ).toBe("/admin/content?pack=fixture-pack");
  expect(screen.queryByRole("button", { name: /Save|Release|Start/ })).toBeNull();
});
it("shows draft gaps without treating missing answers or assets as ready", async () => {
  vi.mocked(readQuestion).mockResolvedValue({
    ...detail,
    question: {
      ...detail.question,
      status: "draft",
      missing: [{ code: "truth", name: "Target", detail: "Target not supplied" }],
      answer: { status: "missing", lines: ["Answer not supplied"] },
      media: [{ name: "Photo", kind: "image", required: true, supplied: false }],
    },
  });
  mount();
  await screen.findByText("Target not supplied");
  expect(screen.getByText(/Photo · image · Required · Not supplied/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Answer & author notes/ }));
  expect(await screen.findByText("Answer pending")).toBeTruthy();
});
it("shows request failures and supports retry without stale private data", async () => {
  vi.mocked(readQuestion)
    .mockResolvedValueOnce(detail)
    .mockResolvedValueOnce({ error: "Question unavailable" })
    .mockResolvedValue(detail);
  mount();
  await screen.findByRole("heading", { name: "First question" });
  fireEvent.click(screen.getByRole("button", { name: "Refresh question" }));
  await screen.findByText("Question unavailable");
  expect(screen.queryByText("Test circle")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Refresh question" }));
  expect(await screen.findByText("Test circle")).toBeTruthy();
});
it("ignores an old question response and resets private disclosure on navigation", async () => {
  let resolveFirst!: (value: AdminQuestionDetail) => void;
  vi.mocked(readQuestion)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValue({
      ...detail,
      question: {
        ...detail.question,
        id: "second",
        title: "Second question",
        notes: "Second private note",
      },
    });
  const router = mount();
  await waitFor(() => expect(readQuestion).toHaveBeenCalledOnce());
  await act(() => router.navigate("/admin/content/fixture-pack/second"));
  await screen.findByRole("heading", { name: "Second question" });
  await act(async () => resolveFirst(detail));
  expect(screen.queryByRole("heading", { name: "First question" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Answer & author notes/ }));
  await screen.findByText("Second private note");
  await act(() => router.navigate("/admin/content/fixture-pack/first"));
  await screen.findByRole("heading", { name: "Question details" });
  expect(screen.queryByText("Second private note")).toBeNull();
});
