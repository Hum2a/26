import { expect, test } from "@playwright/test";

test("individual questions support private inspection, direct links and responsive layouts", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await page.goto("/admin/content/birthday-draft/favourite-pokemon");
  // A cold local auth adapter can exceed the first bounded session request.
  const email = page.getByLabel("Administrator email");
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await expect(email.or(retry)).toBeVisible({ timeout: 20_000 });
  if (await retry.isVisible()) await retry.click();
  await page.screenshot({
    path: ".codex/previews/admin-redesign/question-sign-in.png",
  });
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/birthday-draft\/favourite-pokemon$/);
  await expect(page.getByRole("region", { name: "Question wording" })).toBeVisible();
  const response = await page.request.get(
    "/api/admin/content/birthday-draft/questions/favourite-pokemon",
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const detail = await response.json();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    detail.question.title,
  );
  await expect(page).toHaveTitle(`${detail.question.title} · Question packs · 26`);
  await expect(
    page.getByRole("heading", { name: "Recorded answer", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Answer & author notes/ }).click();
  await expect(
    page.getByRole("heading", { name: "Recorded answer", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".admin-disclosure")
      .getByText(detail.question.answer.lines[0], { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    detail.question.title,
  );
  await expect(
    page.getByRole("heading", { name: "Recorded answer", exact: true }),
  ).toHaveCount(0);

  for (const width of [320, 390, 768, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.codex/previews/admin-redesign/question-detail-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await page.getByRole("link", { name: /Back to question packs/ }).click();
  await expect(page).toHaveURL(/\/admin\/content\?pack=birthday-draft$/);
  await expect(page.getByRole("link", { name: /^View / }).first()).toBeVisible();
  const links = await page.getByRole("link", { name: /^View / }).evaluateAll((nodes) =>
    nodes.map((node) => ({
      href: node.getAttribute("href")!,
      title: node.textContent!.replace(/\s*→\s*$/, "").trim(),
    })),
  );
  expect(links.length).toBeGreaterThan(0);
  await page
    .getByRole("link", { name: /^View / })
    .first()
    .press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(links[0]!.title);
  await page.getByRole("link", { name: /Back to question packs/ }).click();
  for (const link of links) {
    await page.goto(link.href);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(link.title);
    await expect(
      page.getByRole("heading", { name: "Readiness", exact: true }),
    ).toBeVisible();
  }
  const missingResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      "/api/admin/content/birthday-draft/questions/unknown-question",
  );
  await page.goto("/admin/content/birthday-draft/unknown-question");
  const missing = await missingResponse;
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({
    error: "not_found",
    message: "That question could not be found in this pack.",
  });
  await expect(
    page.getByText("That question could not be found in this pack."),
  ).toBeVisible();
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get(
    "http://localhost:4173/api/admin/content/birthday-draft/questions/favourite-pokemon",
  );
  expect([401, 403]).toContain(denied.status());
  expect(await denied.text()).not.toContain(detail.question.answer.lines[0]);
  await anonymous.close();
});
