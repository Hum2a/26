import { expect, test } from "@playwright/test";

test("home provides distinct join and admin journeys", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little older.",
  );
  await page.getByRole("link", { name: "Join the party →", exact: true }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByLabel("Join code")).toBeVisible();
  await page.getByRole("link", { name: "Admin sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByLabel("Administrator email")).toHaveValue("");
  await expect(page.getByLabel("Administrator email")).toBeEnabled();
  // The request is bounded at 12s, including a fresh local database's first start.
  await expect(page.getByText("Checking the administrator session.")).toHaveCount(0, {
    timeout: 15_000,
  });
});

test("old QR and query links preserve their code", async ({ page }) => {
  await page.goto("/?room=ABCDEF");
  await expect(page).toHaveURL(/\/join\?room=ABCDEF$/);
  await expect(page.getByText("ABCDEF", { exact: true })).toBeVisible();
  await page.goto("/j/GHJKLM");
  await expect(page.getByText("GHJKLM", { exact: true })).toBeVisible();
});

test("email confirmation is explicit and an existing session skips login", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  const confirmation = page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first();
  await expect(confirmation).toBeVisible();
  // Opening the email in another tab still uses the existing confirmation flow.
  const href = await confirmation.getAttribute("href");
  const emailTab = await context.newPage();
  await emailTab.goto(href!);
  await expect(
    emailTab.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(
    emailTab.getByText("This page does not sign you in until you confirm."),
  ).toBeVisible();
  await emailTab.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(emailTab).toHaveURL(/\/admin$/);
  await expect(emailTab.getByRole("button", { name: "Create a lobby" })).toBeVisible();
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByLabel("Administrator email")).toBeEnabled();
});

test("entry pages fit phones, tablets and desktop with reduced motion", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const path of ["/", "/join", "/admin/login"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".entry-main")).toHaveCSS("opacity", "1");
      if (path === "/join")
        await expect(page.getByText("Checking for your game…")).toHaveCount(0);
      if (path === "/admin/login")
        await expect(page.getByText("Checking the administrator session.")).toHaveCount(
          0,
        );
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      ).toBe(true);
      if (width === 390 || width === 1920) {
        const name = path === "/" ? "home" : path === "/join" ? "join" : "login";
        await page.screenshot({
          path: `.codex/previews/admin-redesign/${name}-${width}.png`,
          fullPage: true,
        });
      }
      if (path === "/join") {
        const bounds = await page.getByLabel("Nickname").boundingBox();
        expect(bounds!.width).toBeLessThanOrEqual(540);
      }
    }
  }
});

test("expired confirmation offers a new link", async ({ page }) => {
  await page.goto("/admin/confirm?token=expired-token");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
  await page.getByRole("link", { name: "Request a new link" }).click();
  await expect(page.getByLabel("Administrator email")).toBeVisible();
});
