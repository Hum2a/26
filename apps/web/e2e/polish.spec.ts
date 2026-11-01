import { expect, test, type Route } from "@playwright/test";

test("recovery screens fit phones and distinguish loading from an unavailable archive", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 430, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/missing-party-screen");
    await expect(
      page.getByRole("heading", { name: "That page isn’t here." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Join the room" })).toHaveAttribute(
      "href",
      "/join",
    );
    await expect(page.getByText(/Development shell/)).toHaveCount(0);
    await expect(page.locator("main#content")).toHaveCSS("opacity", "1");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `.codex/previews/polish/recovery-${viewport.width}.png`,
      fullPage: true,
    });
  }
  let held: Route | undefined;
  await page.route("**/api/rooms/ABCDEFGH/results", (route) => {
    held = route;
  });
  await page.goto("/r/ABCDEFGH");
  await expect(
    page.getByRole("heading", { name: "Checking the archive…" }),
  ).toBeVisible();
  await expect(page.getByText(/archive could not be loaded/)).toHaveCount(0);
  await expect.poll(() => !!held).toBe(true);
  await held!.fulfill({ json: { state: "preparing" } });
  await expect(page.getByRole("heading", { name: "Preparing results." })).toBeVisible();
  await expect(page.locator(".results-body")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: ".codex/previews/polish/results-after.png",
    fullPage: true,
  });
});

test("admin leads with rooms, retains folded rehearsal edits and shares the exact guest URL", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const create = page.getByRole("button", { name: "Create a lobby", exact: true });
  await expect(create).toBeEnabled();
  expect(
    await create.evaluate(
      (element) => element.getBoundingClientRect().bottom <= innerHeight,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("spinbutton", { name: "Rehearsal bot count" }),
  ).toHaveCount(0);
  const fold = page.getByRole("button", { name: /Rehearse without guests/ });
  await fold.click();
  await page.getByRole("spinbutton", { name: "Rehearsal bot count" }).fill("25");
  await fold.click();
  await fold.click();
  await expect(
    page.getByRole("spinbutton", { name: "Rehearsal bot count" }),
  ).toHaveValue("25");
  await fold.click();
  await create.click();
  await page.getByRole("button", { name: "Show guest QR code" }).click();
  const link = await page
    .getByRole("textbox", { name: "Guest join link" })
    .inputValue();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy guest link" }).click();
  await expect(page.getByText("Link copied. Ready to share.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await expect(page.getByRole("button", { name: "Copy guest link" })).toBeVisible();
    await page
      .getByRole("dialog")
      .screenshot({ path: `.codex/previews/polish/share-${width}.png` });
  }
});
