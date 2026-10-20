import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { publicQuestionSchema, type AdminQuestionPreview } from "@26/shared";
import { QuestionStagePreview } from "./question-stage-preview";
import { rehearsalPlay } from "./question-rehearsal";
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
        path: "/admin/stage-preview/:version/:questionId",
        element: <QuestionStagePreview />,
      },
    ],
    { initialEntries: [`/admin/stage-preview/fixture-pack/fixture${search}`] },
  );
  render(<RouterProvider router={router} />);
}
it("uses the actual projector question and options without guest inputs or invented reveals", async () => {
  vi.mocked(readQuestionPreview).mockResolvedValue(preview);
  mount();
  expect(await screen.findByRole("heading", { name: "Answers are open" })).toBeTruthy();
  expect(readQuestionPreview).toHaveBeenCalledWith("fixture-pack", "fixture");
  expect(screen.getByText("Choose a test shape").className).toContain("stage-prompt");
  expect(screen.getByText("Test circle").className).toContain("stage-option");
  expect(screen.getByText(/Phone actions stay in the phone preview/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Send answer" })).toBeNull();
  expect(screen.queryByText(/The answer is/)).toBeNull();
  expect(screen.queryByText("Final scores")).toBeNull();
});
it("shares the get-ready phase without fabricating a key", async () => {
  vi.mocked(readQuestionPreview).mockResolvedValue(preview);
  mount("?phase=prompt");
  expect(
    await screen.findByRole("heading", { name: "Read the question" }),
  ).toBeTruthy();
  const play = rehearsalPlay(preview.question!, "collect");
  expect(play.reveal).toBeNull();
  expect(play.standings).toBeNull();
  expect(play.selfAward).toBeNull();
  expect(play.attributions).toBeNull();
  expect(play.explanation).toBeNull();
});
it("labels incomplete drafts on the stage", async () => {
  vi.mocked(readQuestionPreview).mockResolvedValue({
    ...preview,
    interactive: false,
    limitation: "Draft layout only. This interaction is not implemented.",
  });
  mount();
  expect(await screen.findByText(/Draft layout only/)).toBeTruthy();
});
it("keeps unavailable fields hidden and offers authentication and a retry", async () => {
  vi.mocked(readQuestionPreview)
    .mockResolvedValueOnce({ error: "Please sign in." })
    .mockResolvedValue({
      question: null,
      interactive: false,
      limitation: "The scale is missing",
    });
  mount();
  const link = await screen.findByRole("link", { name: "Admin sign in →" });
  expect(link.getAttribute("href")).toContain(
    encodeURIComponent("/admin/stage-preview/fixture-pack/fixture"),
  );
  expect(screen.queryByText("Choose a test shape")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("The scale is missing")).toBeTruthy();
  expect(screen.queryByText("Test circle")).toBeNull();
});
it("uses the same explicitly labelled stand-in ballots as the phone", async () => {
  const question = publicQuestionSchema.parse({
    id: "fixture",
    index: 1,
    total: 2,
    prompt: "Choose a test line",
    points: 100,
    illustrative: false,
    attribution: "after",
    presentation: "standard",
    kind: "vote",
    candidateMode: "all",
    selfVote: "forbidden",
    votes: 1,
    tie: "shared",
    award: "authors",
    lateJoin: "ineligible",
    flow: "tournament",
  });
  const play = rehearsalPlay(question, "vote");
  expect(play.ballot?.cards.map((card) => card.label)).toEqual([
    "Sample line 1",
    "Sample line 2",
  ]);
  expect(play.ballot?.instruction).toContain("Stand-in submissions only");
  vi.mocked(readQuestionPreview).mockResolvedValue({ ...preview, question });
  mount("?phase=vote");
  expect(await screen.findByRole("heading", { name: "Voting" })).toBeTruthy();
  expect(screen.getByText("Sample line 1")).toBeTruthy();
});
