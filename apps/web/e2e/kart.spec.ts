import { expect, test, type Page } from "@playwright/test";
import type { LobbySnapshot } from "@26/shared";

test("a quiz transitions to the synchronised TV race, two phone controllers and a persistent podium", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const host = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    phone = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    spectator = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const admin = await host.newPage(),
    driver = await phone.newPage(),
    other = await spectator.newPage();
  const errors: string[] = [];
  driver.on("pageerror", (e) => errors.push(e.message));
  let latest: LobbySnapshot | undefined;
  const inputs: unknown[] = [];
  const samples: unknown[] = [];
  driver.on("websocket", (socket) => {
    socket.on("framesent", (frame) => {
      try {
        const data = JSON.parse(String(frame.payload));
        if (data.name === "kart-input") inputs.push(data.input);
      } catch {
        /* heartbeat */
      }
    });
    socket.on("framereceived", (frame) => {
      try {
        const data = JSON.parse(String(frame.payload));
        if (data.kind === "snapshot") {
          latest = data.snapshot as LobbySnapshot;
          const d = latest?.play?.kart?.participants[0];
          if (d)
            samples.push({
              elapsed: latest?.play?.kart?.elapsedMs,
              speed: d.speed,
              x: d.x,
              z: d.z,
              heading: d.heading,
              progress: d.progress,
              cursor: latest?.play?.kart?.inputCursor,
            });
        }
      } catch {
        /* heartbeat */
      }
    });
  });
  await admin.goto("/admin");
  await admin.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await admin.getByRole("button", { name: "Email me a sign-in link" }).click();
  await admin
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await admin.getByRole("button", { name: "Sign in", exact: true }).click();
  await admin.getByRole("button", { name: "Create a lobby" }).click();
  const code = (await admin.locator(".admin-room-code").textContent())!.trim();
  await admin.getByRole("link", { name: "Live controls", exact: true }).click();
  async function join(page: Page, name: string) {
    await page.goto("/join");
    await page.getByLabel("Join code").fill(code);
    await page.getByLabel("Nickname").fill(name);
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(`This phone is ${name}`);
  }
  await join(driver, "Amina");
  await join(other, "Bilal");
  const stage = await host.newPage();
  stage.on("pageerror", (e) => errors.push(e.message));
  await stage.goto(`/host?code=${code}`);
  await stage.getByRole("button", { name: "Connect room" }).click();
  await stage.getByRole("button", { name: "Present on this screen" }).click();
  await admin.getByRole("button", { name: "Start local kart rehearsal" }).click();
  await expect.poll(() => latest?.phase).toBe("intro");
  async function advance() {
    const before = latest?.phase;
    if (before === "final") {
      await admin.getByRole("button", { name: "Finish quiz", exact: true }).click();
      await admin
        .getByRole("dialog")
        .getByRole("button", { name: "Finish quiz", exact: true })
        .click();
    } else await admin.getByRole("button", { name: "Advance", exact: true }).click();
    await expect.poll(() => latest?.phase).not.toBe(before);
  }
  for (let i = 0; i < 5; i++) await advance();
  await expect.poll(() => latest?.play?.question.kind).toBe("kart");
  await expect(driver.getByRole("button", { name: "Accelerate" })).toBeDisabled();
  await driver.setViewportSize({ width: 844, height: 390 });
  await driver.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await driver.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  ).toBe(false);
  await driver.setViewportSize({ width: 320, height: 844 });
  await driver.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  expect(
    await driver.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  ).toBe(false);
  await driver.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await driver.emulateMedia({ reducedMotion: "no-preference" });
  await advance();
  await advance();
  await expect(driver.getByRole("button", { name: "Accelerate" })).toBeEnabled();
  await expect(stage.locator("canvas[aria-label='Live kart circuit']")).toBeVisible();
  await expect(other.getByRole("heading", { name: "Kart 2" })).toBeVisible();
  for (const width of [320, 390, 430]) {
    await driver.setViewportSize({ width, height: 844 });
    expect(
      await driver.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
  }
  await driver.setViewportSize({ width: 390, height: 844 });
  async function steerAndDrive() {
    await driver.bringToFront();
    const steering = driver.getByLabel("Steering");
    await steering.focus();
    await steering.press("End");
    for (let i = 0; i < 76; i++) await steering.press("ArrowLeft");
    const box = (await driver
      .getByRole("button", { name: "Accelerate" })
      .boundingBox())!;
    await driver.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await driver.mouse.down();
    await expect(steering).toHaveValue("0.24");
    await expect(driver.getByRole("button", { name: "Accelerate" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await steerAndDrive();
  await expect
    .poll(() => latest?.play?.kart?.participants[0]?.speed ?? 0)
    .toBeGreaterThan(1);
  await admin.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(driver.getByRole("button", { name: "Accelerate" })).toBeDisabled();
  const paused = latest?.play?.kart?.elapsedMs;
  await driver.mouse.up();
  await driver.reload();
  await expect(driver.getByRole("button", { name: "Accelerate" })).toBeDisabled();
  expect(latest?.play?.kart?.elapsedMs).toBe(paused);
  await admin.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(driver.getByRole("button", { name: "Accelerate" })).toBeEnabled();
  await steerAndDrive();
  try {
    await expect
      .poll(() => latest?.play?.kart?.participants[0]?.status, { timeout: 45_000 })
      .toBe("FINISHED");
  } catch (error) {
    console.log(
      "Race diagnostic",
      JSON.stringify({
        driver: latest?.play?.kart?.participants[0],
        inputCount: inputs.length,
        lastInputs: inputs.slice(-10),
        activeInputs: inputs
          .filter((x: unknown) => (x as { gas?: boolean }).gas)
          .slice(0, 20),
        samples: samples.filter((_x, i) => i % 10 === 0),
      }),
    );
    throw error;
  }
  await driver.mouse.up();
  await expect(driver.getByRole("button", { name: "Accelerate" })).toBeDisabled();
  await expect.poll(() => latest?.play?.kart?.ended, { timeout: 45_000 }).toBe(true);
  await expect(stage.getByRole("heading", { name: "Chequered flag" })).toBeVisible();
  expect(latest?.play?.kart?.leaderboard.find((d) => d.name === "Bilal")).toMatchObject(
    { finished: false, timeMs: null, points: 0 },
  );
  expect(latest?.play?.selfAward).toBe(100);
  await expect(driver.locator(".skin-status[role=status]")).toContainText(
    "Lap finished",
  );
  await expect(other.locator(".skin-status[role=status]")).toContainText("DNF");
  await expect(driver.locator("[data-phase-motion][data-phase=reveal]")).toHaveCSS(
    "opacity",
    "1",
  );
  await stage.screenshot({ path: ".codex/previews/kart/stage.png", fullPage: true });
  await driver.screenshot({ path: ".codex/previews/kart/phone.png", fullPage: true });
  await driver.reload();
  await expect.poll(() => latest?.play?.selfAward).toBe(100);
  for (let i = 0; i < 3; i++) await advance();
  await expect.poll(() => latest?.phase).toBe("podium");
  expect(errors).toEqual([]);
  await Promise.all([host.close(), phone.close(), spectator.close()]);
});
