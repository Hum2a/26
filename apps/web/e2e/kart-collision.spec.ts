import { expect, test } from "@playwright/test";

test("native practice uses the real bounce preset and switching back resets and pauses it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await page.setViewportSize({ width: 740, height: 360 });
  await page.goto("/kart-engine/index.html");
  await page.getByRole("button", { name: "Course set-up", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Contact handling", exact: true })
    .selectOption("bounce-v1");
  await page.getByRole("button", { name: "Clear track", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Graphics", exact: true })
    .selectOption("low");
  await page.getByRole("button", { name: "Course set-up", exact: true }).click();
  await page.getByRole("button", { name: "Start driving", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('.solo-game[data-ready="true"]'),
  );
  await page.evaluate(() => {
    const seen = { stunned: false };
    Object.defineProperty(window, "kartStunObserved", {
      configurable: true,
      value: seen,
    });
    const observer = new MutationObserver(() => {
      if (
        document
          .querySelector(".solo-telemetry")
          ?.textContent?.includes("Barrier impact — controls resume in a moment")
      )
        seen.stunned = true;
    });
    observer.observe(document.body, {
      subtree: true,
      characterData: true,
      childList: true,
    });
  });
  await page.bringToFront();
  await page.keyboard.down("w");
  await expect
    .poll(
      async () => parseInt(await page.getByLabel("Speed", { exact: true }).innerText()),
      { timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(40);
  await page.keyboard.down("d");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as Window & { kartStunObserved: { stunned: boolean } })
              .kartStunObserved.stunned,
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.keyboard.up("w");
  await page.keyboard.up("d");
  await page.getByRole("button", { name: "Course set-up", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Contact handling", exact: true })
    .selectOption("slide-v1");
  await expect(
    page.getByRole("combobox", { name: "Contact handling", exact: true }),
  ).toHaveValue("slide-v1");
  await page.screenshot({
    path: ".codex/previews/kart/phase5-handling-native.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Course set-up", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Taking a pit stop." })).toBeVisible();
  await page.getByRole("button", { name: "Keep driving", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeEnabled();
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
  expect(errors).toEqual([]);
});

test("real collision bench draws baked barriers and rehearses swept impacts without a room", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=collisions");
  const bench = page.getByRole("region", { name: "Kart collision rehearsal" });
  const walls = bench.locator('[data-layer="walls"]');
  expect(Number(await walls.getAttribute("data-segments"))).toBeGreaterThan(0);
  await bench.getByRole("button", { name: "Rehearse a swept wall impact" }).click();
  await expect(bench.getByRole("listitem")).toContainText(
    "Stand-in driver · Barrier impact",
  );
  await bench.getByLabel("Rehearsal course").selectOption("party-ring-v1");
  await expect(walls).toHaveAttribute("data-segments", "256");
  await bench.getByRole("button", { name: "Rehearse a swept wall impact" }).click();
  await expect(bench.getByRole("listitem")).toHaveCount(1);
  await bench.getByLabel("Rehearsal handling").selectOption("bounce-v1");
  await bench.getByRole("button", { name: "Rehearse a swept wall impact" }).click();
  await expect(bench.getByLabel("Collision handling result")).toContainText(
    "Rebounded from the wall · Stun 180ms · Cooldown 600ms",
  );
  await bench.getByLabel("Rehearsal handling").selectOption("slide-v1");
  await bench.getByRole("button", { name: "Rehearse a swept wall impact" }).click();
  await expect(bench.getByLabel("Collision handling result")).toContainText(
    "Slid along the wall · Stun 0ms · Cooldown 0ms",
  );
  await bench.getByLabel("Show collision boundaries").uncheck();
  await expect(walls).toHaveCSS("opacity", "0");
  await bench.getByLabel("Show collision boundaries").check();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [320, 568],
    [740, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
  }
  await page.screenshot({
    path: ".codex/previews/kart/phase5-collision-overlay.png",
    fullPage: true,
  });
  await bench.getByRole("button", { name: "Clear collision rehearsal" }).click();
  await expect(bench.getByRole("listitem")).toHaveCount(0);
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
  expect(errors).toEqual([]);
});

test("native contact settings remain reachable on narrow and short landscape screens", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/kart-engine/index.html");
  await page.getByRole("button", { name: "Start driving", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('.solo-game[data-ready="true"]'),
  );
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  const panel = page.locator(".kart-input-settings");
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 844],
    [740, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height!);
    expect(box.x + box.width).toBeLessThanOrEqual(width!);
    await panel.getByLabel("Sound on contact").scrollIntoViewIfNeeded();
    await expect(panel.getByLabel("Sound on contact")).toBeVisible();
    await panel
      .getByRole("button", { name: "Back to driving" })
      .scrollIntoViewIfNeeded();
    await expect(
      panel.getByRole("button", { name: "Back to driving" }),
    ).toBeInViewport();
  }
  await page.screenshot({
    path: ".codex/previews/kart/phase5-contact-solo-settings.png",
    fullPage: true,
  });
  await panel.getByRole("button", { name: "Back to driving" }).click();
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeEnabled();
});

test("admin rehearses finite real contact cues, opt-in sound, reduced motion and immediate pause", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=controls");
  const bench = page.getByRole("region", { name: "Kart controls rehearsal" });
  await bench.getByRole("button", { name: "Controls", exact: true }).click();
  await expect(bench.getByLabel("Sound on contact")).not.toBeChecked();
  await expect(bench.getByLabel("Vibrate on contact (if supported)")).not.toBeChecked();
  await bench.getByLabel("Sound on contact").check();
  await expect(bench.getByLabel("Sound on contact")).toBeChecked();
  await bench.getByRole("button", { name: "Back to driving" }).click();
  const peak = await page.evaluate(async () => {
    const cue = document.querySelector<HTMLElement>(".kart-contact-cue")!;
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (node) => node.textContent === "Rehearse contact",
    )!;
    button.click();
    let peak = 0;
    const start = performance.now();
    while (performance.now() - start < 350) {
      await new Promise(requestAnimationFrame);
      peak = Math.max(peak, Number(getComputedStyle(cue).opacity));
    }
    return peak;
  });
  expect(peak).toBeGreaterThan(0.05);
  expect(peak).toBeLessThanOrEqual(0.31);
  await expect(bench.locator(".kart-contact-cue")).toHaveCSS("opacity", "0");
  await expect(bench.locator(".kart-contact-cue")).toHaveCSS("pointer-events", "none");
  await bench.getByRole("button", { name: "Pause controls" }).click();
  await expect(bench.getByRole("button", { name: "Clear contact" })).toBeDisabled();
  await bench.getByRole("button", { name: "Resume controls" }).click();
  await bench.getByRole("button", { name: "Clear contact" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bench.getByRole("button", { name: "Rehearse contact" }).click();
  await expect(bench.locator(".kart-contact-cue")).toHaveCSS("opacity", "0");
  await bench.getByRole("button", { name: "Controls", exact: true }).click();
  await bench.getByLabel("Sound on contact").uncheck();
  await bench.getByLabel("Show a gentle contact edge").uncheck();
  await bench.getByRole("button", { name: "Back to driving" }).click();
  await bench.getByRole("button", { name: "Clear contact" }).click();
  await bench.getByRole("button", { name: "Rehearse contact" }).click();
  await expect(bench.locator(".kart-contact-cue")).toHaveCSS("opacity", "0");
  await page.screenshot({
    path: ".codex/previews/kart/phase5-contact-bench.png",
    fullPage: true,
  });
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
  expect(errors).toEqual([]);
});
