import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SoloKartPage } from "./solo-page";
import { PhonePreviewPanel } from "../admin/phone-preview-panel";

it("hosts the isolated engine on this site without requiring room credentials", () => {
  render(<SoloKartPage />);
  expect(screen.getByTitle("Solo kart practice").getAttribute("src")).toBe(
    "/kart-engine/index.html",
  );
  expect(document.title).toBe("26 · Solo kart practice");
});
it("links kart rehearsal to playable solo practice without changing its preview contract", () => {
  render(<PhonePreviewPanel version="birthday-draft" questionId="kart-sprint" />);
  const link = screen.getByRole("link", { name: "Play standalone kart ↗" });
  expect(link.getAttribute("href")).toBe("/kart");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(screen.getByTitle("Interactive phone preview").getAttribute("src")).toContain(
    "/admin/phone-preview/birthday-draft/kart-sprint",
  );
});
it("keeps solo kart out of other question rehearsals", () => {
  render(<PhonePreviewPanel version="birthday-draft" questionId="favourite-pokemon" />);
  expect(screen.queryByRole("link", { name: "Play standalone kart ↗" })).toBeNull();
});
