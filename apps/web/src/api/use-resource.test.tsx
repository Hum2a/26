import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useSection } from "./use-resource";
it("ignores an older response after changing the resource", async () => {
  let resolveOld!: (value: { name: string }) => void;
  const old = vi.fn(
    () =>
      new Promise<{ name: string }>((resolve) => {
        resolveOld = resolve;
      }),
  );
  const current = vi.fn(async () => ({ name: "Current" }));
  const hook = renderHook(({ read }) => useSection(read), {
    initialProps: { read: old as () => Promise<{ name: string }> },
  });
  await waitFor(() => expect(old).toHaveBeenCalledTimes(1));
  hook.rerender({ read: current });
  await waitFor(() => expect(hook.result.current.data?.name).toBe("Current"));
  await act(async () => resolveOld({ name: "Stale" }));
  expect(hook.result.current.data?.name).toBe("Current");
});
