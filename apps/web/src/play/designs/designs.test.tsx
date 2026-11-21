import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Browser } from "leaflet";
import {
  customPresentationIds,
  type LobbySnapshot,
  type PlaySnapshot,
} from "@26/shared";
import { GuestPlay } from "../guest-play";
import { StagePlay } from "../stage-play";
import { previewQuestions, previewReveal } from "./preview/fixtures";
import { designs } from "./registry";

afterEach(cleanup);

const originalSvg = Browser.svg;
beforeAll(() => {
  Object.assign(Browser, { svg: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ type: "FeatureCollection", features: [] })),
  );
});
afterAll(() => {
  Object.assign(Browser, { svg: originalSvg });
  vi.unstubAllGlobals();
});

function play(
  question: PlaySnapshot["question"],
  extra: Partial<PlaySnapshot> = {},
): PlaySnapshot {
  return {
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
  };
}

function lobby(phase: string, snapshot: PlaySnapshot): LobbySnapshot {
  return {
    phase,
    paused: false,
    held: false,
    finishAfterRound: false,
    play: snapshot,
    trolls: { active: [] },
  } as unknown as LobbySnapshot;
}

function phone(
  snapshot: LobbySnapshot,
  handlers: Partial<Parameters<typeof GuestPlay>[0]> = {},
) {
  return render(
    <GuestPlay
      snapshot={snapshot}
      pending={false}
      onSelect={vi.fn()}
      onSubmit={vi.fn()}
      onEstimate={vi.fn()}
      onRank={vi.fn()}
      onText={vi.fn()}
      onBallot={vi.fn()}
      onDuel={vi.fn()}
      {...handlers}
    />,
  );
}

describe("custom question designs", () => {
  it("registers exactly one design for every shared presentation id", () => {
    expect(Object.keys(designs).sort()).toEqual([...customPresentationIds].sort());
  });

  for (const id of customPresentationIds) {
    it(`${id} draws the phone and stage before, during and after answers`, () => {
      const question = previewQuestions[id];
      for (const phase of ["prompt", "collect", "reveal"]) {
        const reveal =
          phase === "reveal" ? previewReveal(question, undefined, 2) : null;
        const snapshot = lobby(phase, play(question, { reveal }));
        const guest = phone(snapshot);
        expect(guest.container.querySelector(".design-phone")).not.toBeNull();
        expect(guest.container.textContent).toContain(question.prompt);
        guest.unmount();
        const stage = render(<StagePlay snapshot={snapshot} />);
        expect(stage.container.querySelector(".design-stage")).not.toBeNull();
        stage.unmount();
      }
    });
  }

  it("selects and sends a choice through the phone's own handlers", () => {
    const onSelect = vi.fn();
    const onSubmit = vi.fn();
    const question = previewQuestions["now-playing"];
    const view = phone(lobby("collect", play(question)), { onSelect, onSubmit });
    fireEvent.click(screen.getByRole("button", { name: /screaming goat sounds/i }));
    expect(onSelect).toHaveBeenCalledWith("goat");
    view.rerender(
      <GuestPlay
        snapshot={lobby("collect", play(question))}
        selectedId="goat"
        pending={false}
        onSelect={onSelect}
        onSubmit={onSubmit}
        onEstimate={vi.fn()}
        onRank={vi.fn()}
        onText={vi.fn()}
        onBallot={vi.fn()}
        onDuel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /play this one/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps choices locked before answers open", () => {
    phone(lobby("prompt", play(previewQuestions["number-plate"])));
    expect(screen.getByRole("button", { name: /hagakure/i })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("sends a typed answer from the redaction bar, including with the keyboard's Go key", () => {
    const onText = vi.fn();
    phone(lobby("collect", play(previewQuestions["redacted-file"])), { onText });
    const field = screen.getByLabelText("Real name");
    fireEvent.change(field, { target: { value: "Someone Else" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    expect(onText).toHaveBeenCalledWith("Someone Else");
  });

  it("ranks on the rage meter by tapping a trigger, then its heat", () => {
    const onRank = vi.fn();
    phone(lobby("collect", play(previewQuestions["rage-meter"])), { onRank });
    const order = ["Apple", "Palm Beach Pete", "Politics", "Conspiracy theories"];
    const tiers = ["Fastest", "2nd", "3rd", "Slowest"];
    order.forEach((label, index) => {
      fireEvent.click(screen.getByRole("button", { name: label }));
      fireEvent.click(
        screen.getByRole("button", { name: new RegExp(`^${tiers[index]}`) }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /send ranking/i }));
    expect(onRank).toHaveBeenCalledWith([
      { itemId: "apple", tierId: "first" },
      { itemId: "palm-beach-pete", tierId: "second" },
      { itemId: "politics", tierId: "third" },
      { itemId: "conspiracy", tierId: "fourth" },
    ]);
  });

  it("shows the true order on the phone at the reveal, even without a ranking", () => {
    const question = previewQuestions["rage-meter"];
    const reveal = previewReveal(question, undefined, 1);
    phone(lobby("reveal", play(question, { reveal })));
    expect(screen.getByRole("button", { name: "Fastest: Apple" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Slowest: Politics" })).toBeTruthy();
  });

  it("declares the room's verdict on the pill stage", () => {
    const question = previewQuestions["red-blue-pill"];
    const reveal = {
      kind: "choice" as const,
      correctOptionId: null,
      outcome: "threshold" as const,
      tally: [
        { optionId: "red", count: 1 },
        { optionId: "blue", count: 3 },
      ],
      winners: [],
      everyone: true,
      met: true,
    };
    render(<StagePlay snapshot={lobby("reveal", play(question, { reveal }))} />);
    expect(screen.getByText("Over half took blue. Everyone lives.")).toBeTruthy();
  });

  it("selects and sends a choice for bin-unmasked, deed-poll and redacted-file", () => {
    const choiceRedacted: PlaySnapshot["question"] = {
      ...previewQuestions["bin-unmasked"],
      id: "real-name-tommy-robinson",
      presentation: "redacted-file",
      prompt: "What was their real name? Tommy Robinson",
      kind: "choice",
      speedBonus: false,
      modifiers: [],
      suppressSpeedBonus: false,
      options: [
        { id: "wayne-henderson", label: "Wayne Henderson" },
        { id: "darren-clarke-j", label: "Darren Clarke-Jones" },
        { id: "yaxley-lennon", label: "Stephen Yaxley-Lennon" },
        { id: "craig-thornton", label: "Craig Thornton" },
      ],
    };
    for (const [question, optionId, label, submitLabel] of [
      [
        previewQuestions["bin-unmasked"],
        "graham-ellis",
        "Graham Ellis",
        /submit nomination/i,
      ],
      [previewQuestions["deed-poll"], "daniel-rosen", "Daniel Rosen", /sign the deed/i],
      [choiceRedacted, "wayne-henderson", "Wayne Henderson", /submit to the file/i],
    ] as const) {
      const onSelect = vi.fn();
      const onSubmit = vi.fn();
      const view = phone(lobby("collect", play(question)), { onSelect, onSubmit });
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label, "i") }));
      expect(onSelect).toHaveBeenCalledWith(optionId);
      view.rerender(
        <GuestPlay
          snapshot={lobby("collect", play(question))}
          selectedId={optionId}
          pending={false}
          onSelect={onSelect}
          onSubmit={onSubmit}
          onEstimate={vi.fn()}
          onRank={vi.fn()}
          onText={vi.fn()}
          onBallot={vi.fn()}
          onDuel={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: submitLabel }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      view.unmount();

      const reveal = previewReveal(question, optionId, 2);
      const stage = render(
        <StagePlay snapshot={lobby("reveal", play(question, { reveal }))} />,
      );
      expect(stage.container.querySelector(".design-stage")).not.toBeNull();
      expect(stage.container.textContent).toContain(label);
      stage.unmount();
    }
  });

  it("falls back to the standard view when a design meets the wrong kind", () => {
    const typed = { ...previewQuestions["redacted-file"], presentation: "now-playing" };
    const view = phone(lobby("collect", play(typed)));
    expect(view.container.querySelector(".design-phone")).toBeNull();
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
  });

  it("ticks several countries on the executive order and signs them as one answer", () => {
    const onText = vi.fn();
    const question = previewQuestions["executive-order"];
    phone(lobby("collect", play(question)), { onText });
    const sign = screen.getByRole("button", { name: /sign it/i });
    expect(sign).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Baghdaddystan" }));
    fireEvent.click(
      screen.getByRole("button", { name: "The United States of Israel" }),
    );
    expect(screen.getByText(/2 countries invented/)).toBeTruthy();
    fireEvent.click(sign);
    expect(onText).toHaveBeenCalledWith(
      JSON.stringify(["baghdaddystan", "united-states-of-israel"]),
    );
  });

  it("stamps each line of the executive order at the reveal", () => {
    const question = previewQuestions["executive-order"];
    const reveal = previewReveal(question, undefined, 1);
    phone(lobby("reveal", play(question, { reveal })));
    expect(
      screen.getByRole("button", { name: "Baghdaddystan, not one of his" }),
    ).toBeTruthy();
  });

  it("uses transform-backed split fills on the red/blue pill stage reveal and keeps answers hidden in collect", () => {
    const pillQ = previewQuestions["red-blue-pill"];
    const collectStage = render(<StagePlay snapshot={lobby("collect", play(pillQ))} />);
    expect(collectStage.container.querySelector(".pill-split")).toBeNull();
    expect(collectStage.container.querySelector(".pill-flatline")).toBeNull();
    collectStage.unmount();

    const reveal = {
      kind: "choice" as const,
      correctOptionId: null,
      outcome: "threshold" as const,
      tally: [
        { optionId: "red", count: 44 },
        { optionId: "blue", count: 36 },
      ],
      winners: ["red"],
      everyone: false,
      met: false,
    };
    const revealStage = render(
      <StagePlay snapshot={lobby("reveal", play(pillQ, { reveal }))} />,
    );
    expect(revealStage.container.querySelectorAll(".pill-split-fill")).toHaveLength(2);
    expect(revealStage.container.querySelector(".pill-flatline")).not.toBeNull();
    expect(revealStage.container.textContent).toContain("55%");
    expect(revealStage.container.textContent).toContain("45%");
  });

  it("keeps live voters after the equalizer meter on the now-playing stage and pauses losing meters on reveal", () => {
    const npQ = previewQuestions["now-playing"];
    const voters = [
      { optionId: "white-girl", playerIds: ["p1"] },
      { optionId: "persona", playerIds: ["p2"] },
      { optionId: "flute", playerIds: [] },
      { optionId: "goat", playerIds: [] },
    ];
    const reveal = { kind: "choice" as const, correctOptionId: "white-girl" };
    const view = render(
      <StagePlay snapshot={lobby("reveal", play(npQ, { reveal, voters }))} />,
    );
    const tracks = [...view.container.querySelectorAll(".np-stage-track")];
    expect(tracks).toHaveLength(4);
    expect(tracks[0]?.querySelector(".np-meter-live")).not.toBeNull();
    expect(tracks[1]?.querySelector(".np-meter-live")).toBeNull();
    const children = [...(tracks[0]?.children ?? [])].map((el) => el.className);
    expect(children.indexOf("np-meter np-meter-live")).toBeLessThan(
      children.findIndex((c) => c.includes("design-voters")),
    );
  });
});
