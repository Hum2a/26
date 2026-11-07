import { expect, test } from "@playwright/test";
test("real track catalogue projects selected grid/recovery/driving slots and renders all three installed courses without a room", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname.startsWith("/ws/")) sockets.push(socket.url());
  });
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const workspace = page.getByRole("navigation", { name: "Admin workspace" });
  await expect(workspace).toBeVisible();
  await workspace.getByRole("link", { name: "Kart", exact: true }).click();
  await page.getByRole("button", { name: "Tracks & modes", exact: true }).click();
  const bench = page.getByRole("region", { name: "Tracks and modes catalogue" });
  const overview = bench.getByRole("img", {
    name: "Live race map: 80 drivers",
    exact: true,
  });
  await expect(
    bench.getByRole("heading", { name: "Mario circuit · Imported circuit" }),
  ).toBeVisible();
  await expect(
    bench.getByRole("list", { name: "Course mode availability" }),
  ).toContainText("One-lap time trial · Available");
  await bench.getByLabel("Starting-grid slot", { exact: true }).selectOption("80");
  await bench.getByLabel("Preview state", { exact: true }).selectOption("recovery");
  await expect(bench).toContainText("slot 80 · actual shared recovery");
  await bench.getByRole("button", { name: "Open 3D grid preview" }).click();
  await expect(bench.locator(".kart-driver-view")).toHaveAttribute(
    "data-readiness",
    "usable",
    { timeout: 20_000 },
  );
  expect(await bench.locator("canvas").count()).toBe(1);
  await bench.getByLabel("Preview track", { exact: true }).selectOption("26-park-v1");
  await expect(
    bench.getByRole("heading", { name: "26 Park · Original party course" }),
  ).toBeVisible();
  await expect(overview.locator('[data-track-road="26-park-v1"]')).toBeVisible();
  await expect(
    bench.getByRole("list", { name: "Course mode availability" }),
  ).toContainText("Connected race · Pending");
  await expect(bench.locator(".kart-driver-view")).toHaveAttribute(
    "data-readiness",
    "usable",
    { timeout: 20_000 },
  );
  expect(await bench.locator("canvas").count()).toBe(1);
  const drivenResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/admin/kart-tracks" &&
      url.searchParams.get("track") === "26-park-v1" &&
      url.searchParams.get("beat") === "drive"
    );
  });
  await bench.getByLabel("Preview state", { exact: true }).selectOption("drive");
  const driven = await (await drivenResponse).json();
  expect(driven.phone.elapsedMs).toBe(3000);
  expect(driven.phone.participants[0].number).toBe(80);
  await expect(bench).toContainText("actual shared driving after three seconds");
  await expect(bench.locator(".kart-driver-view")).toHaveAttribute(
    "data-readiness",
    "usable",
    { timeout: 20_000 },
  );
  await page.screenshot({
    path: ".codex/previews/kart/phase8-park-driving.png",
    fullPage: true,
  });
  await bench.getByLabel("Graphics", { exact: true }).selectOption("high");
  await expect(bench.locator("canvas")).toHaveAttribute(
    "data-vehicle-detail",
    "detailed",
    { timeout: 20_000 },
  );
  await page.screenshot({
    path: ".codex/previews/kart/phase8-park-detailed.png",
    fullPage: true,
  });
  await bench.getByLabel("Graphics", { exact: true }).selectOption("low");
  await expect(bench.locator("canvas")).toHaveAttribute(
    "data-vehicle-detail",
    "simple",
  );
  await expect(overview.locator('[data-track-road="26-park-v1"]')).toBeVisible();
  await bench
    .getByLabel("Preview track", { exact: true })
    .selectOption("party-ring-v1");
  await expect(
    bench.getByRole("heading", { name: "Party ring · Original party course" }),
  ).toBeVisible();
  await expect(
    bench.getByRole("list", { name: "Course mode availability" }),
  ).toContainText("Free drive · Pending");
  await expect(bench.locator(".kart-driver-view")).toHaveAttribute(
    "data-readiness",
    "usable",
    { timeout: 20_000 },
  );
  expect(await bench.locator("canvas").count()).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bench.getByRole("button", { name: "Close 3D grid preview" }).click();
  await expect(bench.locator("canvas")).toHaveCount(0);
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 844],
    [740, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: ".codex/previews/kart/phase8-track-catalogue.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(sockets).toEqual([]);
});
