import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { RouteError } from "./route-error";
import { isStaleBuildError, reloadForNewBuild } from "./stale-build";

beforeEach(() => {
  sessionStorage.clear();
});

it("recognises a stale build's missing code file", () => {
  expect(
    isStaleBuildError(
      new TypeError(
        "Failed to fetch dynamically imported module: https://26.humza.website/assets/kart-page-old.js",
      ),
    ),
  ).toBe(true);
  expect(isStaleBuildError(new TypeError("Importing a module script failed."))).toBe(
    true,
  );
  expect(isStaleBuildError(new Error("Cannot read properties of undefined"))).toBe(
    false,
  );
});

it("reloads once, then leaves a repeated failure to the person", () => {
  const reload = vi.fn();
  expect(reloadForNewBuild(1_000, reload)).toBe(true);
  expect(reloadForNewBuild(5_000, reload)).toBe(false);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(reloadForNewBuild(40_000, reload)).toBe(true);
  expect(reload).toHaveBeenCalledTimes(2);
});

function mountFailing(message: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/admin/kart",
        ErrorBoundary: RouteError,
        lazy: async () => {
          throw new TypeError(message);
        },
      },
    ],
    { initialEntries: ["/admin/kart"] },
  );
  render(<RouterProvider router={router} />);
}

it("explains an update and offers a reload when the automatic one already ran", async () => {
  // A reload just happened, so the screen must not loop.
  sessionStorage.setItem("26-stale-build-reload", String(Date.now()));
  mountFailing("Failed to fetch dynamically imported module: /assets/kart-page-old.js");
  expect(
    await screen.findByRole("heading", { name: "26 has just been updated." }),
  ).toBeTruthy();
  expect(
    ((await screen.findByRole("button", { name: "Reload" })) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(screen.queryByText(/dynamically imported/)).toBeNull();
});

it("keeps other failures calm and without developer detail", async () => {
  mountFailing("Something private went wrong");
  expect(
    await screen.findByRole("heading", { name: "That screen didn’t load." }),
  ).toBeTruthy();
  expect(screen.queryByText(/private/)).toBeNull();
});
