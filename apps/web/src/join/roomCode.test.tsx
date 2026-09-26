import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JoinRoomCode } from "./JoinRoomCode";
import { roomCodeFromQuery } from "./room-code";

describe("room code", () => {
  it("prefills from the room query and skips the code field", () => {
    expect(roomCodeFromQuery("k7m2qp")).toBe("K7M2QP");
    render(<JoinRoomCode roomQuery="k7m2qp" value="K7M2QP" onChange={() => {}} />);
    expect(screen.getByText("K7M2QP")).toBeTruthy();
    expect(screen.queryByLabelText("Join code")).toBeNull();
  });

  it("uppercases and rejects characters outside the room alphabet", () => {
    const onChange = vi.fn();
    render(<JoinRoomCode roomQuery={null} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Join code"), {
      target: { value: "ab0oI1z" },
    });
    expect(onChange).toHaveBeenCalledWith("ABZ");
  });
});
