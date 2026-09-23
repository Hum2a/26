import { expect, test } from "@playwright/test";
import { clientApiHeadersForTests } from "../../../scripts/e2e-client-api-key.ts";

test("a dense lobby and the host deck stay readable", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humza@localhost.test");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Create a lobby" }).click();
  await expect(page.getByText("The lobby is open.")).toBeVisible();
  const joinCode = (await page.locator("dd").first().textContent())?.trim() ?? "";

  const seeded = await page.evaluate(async (headers) => {
    const stored = sessionStorage.getItem("26-lobby");
    const lobby = stored ? (JSON.parse(stored) as { gameId?: string }) : {};
    const response = await fetch("/api/rooms/demo-cloud", {
      method: "POST",
      credentials: "same-origin",
      headers,
      body: JSON.stringify({
        gameId: lobby.gameId,
        requestId: crypto.randomUUID(),
      }),
    });
    return response.status;
  }, clientApiHeadersForTests({ "content-type": "application/json" }));
  expect(seeded).toBe(200);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({
    path: "test-results/host-deck-projector.png",
    fullPage: true,
  });
  const deckOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(deckOverflow).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/host-deck-phone.png", fullPage: true });
  const phoneDeckOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(phoneDeckOverflow).toBe(false);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/host?code=${joinCode}`);
  await page.getByRole("button", { name: "Show the lobby" }).click();
  await expect(page.getByText("Demo 75")).toBeVisible();
  await expect(page.getByText(/\/j\//)).toBeVisible();
  const stageOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(stageOverflow).toBe(false);
  await page.screenshot({ path: "test-results/lobby-projector.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const phoneStageOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(phoneStageOverflow).toBe(false);
  await page.screenshot({ path: "test-results/lobby-phone.png", fullPage: true });
});
