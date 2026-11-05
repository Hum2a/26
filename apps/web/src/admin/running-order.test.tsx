import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { RunningOrder } from "./running-order";
import { saveRunningOrder } from "./sections-api";
vi.mock("./sections-api", () => ({ saveRunningOrder: vi.fn() }));
it("moves and removes rounds, excludes drafts, and retries the same save receipt", async () => {
  const order = {
    revision: 2,
    ids: ["first", "kart-sprint"],
    updatedAt: null,
    history: [],
  };
  const questions = [
    ["first", "First", "ready"],
    ["kart-sprint", "Kart", "ready"],
    ["extra", "Extra", "ready"],
    ["draft", "Draft", "draft"],
  ].map(([id, title, status]) => ({
    id: id!,
    title: title!,
    status: status as "ready" | "draft",
    prompt: "Fixture",
    mechanic: "kart" as const,
    presentation: "standard" as const,
    order: null,
    missing: [],
  }));
  vi.mocked(saveRunningOrder)
    .mockResolvedValueOnce({ error: "Connection interrupted" })
    .mockResolvedValueOnce({ ...order, revision: 3, ids: ["kart-sprint", "first"] });
  render(
    <MemoryRouter>
      <RunningOrder
        pack={{
          id: "birthday",
          version: "birthday-draft",
          release: "draft",
          illustrative: false,
          questions,
          runningOrder: order,
        }}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Move Kart up" }));
  fireEvent.click(screen.getByRole("button", { name: "Save running order" }));
  await screen.findByText("Connection interrupted");
  fireEvent.click(screen.getByRole("button", { name: "Save running order" }));
  await screen.findByText(/Running order saved/);
  expect(vi.mocked(saveRunningOrder).mock.calls[0]).toEqual(
    vi.mocked(saveRunningOrder).mock.calls[1],
  );
  expect(vi.mocked(saveRunningOrder).mock.calls[0]![0]).toMatchObject({
    expectedRevision: 2,
    ids: ["kart-sprint", "first"],
  });
  fireEvent.click(screen.getByRole("button", { name: /Add a round/ }));
  expect(screen.queryByRole("button", { name: "Add Draft" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add Extra" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Remove Extra from running order" }),
    ).toBeTruthy(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Extra from running order" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Remove First from running order" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(
    screen.getByRole("button", { name: "Remove First from running order" }),
  ).toBeTruthy();
});

it("shows the show length, flags clusters and suggests a mixed order without saving", async () => {
  vi.mocked(saveRunningOrder).mockReset();
  const ids = [
    "council-a",
    "council-b",
    "council-c",
    "trolley-a",
    "trolley-b",
    "kart-sprint",
  ];
  const questions = ids.map((id) => ({
    id,
    title: id,
    status: "ready" as const,
    prompt: "Fixture",
    mechanic: id === "kart-sprint" ? "kart" : "choice",
    presentation: "standard" as const,
    estimatedSeconds: 60,
    order: null,
    missing: [],
  }));
  render(
    <MemoryRouter>
      <RunningOrder
        pack={{
          id: "birthday",
          version: "birthday-draft",
          release: "draft",
          illustrative: false,
          questions,
          runningOrder: { revision: 1, ids, updatedAt: null, history: [] },
        }}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Show length about 6 min/)).toBeTruthy();
  expect(screen.getByText(/3 “council” rounds run back to back/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Suggest a mixed order" }));
  await screen.findByText(/Suggested a mixed order/);
  expect(screen.queryByText(/run back to back/)).toBeNull();
  expect(screen.getByText(/Unsaved changes/)).toBeTruthy();
  expect(saveRunningOrder).not.toHaveBeenCalled();
});
