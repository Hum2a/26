import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PhonePreviewPanel } from "../admin/phone-preview-panel";
import { SoloChessPage } from "./solo-page";

vi.mock("./chess-game", () => ({
  ChessGame: () => <div>Solo chess board</div>,
}));
vi.mock("./chess-clocks", () => ({
  ChessClocks: () => <div>Clocks</div>,
}));

it("hosts a solo chess game without requiring room credentials", () => {
  render(<SoloChessPage />);
  expect(screen.getByRole("heading", { name: "Chess vs the Humza bot" })).toBeTruthy();
  expect(document.title).toBe("26 · Solo chess practice");
  expect(screen.getByRole("link", { name: "← 26" }).getAttribute("href")).toBe("/");
});

it("links chess rehearsal to playable solo practice without changing its preview contract", () => {
  render(<PhonePreviewPanel version="birthday-draft" questionId="chess-battle" />);
  const link = screen.getByRole("link", { name: "Play standalone chess ↗" });
  expect(link.getAttribute("href")).toBe("/chess");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(screen.getByTitle("Interactive phone preview").getAttribute("src")).toContain(
    "/admin/phone-preview/birthday-draft/chess-battle",
  );
});

it("keeps solo chess out of other question rehearsals", () => {
  render(<PhonePreviewPanel version="birthday-draft" questionId="favourite-pokemon" />);
  expect(screen.queryByRole("link", { name: "Play standalone chess ↗" })).toBeNull();
});
