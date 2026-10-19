import { expect, test, type Page } from "@playwright/test";

test("media, health, content and results have real private workflows and responsive layouts", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Create a lobby", exact: true }).click();
  const code = (await page.locator(".admin-room-code").innerText()).trim();
  const room = new URL(page.url()).pathname;
  const gameId = room.split("/").at(-1)!;
  const phones = await Promise.all(
    ["Amina", "Bilal", "Chen"].map(async (nickname) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const phone = await context.newPage();
      await phone.goto(`/j/${code}`);
      await phone.getByLabel("Nickname").fill(nickname);
      await phone.getByRole("button", { name: "Join", exact: true }).click();
      await expect(phone.getByRole("heading", { name: "In the lobby" })).toBeVisible();
      return { context, page: phone };
    }),
  );
  await page.getByRole("link", { name: "Live controls", exact: true }).click();
  await page.getByRole("button", { name: "Start the illustrative demo" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const phone = phones[0]!.page;
  await phone.getByRole("button", { name: /Photos & sound/ }).click();
  await phone.getByLabel("Photo").setInputFiles("apps/web/e2e/fixtures/pixel.png");
  await phone.getByRole("button", { name: "Send", exact: true }).click();
  await expect(phone.getByText("Photo accepted.")).toBeVisible();
  await page.getByRole("link", { name: "Media", exact: true }).click();
  const image = page.getByAltText("Photo shared by Amina");
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty("naturalWidth", 1);
  const preview = (await image.getAttribute("src"))!;
  const allowed = await page.request.get(preview);
  expect(allowed.status()).toBe(200);
  expect(allowed.headers()["cache-control"]).toContain("no-store");
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get(`http://localhost:4173${preview}`);
  expect([401, 403]).toContain(denied.status());
  await anonymous.close();
  await page.getByRole("button", { name: "Hide photo from Amina" }).click();
  await expect(page.getByText("Hidden · preview unavailable")).toBeVisible();
  expect((await page.request.get(preview)).status()).toBe(404);
  await page.getByRole("link", { name: "Health", exact: true }).click();
  await expect(page.getByText(/Last checked/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Scheduler", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Question packs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "birthday-draft", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Preparation only/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Start|Publish|Save|Release/ }),
  ).toHaveCount(0);
  await page.goto(`${room}/live`);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: /More controls/ }).click();
  await page
    .getByRole("button", { name: "Finish after this question", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finish after this question", exact: true })
    .click();
  for (
    let step = 0;
    step < 12 &&
    !(await page.getByText("The quiz is complete.", { exact: true }).isVisible());
    step++
  ) {
    const finish = page.getByRole("button", { name: "Finish quiz", exact: true });
    if (await finish.isVisible()) {
      try {
        await finish.click({ timeout: 2_000 });
      } catch (error) {
        // The authoritative final-phase alarm can reach the podium while clicking.
        // Accept that outcome only after observing the completed game.
        if (await page.getByText("The quiz is complete.", { exact: true }).isVisible())
          break;
        throw error;
      }
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Finish quiz", exact: true })
        .click();
    } else await page.getByRole("button", { name: "Advance", exact: true }).click();
    await expect(page.locator(".admin-command-feedback[aria-busy=true]")).toHaveCount(
      0,
    );
  }
  await page.getByRole("link", { name: "Results", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Final standings", exact: true }),
  ).toBeVisible();
  const publicPage = await phones[1]!.context.newPage();
  await publicPage.goto(`/r/${gameId}`);
  await expect(async () => {
    await publicPage.reload();
    await expect(
      publicPage.getByRole("heading", { name: "What a night." }),
    ).toBeVisible();
  }).toPass({ timeout: 20_000, intervals: [1000] });
  await expect(publicPage.getByLabel("Your private result")).toContainText("Bilal");
  await expect(publicPage.getByAltText("Photo shared by Amina")).toHaveCount(0);
  await expect(
    publicPage.getByRole("navigation", { name: "Admin workspace" }),
  ).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await publicPage.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path, heading] of [
      ["media", `${room}/media`, "Media"],
      ["health", `${room}/health`, "Room health"],
      ["admin-results", `${room}/results`, "Results & exports"],
      ["content", "/admin/content", "Question packs"],
    ]) {
      await page.goto(path!);
      await expect(
        page.getByRole("heading", { level: 1, name: heading!, exact: true }),
      ).toBeVisible();
      await expect(page.locator(".admin-content > div")).toHaveCSS("opacity", "1");
      await expect(
        page.getByText(
          /Checking accepted media|Checking room health|Checking question packs/,
        ),
      ).toHaveCount(0);
      await expect(page.locator(".entry-main")).toHaveCSS("opacity", "1");
      if (name === "health") await expect(page.getByText(/Last checked/)).toBeVisible();
      if (name === "content")
        await expect(
          page.getByRole("heading", { name: "birthday-draft", exact: true }),
        ).toBeVisible();
      if (name === "media")
        await expect(page.getByText("Hidden · preview unavailable")).toBeVisible();
      await checkLayout(page, width, name!);
    }
    await publicPage.setViewportSize({ width, height: 900 });
    await checkLayout(publicPage, width, "public-results");
  }
  await Promise.all(phones.map((phone) => phone.context.close()));
});

async function checkLayout(page: Page, width: number, name: string) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBe(true);
  if ([390, 1920].includes(width))
    await page.screenshot({
      path: `.codex/previews/admin-redesign/${name}-${width}.png`,
      fullPage: true,
    });
}
