import { expect, test, type Page } from "@playwright/test";

test("a phone sends a photo, the stage shows it, and hiding stops later access", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const host = await browser.newContext();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const admin = await host.newPage();
  const stage = await host.newPage();
  const amina = await phone.newPage();

  await signIn(admin);
  await admin.getByRole("button", { name: "Create a lobby" }).click();
  await expect(
    admin.getByRole("heading", { name: "Ready for the room." }),
  ).toBeVisible();
  const joinCode =
    (await admin.locator(".admin-room-code").textContent())?.trim() ?? "";
  expect(joinCode).toHaveLength(6);
  await admin.getByRole("link", { name: "Live controls", exact: true }).click();

  await stage.goto(`/host?code=${joinCode}`);
  await stage.getByRole("button", { name: "Connect room" }).click();
  await stage.getByRole("button", { name: "Present on this screen" }).click();
  await expect(stage.getByRole("heading", { name: "In the lobby" })).toBeVisible();
  await join(amina, joinCode, "Amina");
  await admin.getByRole("button", { name: "Start the illustrative demo" }).click();
  await amina.getByRole("button", { name: "Snap", exact: true }).click();
  await expect(amina.getByLabel("Photo", { exact: true })).toBeVisible();

  await amina
    .getByLabel("Photo", { exact: true })
    .setInputFiles("apps/web/e2e/fixtures/snap.heic");
  await amina.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    amina.getByText(
      "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC.",
    ),
  ).toBeVisible();
  await amina.getByRole("button", { name: "Retake" }).click();

  await amina.getByRole("button", { name: "Record a 3 second clip" }).click();
  await expect(
    amina.getByText(
      "The microphone is unavailable. You can still answer the questions.",
    ),
  ).toBeVisible();

  const shown = stage.waitForResponse((response) => {
    const path = new URL(response.url()).pathname;
    return (
      response.request().method() === "GET" &&
      /\/api\/rooms\/[^/]+\/media\/[0-9a-f-]{36}$/i.test(path) &&
      response.ok()
    );
  });
  await amina
    .getByLabel("Photo", { exact: true })
    .setInputFiles("apps/web/e2e/fixtures/pixel.png");
  await amina.getByRole("button", { name: "Send", exact: true }).click();
  await expect(amina.getByText("Photo accepted.")).toBeVisible();
  const image = await shown;
  expect(image.headers()["cache-control"]).toContain("no-store");
  const picture = stage.getByRole("img", { name: "Photo from Amina" });
  await expect(picture).toBeVisible();
  const source = await picture.getAttribute("src");
  expect(source).toBeTruthy();
  const overflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);

  await admin.getByRole("button", { name: "Hide photo from Amina" }).click();
  await expect(
    admin.getByText(
      "That photo or voice clip is hidden from the stage and the gallery.",
    ),
  ).toBeVisible();
  await expect(picture).toHaveCount(0);
  const hidden = await stage.request.get(source ?? "");
  expect(hidden.status()).toBe(404);

  await host.close();
  await phone.close();
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
