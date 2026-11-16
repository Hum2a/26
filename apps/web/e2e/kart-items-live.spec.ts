import { expect, test } from "@playwright/test";

test("live expanded items use host controls and a personal Treats boost on the real phone", async ({
  page,
  browser,
}) => {
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
  await expect(page.getByRole("navigation", { name: "Admin workspace" })).toBeVisible();
  await page.goto("/admin/kart");
  await page.getByRole("button", { name: "Create kart lobby", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/live$/);
  const controls = page.getByRole("region", { name: "Kart items", exact: true });
  await expect(controls).toBeVisible();
  const choices = controls.getByRole("checkbox");
  for (let i = 0; i < (await choices.count()); i++) await choices.nth(i).uncheck();
  await controls.getByLabel("Treats boost", { exact: true }).check();
  await controls.getByRole("button", { name: "Save expanded items" }).click();
  await expect(controls).toContainText("Next race: Expanded items");
  const code = (
    await page.locator(".admin-live-side .admin-side-code").innerText()
  ).trim();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const standIns = [];
  try {
    // Two labelled real phones put the driven phone in the centre grid lane.
    // A straight-only driver in the outside lane correctly misses the centre item boxes.
    for (const name of ["Stand-in One", "Stand-in Two"]) {
      const standIn = await browser.newContext();
      standIns.push(standIn);
      const guest = await standIn.newPage();
      await guest.goto(`/j/${code}`);
      await guest.getByLabel("Nickname").fill(name);
      await guest.getByRole("button", { name: "Join", exact: true }).click();
      await expect(guest.getByRole("heading", { name: "In the lobby" })).toBeVisible();
    }
    const phone = await context.newPage();
    phone.on("pageerror", (error) => errors.push(error.message));
    const items: { heldItem: string | null; projectiles: unknown[] }[] = [];
    let acceptedUses = 0,
      uses = 0;
    const useIds = new Set<string>();
    phone.on("websocket", (socket) => {
      if (!new URL(socket.url()).pathname.startsWith("/ws/")) return;
      expect(new URL(socket.url()).searchParams.get("kartItems")).toBe("2");
      socket.on("framesent", (frame) => {
        if (typeof frame.payload !== "string" || !frame.payload.startsWith("{")) return;
        const message = JSON.parse(frame.payload);
        if (message.name === "kart-use-item") {
          uses++;
          useIds.add(message.requestId);
        }
      });
      socket.on("framereceived", (frame) => {
        if (typeof frame.payload !== "string" || !frame.payload.startsWith("{")) return;
        const message = JSON.parse(frame.payload);
        for (const target of [message, message.snapshot ?? {}, message.set ?? {}])
          expect(target).not.toHaveProperty("kartItems");
        const race =
          message.kind === "kart" ? message.kart : message.snapshot?.play?.kart;
        if (race?.presentation?.version === 3) items.push(race.presentation.items);
        if (message.kind === "ack" && message.accepted && useIds.has(message.requestId))
          acceptedUses++;
      });
    });
    await phone.goto(`/j/${code}`);
    await phone.getByLabel("Nickname").fill("Amina");
    await phone.getByRole("button", { name: "Join", exact: true }).click();
    await expect(phone.getByRole("heading", { name: "In the lobby" })).toBeVisible();
    await page.getByRole("button", { name: "Start kart race", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Start kart race", exact: true })
      .click();
    for (let i = 0; i < 2; i++)
      await page.getByRole("button", { name: "Advance", exact: true }).click();
    await expect(
      controls.getByRole("button", { name: "Save expanded items" }),
    ).toBeDisabled();
    await phone.bringToFront();
    await expect(
      phone.getByRole("button", { name: "Accelerate", exact: true }),
    ).toBeEnabled();
    await phone.keyboard.down("w");
    const use = phone.getByRole("button", { name: "Use Treats boost", exact: true });
    await expect(use).toBeEnabled({ timeout: 15_000 });
    await phone.keyboard.up("w");
    await use.click();
    await expect.poll(() => acceptedUses).toBe(1);
    expect(uses).toBe(1);
    expect(items.some((item) => item.heldItem === "treat")).toBe(true);
    expect(items.every((item) => item.projectiles.length === 0)).toBe(true);
    await expect(
      controls.getByRole("list", { name: "Recent item events" }),
    ).toContainText("use · Treats boost · Amina");
    await controls.getByRole("button", { name: "Stop item spawning" }).click();
    await expect(controls).toContainText("Item spawning stopped");
    await controls.getByRole("button", { name: "Clear track items" }).click();
    await expect(
      controls.getByRole("list", { name: "Recent item events" }),
    ).toContainText("clear");
    await controls.getByRole("button", { name: "Resume item spawning" }).click();
    await expect(controls).toContainText("Item spawning on");
    await phone.screenshot({
      path: ".codex/previews/kart/phase7-live-treats.png",
      fullPage: true,
    });
    await page.screenshot({
      path: ".codex/previews/kart/phase7-live-items-admin.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    for (const standIn of standIns) await standIn.close();
  }
});
