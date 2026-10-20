import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PhonePreviewPanel } from "./phone-preview-panel";

it("keeps both real preview routes on the same selected question, phase and reset", () => {
  render(<PhonePreviewPanel version="birthday-draft" questionId="favourite-pokemon" />);
  const source = (title: string) => screen.getByTitle(title).getAttribute("src");
  expect(source("Big-screen preview")).toBe(
    "/admin/stage-preview/birthday-draft/favourite-pokemon?phase=collect&take=0",
  );
  expect(source("Interactive phone preview")).toBe(
    "/admin/phone-preview/birthday-draft/favourite-pokemon?phase=collect&take=0",
  );
  fireEvent.click(screen.getByRole("button", { name: "Get ready" }));
  expect(source("Big-screen preview")).toContain("phase=prompt&take=0");
  expect(source("Interactive phone preview")).toContain("phase=prompt&take=0");
  fireEvent.click(screen.getByRole("button", { name: "Reset preview" }));
  expect(source("Big-screen preview")).toContain("phase=prompt&take=1");
  expect(source("Interactive phone preview")).toContain("phase=prompt&take=1");
  fireEvent.change(screen.getByLabelText("Phone width"), { target: { value: "320" } });
  expect(source("Big-screen preview")).toContain("phase=prompt&take=1");
  expect(
    (screen.getByTitle("Interactive phone preview").parentElement as HTMLElement).style
      .maxWidth,
  ).toBe("320px");
  expect(
    screen.getByRole("link", { name: "Open big screen ↗" }).getAttribute("href"),
  ).toBe(source("Big-screen preview"));
  expect(
    screen.getByRole("link", { name: "Open at full size ↗" }).getAttribute("href"),
  ).toBe(source("Interactive phone preview"));
});

it("embeds an isolated viewport, changes phase/width and resets the rehearsal", () => {
  render(<PhonePreviewPanel version="fixture-pack" questionId="fixture" />);
  const frame = screen.getByTitle("Interactive phone preview") as HTMLIFrameElement;
  expect(frame.getAttribute("src")).toContain(
    "/admin/phone-preview/fixture-pack/fixture?phase=collect",
  );
  fireEvent.click(screen.getByRole("button", { name: "Get ready" }));
  expect(screen.getByTitle("Interactive phone preview").getAttribute("src")).toContain(
    "phase=prompt",
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset preview" }));
  expect(screen.getByTitle("Interactive phone preview").getAttribute("src")).toContain(
    "take=1",
  );
  fireEvent.change(screen.getByLabelText("Phone width"), { target: { value: "320" } });
  expect(
    (screen.getByTitle("Interactive phone preview").parentElement as HTMLElement).style
      .maxWidth,
  ).toBe("320px");
  expect(
    screen.getByRole("link", { name: /Open at full size/ }).getAttribute("target"),
  ).toBe("_blank");
});
