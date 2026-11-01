import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { Disclosure } from "./primitives";
it("makes an outgoing panel inert immediately", async () => {
  render(
    <Disclosure title="Details">
      <button>Panel action</button>
    </Disclosure>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Details/ }));
  const action = screen.getByRole("button", { name: "Panel action" });
  fireEvent.click(screen.getByRole("button", { name: /Details/ }));
  expect(action.closest("[inert]")?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.queryByRole("button", { name: "Panel action" })).toBeNull();
  await waitFor(() => expect(screen.queryByText("Panel action")).toBeNull());
});
it("preserves unfinished input when a persistent panel closes", () => {
  render(
    <Disclosure title="Settings" keepMounted>
      <input aria-label="Draft" />
    </Disclosure>,
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Evening rehearsal" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
    "Evening rehearsal",
  );
});
