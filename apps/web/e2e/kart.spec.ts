import { expect, test, type Page } from "@playwright/test";
import type { LobbySnapshot } from "@26/shared";

test("a quiz transitions to personal phone driving views, a spectator map and a persistent podium", async ({
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
  driver.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("Phone page error", e.message);
  });
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
  const email = admin.getByLabel("Administrator email");
  const retry = admin.getByRole("button", { name: "Try again", exact: true });
  await expect(email.or(retry)).toBeVisible({ timeout: 20_000 });
  if (await retry.isVisible()) await retry.click();
  await email.fill("humzab1711@hotmail.com");
  await admin.getByRole("button", { name: "Email me a code and link" }).click();
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
  // Forty-eight passive registered guests exercise a real 50-player room; two phones drive.
  const extras = await browser.newContext();
  const enrol = await extras.newPage();
  await enrol.goto("/join");
  await enrol.evaluate(async (code) => {
    const modulePath = "/src/live/room-api.ts";
    const { joinLobby } = await import(/* @vite-ignore */ modulePath);
    for (let i = 3; i <= 50; i++) {
      const result = await joinLobby({
        code,
        nickname: `Stand-in ${i}`,
        requestId: crypto.randomUUID(),
      });
      if ("error" in result) throw new Error(result.error);
    }
  }, code);
  await extras.close();
  const stage = await host.newPage();
  await stage.setViewportSize({ width: 1920, height: 1080 });
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
  await driver.bringToFront();
  await expect(driver.getByRole("button", { name: "Accelerate" })).toBeEnabled();
  await expect(
    stage.getByRole("img", { name: "Live race map: 50 drivers" }),
  ).toBeVisible();
  await expect(stage.locator("canvas")).toHaveCount(0);
  await expect(driver.locator("canvas[aria-label='Your driving view']")).toBeVisible();
  await expect(other.locator("canvas[aria-label='Your driving view']")).toBeVisible();
  await expect(
    driver.locator("canvas[aria-label='Your driving view']"),
  ).toHaveAttribute("data-player-id", latest!.play!.kart!.selfPlayerId!);
  await driver.getByRole("button", { name: "Use lightweight map" }).click();
  await expect(driver.locator("canvas")).toHaveCount(0);
  await expect(
    driver.getByRole("img", { name: "Your live track position" }),
  ).toBeVisible();
  await driver.getByRole("button", { name: "Use 3D driving view" }).click();
  await expect(driver.locator("canvas[aria-label='Your driving view']")).toBeVisible();
  await expect(other.getByRole("heading", { name: "Kart 2" })).toBeVisible();
  await expect(driver.getByText("Position 1 of 50", { exact: true })).toBeVisible();
  expect(latest?.play?.kart?.participants).toHaveLength(1);
  expect(latest?.play?.kart?.participantCount).toBe(50);
  for (const width of [320, 390, 430]) {
    await driver.setViewportSize({ width, height: 844 });
    expect(
      await driver.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    await driver.screenshot({
      path: `.codex/previews/kart/driving-${width}.png`,
      fullPage: true,
    });
    await expect
      .poll(
        () =>
          driver
            .getByRole("button", { name: "Drift / boost" })
            .evaluate((button) => button.getBoundingClientRect().bottom <= innerHeight),
        { message: `Pedals fit the ${width}px phone viewport` },
      )
      .toBe(true);
  }
  await driver.setViewportSize({ width: 844, height: 390 });
  expect(
    await driver
      .getByRole("button", { name: "Accelerate" })
      .evaluate((button) => button.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  await driver.setViewportSize({ width: 390, height: 844 });
  await driver.getByRole("button", { name: "Use thumb pad" }).click();
  const thumb = driver.locator(".kart-thumb-pad"),
    padBox = (await thumb.boundingBox())!;
  await driver.mouse.move(padBox.x + padBox.width * 0.62, padBox.y + padBox.height / 2);
  await driver.mouse.down();
  await expect
    .poll(() => Number((inputs.at(-1) as { steer?: number })?.steer))
    .toBeGreaterThan(0.2);
  await driver.mouse.up();
  await expect(driver.getByLabel("Steering")).toHaveValue("0");
  await driver.getByRole("button", { name: "Use steering slider" }).click();
  await stage.screenshot({ path: ".codex/previews/kart/circuit.png", fullPage: true });
  await driver.screenshot({
    path: ".codex/previews/kart/controller.png",
    fullPage: true,
  });
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
  // A lost GPU context must leave the authoritative result and a working recovery action.
  const canvas = driver.locator("canvas[aria-label='Your driving view']");
  await canvas.evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext("webgl2");
    if (!gl) throw new Error("Expected the real WebGL2 phone renderer");
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension)
      throw new Error("Expected context-loss extension for this browser test");
    extension.loseContext();
  });
  await expect(driver.getByRole("button", { name: "Retry circuit" })).toBeVisible();
  await expect(stage.getByRole("heading", { name: "Race paused" })).toBeVisible();
  await driver.getByRole("button", { name: "Retry circuit" }).click();
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((element) =>
        (element as HTMLCanvasElement).getContext("webgl2")?.isContextLost(),
      ),
    )
    .toBe(false);
  expect(latest?.play?.kart?.elapsedMs).toBe(paused);
  await expect(stage.locator("[data-map-player]")).toHaveCount(50);
  // A pause may catch any carousel page; return to the first field group explicitly.
  const fieldHeading = stage.locator(".kart-field-heading h4");
  for (
    let attempt = 0;
    attempt < 9 && (await fieldHeading.textContent()) !== "The field · 6–10";
    attempt++
  ) {
    await stage.getByRole("button", { name: "Next drivers" }).click();
  }
  await expect(stage.getByRole("heading", { name: "The field · 6–10" })).toBeVisible();
  for (let i = 0; i < 8; i++)
    await stage.getByRole("button", { name: "Next drivers" }).click();
  await expect(stage.getByRole("heading", { name: "The field · 46–50" })).toBeVisible();
  await expect(
    stage.getByRole("list", { name: "Rest of the race field" }),
  ).toContainText("Stand-in 50");
  expect(
    await stage
      .locator(".kart-leaderboard")
      .evaluate((board) => board.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  await stage.screenshot({
    path: ".codex/previews/kart/fifty-players.png",
    fullPage: true,
  });
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
  await expect(driver.getByRole("heading", { name: "Lap complete" })).toBeVisible();
  await expect(driver.getByRole("button", { name: "Accelerate" })).toHaveCount(0);
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
