import { expect, test } from "@playwright/test";
test("host freezes a chosen park course and a real phone drives it without exposing private selection history", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart");
  const creation = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/rooms" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create kart lobby", exact: true }).click();
  expect((await creation).ok()).toBe(true);
  await expect(page).toHaveURL(/\/admin\/rooms\/[A-Z0-9]+\/live/);
  const region = page.getByRole("region", { name: "Kart course selection" });
  await expect(region.getByLabel("Course for this race")).toBeEnabled();
  await region.getByLabel("Course for this race").selectOption("26-park-v1");
  await expect(region.getByLabel("Course for this race")).toHaveValue("26-park-v1");
  const choice = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/rooms/play" &&
      request.postDataJSON()?.action === "kart-track",
  );
  await region.getByRole("button", { name: "Save course" }).click();
  expect((await choice).postDataJSON().kartTrack).toBe("26-park-v1");
  await expect(region).toContainText("Saved course: 26 Park");
  const code = await page.locator(".admin-live-side .admin-side-code").innerText();
  const context = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      viewport: { width: 390, height: 844 },
    }),
    phone = await context.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  const observed: unknown[] = [];
  phone.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => {
      if (typeof frame.payload === "string" && frame.payload.startsWith("{"))
        observed.push(JSON.parse(frame.payload));
    }),
  );
  try {
    await phone.goto(`/j/${code.trim()}`);
    await phone.getByLabel("Nickname").fill("Amina");
    await phone.getByRole("button", { name: "Join", exact: true }).click();
    await expect(phone.getByRole("heading", { name: "In the lobby" })).toBeVisible();
    await page.getByRole("button", { name: "Start kart race", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Start kart race", exact: true })
      .click();
    await expect(region.getByRole("button", { name: "Save course" })).toBeDisabled();
    for (let i = 0; i < 2; i++)
      await page.getByRole("button", { name: "Advance", exact: true }).click();
    const gas = phone.getByRole("button", { name: "Accelerate", exact: true });
    await expect(gas).toBeEnabled();
    await phone.bringToFront();
    // Waking a background phone releases held controls. Let that visibility
    // transition finish before holding a fresh driving input, as in kart-inputs.
    await phone.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await phone.keyboard.down("ArrowUp");
    await expect(gas).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        observed.some((m) => JSON.stringify(m).includes('"trackId":"26-park-v1"')),
      )
      .toBe(true);
    await expect
      .poll(async () =>
        parseInt(await phone.locator(".kart-telemetry-labels span").last().innerText()),
      )
      .toBeGreaterThan(0);
    await phone.keyboard.up("ArrowUp");
    expect(JSON.stringify(observed)).not.toContain("sourceVersion");
    expect(JSON.stringify(observed)).not.toContain("Course selection history");
    await phone.screenshot({
      path: ".codex/previews/kart/phase8-live-park.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
