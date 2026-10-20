import { expect, test } from "@playwright/test";

test("three new inflation questions use the actual isolated phone rehearsal", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.goto("/admin/phone-preview/birthday-draft/inflation-meal-deal");
  await page.getByRole("link", { name: "Admin sign in →" }).click();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const sockets: string[] = [];
  page.on("websocket", (socket) => {
    // Each full-page navigation reconnects Vite HMR at /?token=… in development.
    const url = new URL(socket.url());
    if (url.pathname === "/" && url.searchParams.has("token")) return;
    sockets.push(socket.url());
  });
  for (const [id, heading, baseline] of [
    ["inflation-meal-deal", "The student tasting menu", "£3 in 2012"],
    ["inflation-sausage-roll", "The Greggs gold standard", "66p in 2012"],
    ["inflation-cheeseburger", "The 99p nostalgia tax", "99p in 2012"],
  ]) {
    await page.goto(`/admin/phone-preview/birthday-draft/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading!);
    await expect(page.getByText(baseline!, { exact: false })).toBeVisible();
    const payload = await page.request.get(
      `/api/admin/content/birthday-draft/questions/${id}/preview`,
    );
    const body = await payload.json();
    for (const field of ["truth", "bands", "notes", "explanation"])
      expect(body.question).not.toHaveProperty(field);
    const slider = page.getByRole("slider", { name: "Estimate" });
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(slider).toBeVisible();
      await expect(page.getByRole("button", { name: "Send estimate" })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
    }
    await page.getByRole("button", { name: "Pause preview" }).click();
    await expect(slider).toBeDisabled();
    await page.getByRole("button", { name: "Resume preview" }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await slider.press("ArrowRight");
    await page.getByRole("button", { name: "Send estimate" }).click();
    await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
  }
  expect(sockets).toEqual([]);
});
