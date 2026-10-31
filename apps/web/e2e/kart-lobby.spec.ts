import { expect, test } from "@playwright/test";

test("a fresh kart lobby goes directly to the Mario circuit with normal room controls", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Kart", exact: true }).click();
  await page.getByRole("button", { name: "Create kart lobby" }).click();
  await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/live$/);
  await expect(
    page.getByRole("heading", { name: "Kart-only lobby", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start birthday game", exact: true }),
  ).toHaveCount(0);
  const code = (
    await page.locator(".admin-live-side .admin-side-code").innerText()
  ).trim();
  const liveUrl = page.url();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 430, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("button", { name: "Start kart race", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    page.getByRole("button", { name: "Start kart race", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: ".codex/previews/kart/kart-lobby-admin.png",
    fullPage: true,
  });
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const lateContext = await browser.newContext({
    viewport: { width: 320, height: 740 },
  });
  const phone = await phoneContext.newPage();
  await phone.goto(`/j/${code}`);
  await phone.getByLabel("Nickname").fill("Amina");
  await phone.getByRole("button", { name: "Join", exact: true }).click();
  await expect(phone.getByRole("heading", { name: "In the lobby" })).toBeVisible();
  const stage = await page.context().newPage();
  const publicFrames: string[] = [];
  for (const screen of [phone, stage])
    screen.on("websocket", (socket) =>
      socket.on("framereceived", (frame) => publicFrames.push(String(frame.payload))),
    );
  await stage.goto(`/host?code=${code}`);
  await stage.getByRole("button", { name: "Connect room" }).click();
  await stage.getByRole("button", { name: "Present on this screen" }).click();
  await page.getByRole("button", { name: "Start kart race", exact: true }).click();
  await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
    "data-phase",
    "intro",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start kart race", exact: true }),
  ).toHaveCount(0);
  async function advance(phase: string) {
    await page.getByRole("button", { name: "Advance", exact: true }).click();
    await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
      "data-phase",
      phase,
    );
  }
  await advance("prompt");
  await advance("collect");
  await expect(phone.getByRole("button", { name: "Accelerate" })).toBeEnabled();
  await expect(stage.locator("[data-map-player]")).toHaveCount(1);
  const late = await lateContext.newPage();
  await late.goto(`/j/${code}`);
  await late.getByLabel("Nickname").fill("Bilal");
  await late.getByRole("button", { name: "Join", exact: true }).click();
  await expect(late.locator(".skin-status[role=status]")).toHaveText(
    "You’re watching this race. Join the next round.",
  );
  await expect(stage.locator("[data-map-player]")).toHaveCount(1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(phone.getByRole("button", { name: "Accelerate" })).toBeDisabled();
  await phone.reload();
  await expect(phone.getByRole("button", { name: "Accelerate" })).toBeDisabled();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(phone.getByRole("button", { name: "Accelerate" })).toBeEnabled();
  await advance("reveal");
  await advance("scores");
  await advance("final");
  await page.getByRole("button", { name: "Show podium", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Show podium", exact: true })
    .click();
  await expect(
    stage.getByRole("heading", { name: "Podium", exact: true }),
  ).toBeVisible();
  expect(publicFrames.join("\n")).not.toContain('"kartLobby"');
  expect(publicFrames.join("\n")).not.toContain('"birthday-script"');
  await page.goto(liveUrl.replace(/\/live$/, ""));
  await expect(
    page.getByRole("heading", { name: "Kart-only lobby", exact: true }),
  ).toBeVisible();
  await phoneContext.close();
  await lateContext.close();
});
