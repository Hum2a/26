import { expect, test, type Page } from "@playwright/test";

/**
 * A wall photo whose image never arrives on the projector: no load, no error.
 * After four seconds the projector shows its "could not be shown" card and
 * tells the room, the wall moves on, the next photo shows normally, and only
 * the host is told "Couldn't display".
 */
test("a projector photo that never loads times out, moves on and is flagged to the host only", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const host = await browser.newContext();
  const phones = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const secondPhone = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const admin = await host.newPage();
  const stage = await host.newPage();
  const amina = await phones.newPage();
  const bilal = await secondPhone.newPage();

  await signIn(admin);
  await admin.getByRole("button", { name: "Create a lobby" }).click();
  await expect(
    admin.getByRole("heading", { name: "Ready for the room." }),
  ).toBeVisible();
  const joinCode =
    (await admin.locator(".admin-room-code").textContent())?.trim() ?? "";
  expect(joinCode).toHaveLength(6);

  await stage.goto(`/host?code=${joinCode}`);
  await stage.getByRole("button", { name: "Connect room" }).click();
  await stage.getByRole("button", { name: "Present on this screen" }).click();
  await expect(stage.getByRole("heading", { name: "In the lobby" })).toBeVisible();
  await join(amina, joinCode, "Amina");
  await join(bilal, joinCode, "Bilal");
  await send(amina, "Stuck photo");
  await send(bilal, "Healthy photo");

  await admin.getByRole("link", { name: "Photo wall", exact: true }).click();
  const stuckCard = admin.getByRole("article", { name: "Amina's photo" });
  // Pin the held path to Amina's media so a Preload of the next photo cannot
  // claim the hang, and so the route is not active during projector setup.
  const stuckPath = new URL(
    (await stuckCard.locator("img").getAttribute("src")) ?? "",
    "http://localhost:4173",
  ).pathname;
  expect(stuckPath).toMatch(/\/api\/rooms\/[^/]+\/media\//);
  await stage.route(/\/api\/rooms\/[^/]+\/media\//, async (route) => {
    const url = new URL(route.request().url()).pathname;
    if (url === stuckPath) return; // Never fulfilled: no load and no error.
    await route.continue();
  });

  await stuckCard.getByRole("button", { name: "Approve" }).click();
  await expect(stage.getByRole("img", { name: /Stuck photo/ })).toBeVisible();
  // Nothing is reported while the four seconds run.
  await stage.waitForTimeout(2_500);
  await expect(stage.getByText("This photo could not be shown.")).toHaveCount(0);
  await expect(stage.getByText("This photo could not be shown.")).toBeVisible({
    timeout: 4_000,
  });
  await expect(stage.getByText("Moving on in a moment.")).toBeVisible();

  // The room moved it on; the next photo gets its normal turn and loads.
  await admin
    .getByRole("article", { name: "Bilal's photo" })
    .getByRole("button", { name: "Approve" })
    .click();
  const healthy = stage.getByRole("img", { name: "Healthy photo, a photo from Bilal" });
  await expect(healthy).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() => healthy.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);

  // Only the host is told which photo failed.
  await admin.getByRole("button", { name: /Shown so far/ }).click();
  await expect(admin.getByText("Couldn't display")).toHaveCount(1);
  for (const phone of [amina, bilal])
    expect(await phone.locator("body").innerText()).not.toMatch(/couldn.t display/i);

  await host.close();
  await phones.close();
  await secondPhone.close();
});

async function send(page: Page, caption: string) {
  await page.getByRole("button", { name: "Snap", exact: true }).click();
  await page.getByLabel(/Camera roll/).setInputFiles("apps/web/e2e/fixtures/pixel.png");
  await page.getByLabel("Caption").fill(caption);
  await page.getByRole("button", { name: "Send it" }).click();
  await expect(page.getByText("Waiting for the host")).toBeVisible();
}

async function signIn(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "You are signed in as" }),
  ).toContainText("You are signed in as humzab1711@hotmail.com.");
}

async function join(page: Page, code: string, nickname: string) {
  await page.goto("/join");
  await page.getByLabel("Join code").fill(code);
  await page.getByLabel("Nickname").fill(nickname);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("status")).toContainText(
    `You are in. This phone is ${nickname}.`,
  );
}
