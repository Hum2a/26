import { expect, test, type Page } from "@playwright/test";

test("a phone sends a wall photo, the host approves it, the room reacts, and pulling removes it", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const host = await browser.newContext();
  const phones = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const admin = await host.newPage();
  const stage = await host.newPage();
  const amina = await phones.newPage();
  const bilal = await phones.newPage();

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

  // The wall works from the lobby, before the game starts.
  await amina.getByRole("button", { name: /Send to the big screen/ }).click();
  await amina
    .getByLabel(/Camera roll/)
    .setInputFiles("apps/web/e2e/fixtures/pixel.png");
  await amina.getByLabel("Caption").fill("Cake o'clock");
  await amina.getByRole("button", { name: "Tabloid" }).click();
  await amina.getByRole("button", { name: "Send it" }).click();
  await expect(amina.getByText("Waiting for the host")).toBeVisible();

  // Nothing reaches the stage before approval.
  await expect(stage.getByRole("img", { name: /a photo from Amina/ })).toHaveCount(0);

  await admin.getByRole("link", { name: "Photo wall", exact: true }).click();
  await expect(admin.getByRole("heading", { name: "Photo wall" })).toBeVisible();
  await admin
    .getByRole("article", { name: "Amina's photo" })
    .getByRole("button", { name: "Approve" })
    .click();

  const photo = stage.getByRole("img", { name: "Cake o'clock, a photo from Amina" });
  await expect(photo).toBeVisible();
  await expect(stage.getByText("THE DAILY 26 · EXCLUSIVE")).toBeVisible();
  await expect(amina.getByText("On screen now!")).toBeVisible();

  await bilal.getByRole("button", { name: /Send to the big screen/ }).click();
  await bilal.getByRole("button", { name: "Fire" }).click();
  await expect(stage.getByLabel("Reactions")).toContainText("1");

  const source = await photo.getAttribute("src");
  await admin.getByRole("button", { name: "Pull it" }).click();
  await expect(photo).toHaveCount(0);
  const pulled = await stage.request.get(source ?? "");
  expect(pulled.status()).toBe(404);
  await expect(amina.getByText("Taken down")).toBeVisible();

  const overflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);

  await host.close();
  await phones.close();
});

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
