import { fireEvent, render, screen } from "@testing-library/react";
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

describe("a photo that fails to load on the projector", () => {
  it("shows the failed card and reports the post once, then the next post once", async () => {
    const onImageFailed = vi.fn();
    const view = render(
      <StageWall
        wall={wall({ now })}
        gameId="ROOM"
        phase="scores"
        onImageFailed={onImageFailed}
      />,
    );
    const image = screen.getByRole("img", { name: /a photo from Amina/ });
    fireEvent.error(image);
    expect(screen.getByText("This photo could not be shown.")).toBeTruthy();
    expect(onImageFailed).toHaveBeenCalledTimes(1);
    expect(onImageFailed).toHaveBeenCalledWith(id(1));
    // The same post re-rendered (a new snapshot) does not report again.
    view.rerender(
      <StageWall
        wall={wall({ now: { ...now, reactions: [] } })}
        gameId="ROOM"
        phase="scores"
        onImageFailed={onImageFailed}
      />,
    );
    expect(onImageFailed).toHaveBeenCalledTimes(1);
    view.unmount();
    // The room moves on to another post, which is broken too. (Corner placement:
    // jsdom cannot run the spotlight's keyframed spring, so its exit never ends.)
    const corner = render(
      <StageWall
        wall={wall({ now, placement: "corner" })}
        gameId="ROOM"
        phase="collect"
        onImageFailed={onImageFailed}
      />,
    );
    const next = { ...now, postId: id(3), mediaId: id(4), nickname: "Bilal" };
    corner.rerender(
      <StageWall
        wall={wall({ now: next, placement: "corner" })}
        gameId="ROOM"
        phase="collect"
        onImageFailed={onImageFailed}
      />,
    );
    // The outgoing photo finishes its exit before the next one mounts.
    fireEvent.error(await screen.findByRole("img", { name: /a photo from Bilal/ }));
    expect(onImageFailed).toHaveBeenLastCalledWith(id(3));
    expect(onImageFailed).toHaveBeenCalledTimes(2);
  });

  it("reports nothing for a healthy photo, or where no projector callback is given", () => {
    const onImageFailed = vi.fn();
    const view = render(
      <StageWall
        wall={wall({ now })}
        gameId="ROOM"
        phase="scores"
        onImageFailed={onImageFailed}
      />,
    );
    fireEvent.load(screen.getByRole("img", { name: /a photo from Amina/ }));
    expect(onImageFailed).not.toHaveBeenCalled();
    view.unmount();
    // A guest's or the host's preview has no callback: a failure only shows the card.
    render(<StageWall wall={wall({ now })} gameId="ROOM" phase="scores" />);
    fireEvent.error(screen.getByRole("img", { name: /a photo from Amina/ }));
    expect(screen.getByText("This photo could not be shown.")).toBeTruthy();
  });

  it("drops an error from an image that has already left the screen", () => {
    const onImageFailed = vi.fn();
    const view = render(
      <StageWall
        wall={wall({ now })}
        gameId="ROOM"
        phase="scores"
        onImageFailed={onImageFailed}
      />,
    );
    const image = screen.getByRole("img", { name: /a photo from Amina/ });
    view.unmount();
    fireEvent.error(image);
    expect(onImageFailed).not.toHaveBeenCalled();
  });
});

describe("the failed-photo card", () => {
  it("tells the projector it is moving on, and guests or the host only that it failed", () => {
    const view = render(
      <StageWall
        wall={wall({ now })}
        gameId="ROOM"
        phase="scores"
        onImageFailed={vi.fn()}
      />,
    );
    fireEvent.error(screen.getByRole("img", { name: /a photo from Amina/ }));
    expect(screen.getByText("This photo could not be shown.")).toBeTruthy();
    expect(screen.getByText("Moving on in a moment.")).toBeTruthy();
    view.unmount();
    render(<StageWall wall={wall({ now })} gameId="ROOM" phase="scores" />);
    fireEvent.error(screen.getByRole("img", { name: /a photo from Amina/ }));
    expect(screen.getByText("This photo could not be shown.")).toBeTruthy();
    expect(screen.queryByText("Moving on in a moment.")).toBeNull();
  });

  it("reports a photo once however many error events it fires", () => {
    const onImageFailed = vi.fn();
    render(
      <StageWall
        wall={wall({ now, placement: "corner" })}
        gameId="ROOM"
        phase="collect"
        onImageFailed={onImageFailed}
      />,
    );
    const image = screen.getByRole("img", { name: /a photo from Amina/ });
    fireEvent.error(image);
    fireEvent.error(image);
    expect(onImageFailed).toHaveBeenCalledTimes(1);
  });

  it("never lets a late error from the previous photo report the next one", async () => {
    const onImageFailed = vi.fn();
    const view = render(
      <StageWall
        wall={wall({ now, placement: "corner" })}
        gameId="ROOM"
        phase="collect"
        onImageFailed={onImageFailed}
      />,
    );
    const previous = screen.getByRole("img", { name: /a photo from Amina/ });
    const next = { ...now, postId: id(5), mediaId: id(6), nickname: "Chen" };
    view.rerender(
      <StageWall
        wall={wall({ now: next, placement: "corner" })}
        gameId="ROOM"
        phase="collect"
        onImageFailed={onImageFailed}
      />,
    );
    const current = await screen.findByRole("img", { name: /a photo from Chen/ });
    fireEvent.error(previous);
    expect(onImageFailed).not.toHaveBeenCalled();
    // Chen's photo still loads normally and is never reported.
    fireEvent.load(current);
    expect(onImageFailed).not.toHaveBeenCalled();
    expect(screen.queryByText("This photo could not be shown.")).toBeNull();
  });
});
