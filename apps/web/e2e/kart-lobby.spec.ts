import { expect, test, type Page } from "@playwright/test";

/** A beat lasts a second, shorter than a slow poll, so note each one as it renders. */
function recordBeats(screen: Page) {
  return screen.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __beats: string[] }).__beats = seen;
    new MutationObserver(() => {
      for (const beat of document.querySelectorAll(".kart-countdown [data-beat]")) {
        const value = beat.getAttribute("data-beat")!;
        if (!seen.includes(value)) seen.push(value);
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}
function beats(screen: Page) {
  return screen.evaluate(() => (window as unknown as { __beats: string[] }).__beats);
}

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
  const rivalContext = await browser.newContext({
    viewport: { width: 430, height: 844 },
  });
  const rival = await rivalContext.newPage();
  await rival.goto(`/j/${code}`);
  await rival.getByLabel("Nickname").fill("Chen");
  await rival.getByRole("button", { name: "Join", exact: true }).click();
  await expect(rival.getByRole("heading", { name: "In the lobby" })).toBeVisible();
  const stage = await page.context().newPage();
  const publicFrames: string[] = [];
  for (const screen of [phone, rival, stage])
    screen.on("websocket", (socket) =>
      socket.on("framereceived", (frame) => publicFrames.push(String(frame.payload))),
    );
  await stage.goto(`/host?code=${code}`);
  await stage.getByRole("button", { name: "Connect room" }).click();
  await stage.getByRole("button", { name: "Present on this screen" }).click();
  await page.getByRole("button", { name: "Start kart race", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start kart race", exact: true })
    .click();
  await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
    "data-phase",
    "intro",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start kart race", exact: true }),
  ).toHaveCount(0);
  // Landscape grid: the slot and instruction stay visible over the paused driving view.
  await phone.setViewportSize({ width: 844, height: 390 });
  await expect(phone.locator(".kart-phone")).toHaveAttribute("data-layout", "grid");
  await expect(phone.locator(".kart-race-status")).toContainText(
    "push up right on GO for a rocket start",
  );
  await expect(phone.locator(".kart-race-status")).toBeVisible();
  await phone.setViewportSize({ width: 390, height: 844 });
  async function advance(phase: string) {
    await page.getByRole("button", { name: "Advance", exact: true }).click();
    await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
      "data-phase",
      phase,
    );
  }
  // Mark the live renderer: nothing may rebuild it behind the countdown.
  await phone
    .locator("canvas[aria-label='Your driving view']")
    .evaluate((canvas: HTMLCanvasElement) => {
      canvas.dataset.raceStart = "kept";
    });
  await recordBeats(phone);
  await recordBeats(stage);
  await advance("prompt");
  // The prompt runs out on its own: 3-2-1 on the phone and the stage, then GO.
  await expect.poll(() => beats(phone), { timeout: 12_000 }).toContain("1");
  await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
    "data-phase",
    "collect",
    { timeout: 5_000 },
  );
  await expect.poll(() => beats(phone)).toEqual(["3", "2", "1", "GO"]);
  await expect.poll(() => beats(stage)).toEqual(["3", "2", "1", "GO"]);
  await expect(phone.locator("canvas[data-race-start='kept']")).toHaveCount(1);
  await expect(phone.getByRole("button", { name: "Accelerate" })).toBeEnabled();
  await expect(stage.locator("[data-map-player]")).toHaveCount(2);
  await expect(rival.getByRole("button", { name: "Accelerate" })).toBeEnabled();
  await phone.getByRole("button", { name: "Accelerate" }).click({ delay: 500 });
  await rival.getByRole("button", { name: "Accelerate" }).click({ delay: 500 });
  await expect
    .poll(() => {
      const moving = new Set<string>();
      for (const frame of publicFrames) {
        if (!frame.startsWith("{")) continue;
        const packet = JSON.parse(frame) as {
          kind?: string;
          kart?: { participants?: { name: string; speed: number }[] };
        };
        if (packet.kind === "kart") {
          for (const driver of packet.kart?.participants ?? []) {
            if (driver.speed > 0) moving.add(driver.name);
          }
        }
      }
      return moving.has("Amina") && moving.has("Chen");
    })
    .toBe(true);
  await stage.screenshot({
    path: ".codex/previews/kart/kart-circuit-two-racers.png",
    fullPage: true,
  });
  await phone.screenshot({
    path: ".codex/previews/kart/kart-phone-racing.png",
    fullPage: true,
  });
  const late = await lateContext.newPage();
  await late.goto(`/j/${code}`);
  await late.getByLabel("Nickname").fill("Bilal");
  await late.getByRole("button", { name: "Join", exact: true }).click();
  await expect(late.locator(".skin-status[role=status]")).toHaveText(
    "You’re watching this race. Join the next round.",
  );
  await expect(stage.locator("[data-map-player]")).toHaveCount(2);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(phone.getByRole("button", { name: "Accelerate" })).toBeDisabled();
  await phone.reload();
  await expect(phone.getByRole("button", { name: "Accelerate" })).toBeDisabled();
  // Landscape keeps the pause visible over the full-screen driving view.
  await phone.setViewportSize({ width: 844, height: 390 });
  await expect(phone.locator(".kart-race-status")).toHaveText(
    "Paused — controls released",
  );
  await expect(phone.locator(".kart-race-status")).toBeVisible();
  await phone.setViewportSize({ width: 390, height: 844 });
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
  await stage.screenshot({
    path: ".codex/previews/kart/kart-podium-two-racers.png",
    fullPage: true,
  });
  expect(publicFrames.join("\n")).not.toContain('"kartLobby"');
  expect(publicFrames.join("\n")).not.toContain('"birthday-script"');
  await page.goto(liveUrl.replace(/\/live$/, ""));
  await expect(
    page.getByRole("heading", { name: "Kart-only lobby", exact: true }),
  ).toBeVisible();
  await phoneContext.close();
  await lateContext.close();
  await rivalContext.close();
});
