import { expect, test } from "@playwright/test";

test("guest shell stays a development screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Guest · 26");
  await expect(page.getByRole("heading", { level: 1, name: "Guest" })).toBeVisible();
  await expect(page.getByText("Enter the join code and a nickname.")).toBeVisible();
  await expect(page.getByLabel("Nickname")).toBeEnabled();
  await expect(page.getByRole("status")).toContainText("You have not joined a room.");

  await page.getByRole("button", { name: "About this build" }).click();
  const dialog = page.getByRole("dialog", { name: "About this build" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "About this build" })).toBeFocused();
});

test("guest shell fits a phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Guest" })).toBeVisible();
  await expect(page.getByLabel("Nickname")).toBeEnabled();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
});

test("stage shell is a preview, not a live round", async ({ page }) => {
  await page.goto("/host");
  await expect(page).toHaveTitle("Stage · 26");
  await expect(page.getByRole("heading", { level: 1, name: "Stage" })).toBeVisible();
  await expect(page.getByText("No room is connected.")).toBeVisible();
  await expect(page.getByText("Preview only. No round is running.")).toBeVisible();
  const fontSize = await page
    .getByRole("heading", { level: 1, name: "Stage" })
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThan(48);
});

test("admin can request a local sign-in link and confirm it", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveTitle("Admin · 26");
  await expect(page.getByLabel("Administrator email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /pause|advance|recover/i }),
  ).toHaveCount(0);

  await page.getByLabel("Administrator email").fill("humza@localhost.test");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If this address is the administrator, a sign-in link is ready.",
  );
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await expect(page).toHaveTitle("Confirm sign-in · 26");
  await expect(page.getByRole("status")).toContainText(
    "This page does not sign you in until you confirm.",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toContainText(
    "You are signed in as humza@localhost.test.",
  );
  await expect(
    page.getByText("Create a lobby, then start the demo quiz."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /pause|advance|recover/i }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("status")).toContainText("You are signed out.");
  await expect(page.getByLabel("Administrator email")).toBeVisible();
});

test("an administrator can open a lobby and a guest can join it", async ({ page }) => {
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
  expect(joinCode).toHaveLength(6);

  await page.goto("/");
  await page.getByLabel("Join code").fill(joinCode);
  await page.getByLabel("Nickname").fill("Amina");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("status")).toContainText(
    "You are in. This phone is Amina.",
  );
  await expect(page.getByText("Connected to the lobby.")).toBeVisible();

  await page.goto(`/host?code=${joinCode}`);
  await page.getByRole("button", { name: "Show the lobby" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Amina" })).toBeVisible();
  await expect(page.getByText("No round is running.")).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Transfer Amina" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Advance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recover" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Media cue. Not in this build." }),
  ).toBeDisabled();
});

test("results shell distinguishes a shaped id from other text", async ({ page }) => {
  await page.goto("/r/ABCDEFGH");
  await expect(page).toHaveTitle("Results · 26");
  await expect(page.getByText("Results for ABCDEFGH are not available.")).toBeVisible();
  await expect(page.getByText("The results archive is not built yet")).toBeVisible();

  await page.goto("/r/nope");
  await expect(page.getByText("This address is not a game id.")).toBeVisible();
  await expect(page.getByText("Results lookup is not built yet.")).toBeVisible();
});
