import { expect, test } from "@playwright/test";

test("native176 solo look uses its own renderer, preserves a face while tuning and returns to legacy", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("websocket", (s) => sockets.push(s.url()));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /shader|WebGL|GLSL|framebuffer|GL_INVALID/i.test(m.text())
    )
      errors.push(m.text());
  });
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=look");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
      "--accent",
    );
    ctx.fillRect(0, 0, 16, 16);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  await page.getByLabel("Look solo sample face").setInputFiles({
    name: "face.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.getByLabel("Look preset", { exact: true }).selectOption("daylight");
  await page.getByRole("button", { name: "Open solo look rehearsal" }).click();
  const frame = page.frameLocator('iframe[title="Solo kart practice"]');
  await frame.getByRole("button", { name: "Start driving" }).click();
  // The real ready state follows the first completed native look frame.
  await frame.getByRole("button", { name: "Pause", exact: true }).click();
  await frame.getByLabel("Graphics", { exact: true }).selectOption("high");
  const canvas = frame.locator("canvas");
  expect(errors).toEqual([]);
  await expect(canvas).toHaveAttribute("data-three-revision", "176");
  await expect(canvas).toHaveAttribute("data-look-native", "true");
  await expect(canvas).toHaveAttribute("data-look-reflection", "true");
  await expect(canvas).toHaveAttribute("data-driver-faces", "1");
  await page.getByLabel("Exposure (stops)").fill("0.4");
  await expect(canvas).toHaveAttribute("data-driver-faces", "1");
  await page.getByLabel("Enable bloom", { exact: true }).check();
  await page.getByLabel("Enable ambient occlusion", { exact: true }).check();
  await page.getByLabel("Enable tilt shift", { exact: true }).check();
  await expect(canvas).toHaveAttribute("data-look-depth-textures", "1");
  await expect(canvas).toHaveAttribute("data-look-ao", "true");
  await expect(canvas).toHaveAttribute("data-look-tilt-shift", "true");
  await frame.getByLabel("Graphics", { exact: true }).selectOption("low");
  await expect(canvas).toHaveAttribute("data-look-depth-textures", "0");
  await expect(canvas).toHaveAttribute("data-look-bloom", "false");
  await frame.getByLabel("Graphics", { exact: true }).selectOption("high");
  await expect(canvas).toHaveAttribute("data-look-depth-textures", "1");
  await page.getByLabel("Enable environment").uncheck();
  await expect(canvas).toHaveAttribute("data-look-sky", "false");
  await expect(canvas).toHaveAttribute("data-look-reflection", "false");
  await page.getByLabel("Show original before grading").check();
  await expect(canvas).toHaveAttribute("data-look-active", "false");
  await expect(canvas).toHaveAttribute("data-look-buffers", "0");
  await page.getByLabel("Use new look in solo rehearsal").uncheck();
  await expect(canvas).toHaveAttribute("data-solo-look", "legacy");
  await expect(canvas).toHaveAttribute("data-driver-faces", "1");
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
  expect(errors).toEqual([]);
});

test("real look pass changes pixels, restores neutral exactly and recovers the context without changing rooms", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /shader|WebGLProgram|GLSL/i.test(message.text()))
      errors.push(message.text());
  });
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=look");
  const canvas = page.locator('canvas[aria-label="Your driving view"]');
  await expect(canvas).toHaveAttribute("data-vehicle-detail", "detailed");
  await expect(
    page.getByText("Loading circuit model… Race timing follows the room."),
  ).toHaveCount(0);
  await expect(canvas).toHaveAttribute("data-look-active", "false");
  const pixels = () =>
    canvas.evaluate(async (element) => {
      const gl = element.getContext("webgl2");
      if (!gl) throw Error("WebGL2 expected");
      const width = gl.drawingBufferWidth,
        height = gl.drawingBufferHeight;
      const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve) =>
        requestAnimationFrame(() => {
          const data = new Uint8Array(width * height * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
          resolve(data);
        }),
      );
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      return {
        width,
        height,
        hasColour: bytes.some((v, i) => i % 4 !== 3 && v !== 0),
        hash: Array.from(digest, (v) => v.toString(16).padStart(2, "0")).join(""),
      };
    });
  await canvas.screenshot({ path: ".codex/previews/kart/phase4-neutral.png" });
  const neutral = await pixels();
  expect(neutral.hasColour).toBe(true);
  for (const [label, key, strength] of [
    ["Lens dirt", "lens-dirt", "0.15"],
    ["Bloom", "bloom", "0.35"],
    ["Ambient occlusion", "ao", "0.25"],
    ["Tilt shift", "tilt-shift", "1"],
  ] as const) {
    await page.getByLabel(`Enable ${label.toLowerCase()}`, { exact: true }).check();
    await page.getByLabel(`${label} strength`, { exact: true }).fill(strength);
    if (key === "bloom") await page.getByLabel("Bloom threshold").fill("0.5");
    if (key === "tilt-shift") {
      await page.getByLabel("Tilt shift focus distance (metres)").fill("4");
      await page.getByLabel("Tilt shift focus range (metres)").fill("2");
    }
    await expect(canvas).toHaveAttribute(`data-look-${key}`, "true");
    await expect(canvas).toHaveAttribute(
      "data-look-depth-textures",
      key === "ao" || key === "tilt-shift" ? "1" : "0",
    );
    expect((await pixels()).hash).not.toBe(neutral.hash);
    await page.getByLabel("Look quality").selectOption("low");
    await expect(canvas).toHaveAttribute(`data-look-${key}`, "false");
    await expect(canvas).toHaveAttribute("data-look-depth-textures", "0");
    await page.getByLabel("Look quality").selectOption("high");
    await page.getByRole("button", { name: "Reset to neutral look" }).click();
    await expect(canvas).toHaveAttribute("data-look-active", "false");
    expect(await pixels()).toEqual(neutral);
  }
  await page.getByLabel("Look preset", { exact: true }).selectOption("warm");
  await expect(canvas).toHaveAttribute("data-look-active", "true");
  await expect(canvas).toHaveAttribute("data-look-passes", "2");
  await canvas.screenshot({ path: ".codex/previews/kart/phase4-warm.png" });
  expect((await pixels()).hash).not.toBe(neutral.hash);
  await page.getByLabel("Show original before grading").check();
  await expect(canvas).toHaveAttribute("data-look-buffers", "0");
  await canvas.screenshot({ path: ".codex/previews/kart/phase4-restored.png" });
  expect(await pixels()).toEqual(neutral);
  await page.getByLabel("Show original before grading").uncheck();
  await page.getByLabel("Look preset", { exact: true }).selectOption("daylight");
  await expect(canvas).toHaveAttribute("data-look-sky", "true");
  await expect(canvas).toHaveAttribute("data-look-reflection", "true");
  await page.getByLabel("Follow light shadows").check();
  await expect(canvas).toHaveAttribute("data-look-shadows", "true");
  await expect(canvas).toHaveAttribute("data-look-shadow-size", "1024");
  expect((await pixels()).hash).not.toBe(neutral.hash);
  await canvas.screenshot({ path: ".codex/previews/kart/phase4-daylight-shadows.png" });
  await page.getByLabel("Look quality").selectOption("low");
  await expect(canvas).toHaveAttribute("data-look-reflection", "false");
  await expect(canvas).toHaveAttribute("data-look-shadows", "false");
  await expect(canvas).toHaveAttribute("data-look-sky", "true");
  await page.getByLabel("Look quality").selectOption("high");
  await expect(canvas).toHaveAttribute("data-look-reflection", "true");
  await page.getByLabel("Show original before grading").check();
  await expect(canvas).toHaveAttribute("data-look-sky", "false");
  expect(await pixels()).toEqual(neutral);
  await page.getByLabel("Look preset", { exact: true }).selectOption("warm");
  await page.getByLabel("Filmic tone mapping").selectOption("agx");
  await page.getByLabel("Exposure (stops)").fill("0.5");
  await page.getByLabel("red from blue").fill("0.2");
  await page.getByLabel("red hue", { exact: true }).fill("10");
  await expect(canvas).toHaveAttribute("data-look-active", "true");
  await page.getByLabel("Look quality").selectOption("low");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-look-width")))
    .toBeLessThanOrEqual(1024);
  await page.getByRole("button", { name: "Export look preset" }).click();
  const exported = JSON.parse(await page.getByLabel("Look preset JSON").inputValue());
  expect(exported.grading.mixer[2]).toBe(0.2);
  expect(exported.grading.hsl.red.hue).toBe(10);
  await page
    .getByLabel("Look preset JSON")
    .fill(JSON.stringify({ ...exported, roomId: "private" }));
  await page.getByRole("button", { name: "Apply look preset" }).click();
  await expect(
    page.getByText("This is not a supported version 1 look preset."),
  ).toBeVisible();
  const supported = await canvas.evaluate((element) => {
    const ext = element.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!ext) return false;
    (window as unknown as { restoreLook: () => void }).restoreLook = () =>
      ext.restoreContext();
    ext.loseContext();
    return true;
  });
  expect(supported).toBe(true);
  await expect(
    page.getByText(
      "The circuit was interrupted. Race timing and the leaderboard continue.",
    ),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { restoreLook: () => void }).restoreLook(),
  );
  await expect(canvas).toHaveAttribute("data-look-active", "true");
  await page.getByLabel("Look quality").selectOption("high");
  await page.getByLabel("Look preset", { exact: true }).selectOption("race");
  await page.getByLabel("Look rehearsal script").selectOption("boost");
  await page.getByRole("button", { name: "Restart look script" }).click();
  await expect(canvas).toHaveAttribute("data-look-wind", "true");
  await expect(canvas).toHaveAttribute("data-look-chromatic", "true");
  await page.getByRole("button", { name: "Pause look sample" }).click();
  await expect(canvas).toHaveAttribute("data-look-wind", "false");
  await expect(canvas).toHaveAttribute("data-look-chromatic", "false");
  await page.getByRole("button", { name: "Resume look sample" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveAttribute("data-look-wind", "false");
  await expect(canvas).toHaveAttribute("data-look-chromatic", "false");
  await expect(canvas).toHaveAttribute("data-look-active", "true");
  await page.getByLabel("Look rehearsal script").selectOption("static");
  await page.getByRole("button", { name: "Reset to neutral look" }).click();
  await expect(canvas).toHaveAttribute("data-look-active", "false");
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 844],
    [740, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    const overflow = await page.evaluate(() => ({
      fits: document.documentElement.scrollWidth <= innerWidth + 1,
      width: innerWidth,
      items: Array.from(document.querySelectorAll("main *"))
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 6)
        .map((el) => ({
          tag: el.tagName,
          class: el.className,
          width: el.getBoundingClientRect().width,
        })),
    }));
    expect(overflow.fits, JSON.stringify(overflow)).toBe(true);
  }
  expect(
    await page
      .locator('input[type="number"]')
      .evaluateAll((inputs) =>
        inputs.every((input) => input.getBoundingClientRect().height >= 44),
      ),
  ).toBe(true);
  await page.screenshot({
    path: ".codex/previews/kart/phase4-grading-reduced.png",
    fullPage: true,
  });
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
  expect(errors).toEqual([]);
});
