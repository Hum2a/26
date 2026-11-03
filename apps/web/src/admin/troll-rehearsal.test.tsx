import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { TrollRehearsal } from "./troll-rehearsal";

const steal = {
  kind: "steal",
  label: "Steal",
  assetLabel: "Half your points, taken",
  slot: "persistent" as const,
  durationMs: null,
  phases: ["collect", "vote", "predict"],
  escape: null,
  disruptsSubmission: false,
  announce: "now" as const,
  questionKinds: ["choice"],
  modifier: true,
};

it("draws the real target banner and guides a live check for a points troll", () => {
  render(
    <MemoryRouter>
      <TrollRehearsal troll={steal} />
    </MemoryRouter>,
  );
  const banner = screen.getByRole("status", { name: "Half your points, taken" });
  expect(banner.textContent).toContain("Steal");
  expect(banner.textContent).toContain("Someone is stealing half your points");
  expect(banner.textContent).toContain("From Sample troller");
  expect(screen.getByText(/scored multiple-choice question/)).toBeTruthy();
  expect(screen.getByText(/Watch the scores at the reveal/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "/join" }).getAttribute("href")).toBe("/join");
});
