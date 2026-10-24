import { expect, test } from "@playwright/test";

// Front-end checks use explicit signed-out session fixtures; live game and
// authentication behaviours remain covered by their existing browser suites.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({ json: { signedIn: false } }),
  );
  await page.route("**/api/rooms/session", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
});

for (const [path, heading, scriptBudget] of [
  ["/", "A little older.", 700_000],
  ["/join", "Join the room", 950_000],
  ["/host", "Projector setup", 850_000],
  ["/admin/login", "Admin sign in", 710_000],
] as const) {
  test(`keeps ${path} within its cold script budget`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(
      heading,
    );
    await page.waitForLoadState("networkidle");
    const scripts = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => new URL(entry.name).pathname.endsWith(".js"))
        .map((entry) => ({
          name: entry.name,
          bytes: (entry as PerformanceResourceTiming).decodedBodySize,
        })),
    );
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.reduce((sum, script) => sum + script.bytes, 0)).toBeGreaterThan(0);
    expect(scripts.reduce((sum, script) => sum + script.bytes, 0)).toBeLessThan(
      scriptBudget,
    );
    expect(
      scripts.some((script) =>
        /(?:content-page|analytics-page|kart-page|KartCanvas)-/.test(script.name),
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });
}

test("preserves joining and back navigation after loading routes separately", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Join the party/ }).click();
  await expect(page.getByRole("heading", { name: "Join the room" })).toBeVisible();
  await expect(page.getByLabel("Join code")).toBeEnabled();
  await page.goBack();
  await expect(page.getByRole("link", { name: /Join the party/ })).toBeVisible();
  await page.getByRole("link", { name: "Admin sign in" }).first().click();
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
});

for (const [width, height] of [
  [320, 740],
  [390, 844],
  [430, 932],
  [844, 390],
]) {
  test(`keeps the join controls usable at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto("/join");
    await expect(page.getByRole("button", { name: "Join", exact: true })).toBeVisible();
    await expect(page.getByLabel("Nickname")).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    ).toBe(false);
  });
}
