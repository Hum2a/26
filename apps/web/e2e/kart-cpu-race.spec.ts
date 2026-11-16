import { expect, test } from "@playwright/test";

/**
 * One guest against three CPU racers on Park: the host adds CPU racers, the
 * guest hits the throttle on GO for a boosted start, and the CPU field drives
 * itself round the course on the projector.
 */
test("a lone guest races CPU racers, gets a boosted start and sees the CPU field move", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
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
  await page.getByRole("button", { name: "Create kart lobby", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/rooms\/[A-Z0-9]+\/live/);
  const region = page.getByRole("region", { name: "Kart course selection" });
  await region.getByLabel("Course for this race").selectOption("26-park-v1");
  await region.getByLabel("CPU racers").selectOption("3");
  await region.getByRole("button", { name: "Save course" }).click();
  await expect(region).toContainText("3 CPU racers");
  const code = (
    await page.locator(".admin-live-side .admin-side-code").innerText()
  ).trim();
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 390, height: 844 },
  });
  const phone = await context.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  const stage = await page.context().newPage();
  const frames: {
    participants?: { playerId: string; progress: number; cpu?: true }[];
  }[] = [];
  stage.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => {
      if (typeof frame.payload !== "string" || !frame.payload.startsWith("{")) return;
      const message = JSON.parse(frame.payload) as { kind?: string; kart?: never };
      if (message.kind === "kart" && message.kart) frames.push(message.kart);
    }),
  );
  try {
    await phone.goto(`/j/${code}`);
    await phone.getByLabel("Nickname").fill("Amina");
    await phone.getByRole("button", { name: "Join", exact: true }).click();
    await expect(phone.getByRole("heading", { name: "In the lobby" })).toBeVisible();
    await stage.goto(`/host?code=${code}`);
    await stage.getByRole("button", { name: "Connect room" }).click();
    await stage.getByRole("button", { name: "Present on this screen" }).click();
    await page.getByRole("button", { name: "Start kart race", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Start kart race", exact: true })
      .click();
    await page.getByRole("button", { name: "Advance", exact: true }).click();
    await phone.bringToFront();
    // Hit the throttle the moment the race opens.
    const gas = phone.getByRole("button", { name: "Accelerate", exact: true });
    await page.getByRole("button", { name: "Advance", exact: true }).click();
    await expect(gas).toBeEnabled();
    await phone.keyboard.down("ArrowUp");
    await expect(phone.getByText(/PERFECT START!|Good start!/)).toBeVisible({
      timeout: 5_000,
    });
    // The projector lists the CPU racers, tagged.
    const board = stage.getByRole("complementary", { name: "Race leaderboard" });
    await expect(board).toContainText("CPU Turbo Tess");
    await expect(board).toContainText("CPU · Kart");
    // The CPU field drives itself.
    await expect
      .poll(
        () => {
          const latest = frames.at(-1)?.participants ?? [];
          return latest.filter((d) => d.cpu && d.progress > 0.05).length;
        },
        { timeout: 30_000 },
      )
      .toBe(3);
    await stage.screenshot({ path: "artifacts/kart-cpu-race-stage.png" });
    await phone.keyboard.up("ArrowUp");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await stage.close();
  }
});
