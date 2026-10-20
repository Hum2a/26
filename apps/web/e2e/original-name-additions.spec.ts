import { expect, test } from "@playwright/test";

test("both original-name questions rehearse privately in the existing case-file design", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/admin/phone-preview/birthday-draft/real-name-vin-diesel");
  await page.getByRole("link", { name: "Admin sign in →" }).click();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const sockets: string[] = [];
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname.startsWith("/ws/")) sockets.push(socket.url());
  });
  for (const [id, subject] of [
    ["real-name-vin-diesel", "Vin Diesel"],
    ["real-name-jamie-foxx", "Jamie Foxx"],
  ] as const) {
    await page.goto(`/admin/phone-preview/birthday-draft/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `What was their original name? ${subject}`,
    );
    await expect(page.locator(".dossier-fields dd").first()).toHaveText(subject);
    const payload = await page.request.get(
      `/api/admin/content/birthday-draft/questions/${id}/preview`,
    );
    const body = await payload.json();
    expect(body.question).toMatchObject({
      kind: "typed",
      presentation: "redacted-file",
      points: 100,
    });
    for (const field of ["accepted", "notes", "explanation", "answer"])
      expect(body.question).not.toHaveProperty(field);
    const field = page.getByRole("textbox", { name: "Real name" });
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await field.scrollIntoViewIfNeeded();
      await expect(field).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
    }
    await page.goto(`/admin/phone-preview/birthday-draft/${id}?phase=prompt`);
    await expect(field).toBeDisabled();
    await page.goto(`/admin/phone-preview/birthday-draft/${id}?phase=collect`);
    await page.getByRole("button", { name: "Pause preview" }).click();
    await expect(field).toBeDisabled();
    await page.getByRole("button", { name: "Resume preview" }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await field.fill("Sample Person");
    await page.getByRole("button", { name: "Submit to the file" }).click();
    await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
    await expect(field).toBeDisabled();
    await expect(field).toHaveValue("Sample Person");
    await expect(page.getByText("Submit to the file", { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `.codex/previews/original-names/${id}.png`,
      fullPage: true,
    });
  }
  expect(sockets).toEqual([]);
});
