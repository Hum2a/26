import { expect, test } from "@playwright/test";

test("guest shell is the phone join screen", async ({ page }) => {
  await page.goto("/join");
  await expect(page).toHaveTitle("Guest · 26");
  await expect(
    page.getByRole("heading", { level: 1, name: "Join the room" }),
  ).toBeVisible();
  await expect(page.getByText("Enter the join code and a nickname.")).toBeVisible();
  await expect(page.getByLabel("Nickname")).toBeEnabled();
  await expect(page.getByText("You have not joined a room.")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Surfaces" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Join" })).toBeVisible();

  await page.getByRole("button", { name: "About this game" }).click();
  const dialog = page.getByRole("dialog", { name: "About this game" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "About this game" })).toBeFocused();
});

test("guest shell fits a phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/join");
  await expect(
    page.getByRole("heading", { level: 1, name: "Join the room" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nickname")).toBeEnabled();
  await expect(page.getByRole("navigation", { name: "Surfaces" })).toHaveCount(0);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
});

test("stage shell is a preview, not a live round", async ({ page }) => {
  await page.goto("/host");
  await expect(page).toHaveTitle("Projector setup · 26");
  await expect(
    page.getByRole("heading", { level: 1, name: "Projector setup" }),
  ).toBeVisible();
  await expect(page.getByText("No room is connected.")).toBeVisible();
  await expect(page.getByText("Preview only. No round is running.")).toBeVisible();
  const fontSize = await page
    .getByRole("heading", { level: 1, name: "Projector setup" })
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThan(48);
});

test("admin can request a local sign-in link and confirm it", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveTitle("Admin sign in · 26");
  await expect(page.getByLabel("Administrator email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /pause|advance|recover/i }),
  ).toHaveCount(0);

  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If this is the administrator address, a sign-in email has been requested.",
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
  await expect(
    page.getByRole("status").filter({ hasText: "You are signed in as" }),
  ).toContainText("You are signed in as humzab1711@hotmail.com.");
  await expect(
    page.getByText(
      "Pick up where you left off, or open a fresh lobby for the guests. Creating or switching rooms selects one room for this browser, including its stage access.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /pause|advance|recover/i }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByLabel("Administrator email")).toBeVisible();
});

test("an administrator can open a lobby and a guest can join it", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Create a lobby" }).click();
  await expect(
    page.getByRole("heading", { name: "Ready for the room." }),
  ).toBeVisible();
  const joinCode = (await page.locator(".admin-room-code").textContent())?.trim() ?? "";
  expect(joinCode).toHaveLength(6);

  await page.goto("/join");
  await page.getByLabel("Join code").fill(joinCode);
  await page.getByLabel("Nickname").fill("Amina");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("status")).toContainText(
    "You are in. This phone is Amina.",
  );
  await expect(page.getByRole("heading", { name: "In the lobby" })).toBeVisible();
  await expect(page.getByText("Connected", { exact: true })).toBeAttached();
  await expect(page.getByText("Connected to the lobby.")).toHaveCount(0);

  await page.goto(`/host?code=${joinCode}`);
  await page.getByRole("button", { name: "Connect room" }).click();
  await page.getByRole("button", { name: "Present on this screen" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Amina" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "In the lobby" })).toBeVisible();

  await page.goto("/admin");
  await page.getByRole("link", { name: "Return to room" }).click();
  await page.getByRole("link", { name: "Live controls", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start the illustrative demo" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Advance", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Players", exact: true }).click();
  await page.getByRole("button", { name: /^Select Amina,/ }).click();
  await page.getByRole("button", { name: "Phones", exact: true }).click();
  await expect(page.getByRole("button", { name: "Transfer Amina" })).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Amina" })).toBeVisible();
  await page.getByRole("button", { name: "Score", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review score change" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Media cue. Not in this build." }),
  ).toHaveCount(0);
});

test("results shell distinguishes a shaped id from other text", async ({ page }) => {
  await page.goto("/r/ABCDEFGH");
  await expect(page).toHaveTitle("Results · 26");
  await expect(
    page.getByRole("heading", { name: "Results are unavailable." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This game may still be running, or the archive could not be loaded. Check the game link and try again.",
    ),
  ).toBeVisible();

  await page.goto("/r/nope");
  await expect(page.getByRole("heading", { name: "Check this address" })).toBeVisible();
  await expect(
    page.getByText("Open the results link shared for your game."),
  ).toBeVisible();
});
