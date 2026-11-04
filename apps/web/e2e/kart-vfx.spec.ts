import { expect, test } from "@playwright/test";

test("moving stand-in scripts rehearse tyre marks, dust, flight, contact and replayable finite finishes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /shader|WebGLProgram|GLSL/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=effects");
  const canvas = page.locator('canvas[aria-label="Your driving view"]');
  await page.getByLabel("Effects script").selectOption("drift");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-skids")))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause effects sample" }).click();
  await expect(canvas).toHaveAttribute("data-vfx-paused", "true");
  const stopped = await canvas.getAttribute("data-vfx-sample-ms");
  await page.waitForTimeout(150); // Verify that the scripted timeline pauses with its effects.
  expect(await canvas.getAttribute("data-vfx-sample-ms")).toBe(stopped);
  await page.getByRole("button", { name: "Resume effects sample" }).click();
  await page.getByLabel("Effects script").selectOption("dirt");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-dust")))
    .toBeGreaterThan(0);
  await page.getByLabel("Effects script").selectOption("flight");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-sample-ms")))
    .toBeGreaterThanOrEqual(2000);
  await expect(canvas).toHaveAttribute("data-vfx-dust", "0");
  await page.getByLabel("Effects script").selectOption("impact");
  // Observe finite bursts on rendered frames, rather than sparsely polling past them.
  await page.waitForFunction(() => {
    const view = document.querySelector<HTMLCanvasElement>(
      'canvas[aria-label="Your driving view"]',
    );
    return Number(view?.dataset.vfxSparks) > 0;
  });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-sample-ms")))
    .toBeGreaterThanOrEqual(3000);
  await expect(canvas).toHaveAttribute("data-vfx-sparks", "0");
  for (let replay = 0; replay < 2; replay++) {
    if (replay === 0) await page.getByLabel("Effects script").selectOption("finish");
    else await page.getByRole("button", { name: "Restart effects script" }).click();
    await page.waitForFunction(() => {
      const view = document.querySelector<HTMLCanvasElement>(
        'canvas[aria-label="Your driving view"]',
      );
      return (
        view?.dataset.vfxSampleMs === "3000" && Number(view.dataset.vfxConfetti) > 0
      );
    });
    await expect(canvas).toHaveAttribute("data-vfx-confetti", "0");
  }
  await page.screenshot({
    path: ".codex/previews/kart/phase3-moving-scripts.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("repeated effects scripts keep actual GPU resource counts stable across quality changes", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=effects");
  const canvas = page.locator('canvas[aria-label="Your driving view"]');
  await expect(canvas).toHaveAttribute("data-vehicle-detail", "detailed");
  await expect(
    page.getByText("Loading circuit model… Race timing follows the room."),
  ).toHaveCount(0);
  await expect(page.getByLabel("Local renderer resources")).toBeVisible();
  const read = () =>
    canvas.evaluate((view) => ({
      geometries: Number(view.dataset.vfxGeometries),
      textures: Number(view.dataset.vfxTextures),
      calls: Number(view.dataset.vfxCalls),
      triangles: Number(view.dataset.vfxTriangles),
      particles: Number(view.dataset.vfxParticles),
      skids: Number(view.dataset.vfxSkids),
    }));
  const samples = [await read()];
  for (const tier of ["low", "balanced", "high", "low", "balanced", "high"]) {
    await page.getByLabel("Effects quality").selectOption(tier);
    await page.getByLabel("Effects script").selectOption("drift");
    await page.getByRole("button", { name: "Restart effects script" }).click();
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector<HTMLCanvasElement>(
            'canvas[aria-label="Your driving view"]',
          )?.dataset.vfxSampleMs,
        ) >= 500,
    );
    const sample = await read();
    samples.push(sample);
    expect(sample.particles).toBeLessThanOrEqual(
      tier === "low" ? 128 : tier === "balanced" ? 512 : 1024,
    );
    expect(sample.skids).toBeLessThanOrEqual(
      tier === "low" ? 64 : tier === "balanced" ? 128 : 256,
    );
    expect(sample.geometries).toBe(samples[0]!.geometries);
    expect(sample.textures).toBe(samples[0]!.textures);
    expect(sample.calls).toBeGreaterThan(0);
  }
  await testInfo.attach("actual-renderer-resource-samples", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
  console.log("KART-VFX-RESOURCE-SAMPLES", JSON.stringify(samples));
  expect(errors).toEqual([]);
});

test("solo effects use native176, preserve the face while tuning and restore legacy effects", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
  await page.goto("/admin/kart?view=effects");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d")!;
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
      "--accent",
    );
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await page.getByLabel("Solo sample face").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.getByRole("button", { name: "Open solo effects rehearsal" }).click();
  const frame = page.frameLocator('iframe[title="Solo kart practice"]');
  await frame.getByRole("button", { name: "Start driving" }).click();
  const canvas = frame.locator("canvas");
  await expect(canvas).toHaveAttribute("data-solo-vfx", "preset");
  await expect(canvas).toHaveAttribute("data-vfx-native", "true");
  await expect(canvas).toHaveAttribute("data-three-revision", "176");
  await expect(canvas).toHaveAttribute("data-driver-faces", "1");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-particles")))
    .toBeGreaterThan(0);
  expect(Number(await canvas.getAttribute("data-vfx-particles"))).toBeLessThanOrEqual(
    1024,
  );
  await frame.getByRole("button", { name: "Pause", exact: true }).click();
  const frozen = await canvas.getAttribute("data-vfx-particles");
  await page.waitForTimeout(150); // Prove paused practice does not advance emission.
  expect(await canvas.getAttribute("data-vfx-particles")).toBe(frozen);
  await page.getByLabel("Emission rate").fill("32");
  await expect(canvas).toHaveAttribute("data-driver-faces", "1");
  await page.getByLabel("Enable sample effects").uncheck();
  await expect(canvas).toHaveAttribute("data-vfx-particles", "0");
  await page.getByLabel("Enable sample effects").check();
  await frame.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-particles")))
    .toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveAttribute("data-vfx-particles", "0");
  await page.getByLabel("Use new effects in solo rehearsal").uncheck();
  await expect(canvas).toHaveAttribute("data-solo-vfx", "legacy");
  await expect(canvas).toHaveAttribute("data-driver-faces", "1");
  expect(
    await page.locator('iframe[title="Solo kart practice"]').getAttribute("src"),
  ).toBe("/kart-engine/index.html");
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
  expect(errors).toEqual([]);
});

test("the isolated effects bench compiles real shaders, pauses, disables and validates exports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /shader|WebGLProgram|GLSL/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=effects");
  const canvas = page.locator('canvas[aria-label="Your driving view"]');
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-particles")))
    .toBeGreaterThan(0);
  expect(Number(await canvas.getAttribute("data-vfx-particles"))).toBeLessThanOrEqual(
    1024,
  );
  await page.getByRole("button", { name: "Pause effects sample" }).click();
  await page.getByLabel("Enable sample effects").uncheck();
  await expect(canvas).toHaveAttribute("data-vfx-particles", "0");
  await page.getByLabel("Enable sample effects").check();
  await page.getByRole("button", { name: "Resume effects sample" }).click();
  await page.getByLabel("Particle shape").selectOption("mesh");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-particles")))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Export effects preset" }).click();
  const exported = JSON.parse(await page.getByLabel("VFX preset export").inputValue());
  expect(exported.version).toBe(1);
  expect(exported.renderMode).toBe("mesh");
  await page.getByLabel("Effects quality").selectOption("low");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-particles")))
    .toBeLessThanOrEqual(128);
  await expect(canvas).toHaveAttribute("data-karts", "3");
  await page.getByLabel("Effects quality").selectOption("balanced");
  await expect(canvas).toHaveAttribute("data-karts", "5");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-vfx-particles")))
    .toBeLessThanOrEqual(512);
  await page.screenshot({
    path: ".codex/previews/kart/phase3-effects-active.png",
    fullPage: true,
  });
  await page
    .getByLabel("VFX preset export")
    .fill(JSON.stringify({ ...exported, size: 100 }));
  await page.getByRole("button", { name: "Apply exported preset" }).click();
  await expect(page.getByText(/not a supported version 1/)).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveAttribute("data-vfx-particles", "0");
  await page.screenshot({
    path: ".codex/previews/kart/phase3-effects-bench.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBe(true);
  expect(
    await page
      .getByLabel("Emission rate")
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
});
