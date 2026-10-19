import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { publicQuestionSchema, type AdminQuestionPreview } from "@26/shared";
import { QuestionPhonePreview } from "./question-phone-preview";
import { readQuestionPreview } from "./sections-api";
vi.mock("./sections-api", () => ({ readQuestionPreview: vi.fn() }));
const preview: AdminQuestionPreview = {
  question: {
    id: "fixture",
    index: 1,
    total: 2,
    prompt: "Choose a test shape",
    points: 100,
    illustrative: false,
    attribution: "after",
    presentation: "standard",
    kind: "choice",
    options: [
      { id: "circle", label: "Test circle" },
      { id: "square", label: "Test square" },
    ],
    speedBonus: false,
    modifiers: [],
    suppressSpeedBonus: false,
  },
  limitation: null,
  interactive: true,
};
beforeEach(() => vi.resetAllMocks());
function mount(search = "") {
  const router = createMemoryRouter(
    [
      {
        path: "/admin/phone-preview/:version/:questionId",
        element: <QuestionPhonePreview />,
      },
    ],
    { initialEntries: [`/admin/phone-preview/fixture-pack/fixture${search}`] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
it("uses the real guest controls and locks a rehearsal answer only after sending", async () => {
  vi.mocked(readQuestionPreview).mockResolvedValue(preview);
  mount();
  const circle = await screen.findByRole("button", { name: "Test circle" });
  expect(readQuestionPreview).toHaveBeenCalledWith("fixture-pack", "fixture");
  expect(screen.getByText(/no live game is connected/)).toBeTruthy();
  expect(screen.getByText("Pick one, then send your answer")).toBeTruthy();
  const send = screen.getByRole("button", { name: "Send answer" }) as HTMLButtonElement;
  expect(send.disabled).toBe(true);
  fireEvent.click(circle);
  expect(screen.queryByText("Locked in — watch the stage")).toBeNull();
  fireEvent.click(send);
  expect(await screen.findByText("Locked in — watch the stage")).toBeTruthy();
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Locked in ✓" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true),
  );
  expect(readQuestionPreview).toHaveBeenCalledTimes(1);
});
it("disables answering before the round opens and while paused", async () => {
  vi.mocked(readQuestionPreview).mockResolvedValue(preview);
  mount("?phase=prompt");
  const circle = await screen.findByRole("button", { name: "Test circle" });
  expect((circle as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Get ready — listen to the question")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Send answer" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Pause preview" }));
  expect(await screen.findByText("Paused — hang tight")).toBeTruthy();
});
it("labels unsupported draft layouts and prevents the wrong interaction", async () => {
  vi.mocked(readQuestionPreview).mockResolvedValue({
    ...preview,
    limitation: "Draft mechanic not implemented",
    interactive: false,
  });
  mount();
  expect(await screen.findByText(/Draft mechanic not implemented/)).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Test circle" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it("keeps missing scales unavailable and retries errors without showing an old question", async () => {
  vi.mocked(readQuestionPreview)
    .mockResolvedValueOnce({ error: "Sign in as the administrator to continue." })
    .mockResolvedValue({
      question: null,
      limitation: "The scale is missing",
      interactive: false,
    });
  mount();
  expect(
    await screen.findByText("Sign in as the administrator to continue."),
  ).toBeTruthy();
  expect(screen.queryByText("Test circle")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("The scale is missing")).toBeTruthy();
});
it.each([
  { kind: "typed", maxLength: 60 },
  { kind: "slider", minimum: 0, maximum: 10, step: 1, initial: 5, unit: "units" },
  {
    kind: "rank",
    mode: "complete",
    ties: "forbidden",
    items: [
      { id: "first", label: "First item" },
      { id: "second", label: "Second item" },
    ],
    tiers: [
      { id: "top", label: "Top" },
      { id: "bottom", label: "Bottom" },
    ],
  },
  {
    kind: "vote",
    candidateMode: "all",
    selfVote: "forbidden",
    votes: 1,
    tie: "shared",
    award: "authors",
    lateJoin: "ineligible",
  },
  {
    kind: "guess",
    roster: "room",
    selfVote: "forbidden",
    tie: "shared",
    scoring: "none",
    lateJoin: "ineligible",
    search: true,
  },
  {
    kind: "duel",
    minimum: 0,
    maximum: 10,
    step: 1,
    target: 5,
    within: 0,
    odd: "solo",
    tie: "shared",
    absence: "forfeit",
    lateJoin: "ineligible",
    tieBreak: "off",
  },
  {
    kind: "finale",
    minimum: 0,
    maximum: 10,
    step: 1,
    target: 5,
    within: 0,
    tie: "shared",
    absence: "forfeit",
    lateJoin: "ineligible",
    tieBreak: "off",
    contestants: ["Sample one", "Sample two"],
    predictionPoints: 30,
  },
])("renders the actual $kind phone component from projected fields", async (fields) => {
  const question = publicQuestionSchema.parse({
    id: "fixture",
    index: 1,
    total: 2,
    prompt: "A test question",
    points: 100,
    illustrative: false,
    attribution: "after",
    presentation: "standard",
    ...fields,
  });
  vi.mocked(readQuestionPreview).mockResolvedValue({
    question,
    limitation: null,
    interactive: true,
  });
  mount();
  expect(await screen.findByRole("heading", { name: "A test question" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Question experience" })).toBeTruthy();
  if (fields.kind === "duel" || fields.kind === "finale")
    expect(screen.getByLabelText("Your number")).toBeTruthy();
  if (fields.kind === "guess")
    expect(screen.getByRole("button", { name: "Sample guest 1" })).toBeTruthy();
});
