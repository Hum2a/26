import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { GuestPlay } from "../guest-play";
import { StagePlay } from "../stage-play";
import { previewQuestions } from "./preview/fixtures";

vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

afterEach(cleanup);
const question = previewQuestions["whos-that-pokemon"];
function snapshot(phase = "collect", extra: Partial<PlaySnapshot> = {}) {
  return {
    phase,
    paused: false,
    held: false,
    finishAfterRound: false,
    trolls: { active: [] },
    play: {
      question,
      submissionCount: 2,
      selfAnswer: null,
      selfBallot: null,
      ballot: null,
      duel: null,
      reveal: null,
      selfAward: null,
      selfStanding: null,
      standings: null,
      liveSample: null,
      attributions: null,
      explanation: null,
      ...extra,
    },
  } as unknown as LobbySnapshot;
}
const handlers = () => ({
  onSelect: vi.fn(),
  onSubmit: vi.fn(),
  onEstimate: vi.fn(),
  onRank: vi.fn(),
  onText: vi.fn(),
  onBallot: vi.fn(),
  onDuel: vi.fn(),
});
const reveal = { kind: "choice" as const, correctOptionId: "mudkip" };

it("shows only the blacked-out picture and four names while answers are open", () => {
  for (const surface of ["phone", "stage"] as const) {
    const view =
      surface === "phone"
        ? render(<GuestPlay snapshot={snapshot()} pending={false} {...handlers()} />)
        : render(<StagePlay snapshot={snapshot()} />);
    const pictures = [...view.container.querySelectorAll("img")].map((image) =>
      image.getAttribute("src"),
    );
    // No option's colour picture is drawn before the reveal, so nothing gives it away.
    expect(pictures).toEqual([
      "/assets/questions/whos-that-pokemon-preview/silhouette.png",
    ]);
    expect(screen.getByAltText("A blacked-out Pokémon")).toBeTruthy();
    for (const name of ["Turtwig", "Mudkip", "Tepig", "Piplup"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(view.container.textContent).not.toContain("It’s");
    view.unmount();
  }
});

it("falls back to a question mark when the silhouette is not supplied yet", async () => {
  render(<StagePlay snapshot={snapshot()} />);
  fireEvent.error(screen.getByAltText("A blacked-out Pokémon"));
  expect(await screen.findByRole("img", { name: "A mystery Pokémon" })).toBeTruthy();
});

it("picks a name on the phone and sends it through the dock button", () => {
  const actions = handlers();
  const view = render(<GuestPlay snapshot={snapshot()} pending={false} {...actions} />);
  fireEvent.click(screen.getByRole("button", { name: "Tepig" }));
  expect(actions.onSelect).toHaveBeenCalledWith("tepig");
  view.rerender(
    <GuestPlay snapshot={snapshot()} selectedId="tepig" pending={false} {...actions} />,
  );
  expect(
    screen.getByRole("button", { name: "Tepig" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "I choose you!" }));
  expect(actions.onSubmit).toHaveBeenCalled();
});

it("keeps the names closed during the prompt", () => {
  render(<GuestPlay snapshot={snapshot("prompt")} pending={false} {...handlers()} />);
  expect(screen.getByRole("button", { name: "Mudkip" })).toHaveProperty(
    "disabled",
    true,
  );
});

it("reveals the answer in colour with its name on both screens", () => {
  const phone = render(
    <GuestPlay
      snapshot={snapshot("reveal", { reveal })}
      pending={false}
      {...handlers()}
    />,
  );
  expect(screen.getByAltText("Mudkip").getAttribute("src")).toBe(
    "/assets/questions/favourite-pokemon/mudkip.png",
  );
  expect(screen.getByText("It’s Mudkip!")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mudkip, the answer" })).toBeTruthy();
  phone.unmount();
  render(<StagePlay snapshot={snapshot("reveal", { reveal })} />);
  expect(screen.getByAltText("Mudkip")).toBeTruthy();
  expect(screen.getByText("It’s Mudkip!")).toBeTruthy();
});
