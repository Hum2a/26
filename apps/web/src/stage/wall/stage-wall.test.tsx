import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { StageWall } from "./stage-wall";

type Wall = NonNullable<LobbySnapshot["wall"]>;
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const now: NonNullable<Wall["now"]> = {
  postId: id(1),
  mediaId: id(2),
  nickname: "Amina",
  caption: "Cake o'clock",
  frame: "tabloid",
  untilAt: Date.now() + 8_000,
  reactions: [{ reaction: "fire", count: 3 }],
};

function wall(overrides: Partial<Wall> = {}): Wall {
  return {
    enabled: true,
    placement: "breaks",
    now: null,
    waiting: 0,
    next: null,
    ...overrides,
  };
}

describe("projector photo wall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("puts the photo in the spotlight in a break, with its frame, caption and reactions", () => {
    render(<StageWall wall={wall({ now })} gameId="ROOM" phase="scores" />);
    expect(screen.getByRole("region", { name: "Photo wall: Amina" })).toBeTruthy();
    const image = screen.getByRole("img", { name: "Cake o'clock, a photo from Amina" });
    expect(image.getAttribute("src")).toBe(`/api/rooms/ROOM/media/${id(2)}`);
    expect(screen.getByText("THE DAILY 26 · EXCLUSIVE")).toBeTruthy();
    expect(screen.getByLabelText("Reactions").textContent).toContain("3");
  });

  it("uses the corner during a question when the host chose corner placement", () => {
    render(
      <StageWall
        wall={wall({ now, placement: "corner", waiting: 2 })}
        gameId="ROOM"
        phase="collect"
      />,
    );
    expect(screen.queryByRole("region", { name: /Photo wall/ })).toBeNull();
    expect(screen.getByRole("img", { name: /a photo from Amina/ })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("2 waiting");
  });

  it("shows only a waiting count when nothing is on screen", () => {
    render(<StageWall wall={wall({ waiting: 4 })} gameId="ROOM" phase="collect" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("4 waiting");
  });

  it("preloads the next photo", () => {
    const created: { src: string }[] = [];
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        constructor() {
          created.push(this);
        }
      },
    );
    render(
      <StageWall
        wall={wall({ next: { mediaId: id(9) } })}
        gameId="ROOM"
        phase="lobby"
      />,
    );
    expect(created.map((image) => image.src)).toEqual([
      `/api/rooms/ROOM/media/${id(9)}`,
    ]);
  });
  it("only adds new reaction deltas, without replaying unchanged snapshots", () => {
    const view = render(
      <StageWall
        wall={wall({ now: { ...now, reactions: [] } })}
        gameId="ROOM"
        phase="scores"
      />,
    );
    const update = (count: number) =>
      view.rerender(
        <StageWall
          wall={wall({ now: { ...now, reactions: [{ reaction: "fire", count }] } })}
          gameId="ROOM"
          phase="scores"
        />,
      );
    update(2);
    expect(document.querySelectorAll(".wall-floater")).toHaveLength(2);
    update(2);
    expect(document.querySelectorAll(".wall-floater")).toHaveLength(2);
    update(3);
    expect(document.querySelectorAll(".wall-floater")).toHaveLength(3);
  });
});
