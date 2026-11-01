import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { NotFoundPage } from "./not-found-page";
it("offers real routes back to the party without development navigation", () => {
  render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "That page isn’t here." })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Join the room" }).getAttribute("href")).toBe(
    "/join",
  );
  expect(
    screen.getByRole("link", { name: "Back to the party" }).getAttribute("href"),
  ).toBe("/");
  expect(screen.queryByText(/Development shell/i)).toBeNull();
  expect(screen.queryByRole("link", { name: "Results" })).toBeNull();
});
