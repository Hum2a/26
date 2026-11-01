import { expect, test } from "@playwright/test";

test("the appearance rehearsal fits phones, browses 100 players and animates real notifications", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/settings");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Presentation rehearsal" }),
  ).toBeVisible();
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 430, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.getByRole("button", { name: "Next players" }).click();
      await expect(page.getByText("11–20 of 100")).toBeVisible();
      await page.getByRole("button", { name: "Back to leaders" }).click();
      await page.getByRole("button", { name: "Preview score changes" }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("button", { name: "Preview notification" }).click();
  await expect(page.locator("[data-sonner-toast]")).toContainText(
    "12 players have locked in",
  );
  await page.screenshot({
    path: ".codex/previews/party-design/scoreboard-and-toast.png",
    fullPage: true,
  });
  await page
    .getByRole("region", { name: "Sample standings panel" })
    .screenshot({ path: ".codex/previews/party-design/scoreboard.png" });
  await page.goto("/admin/settings?theme=pokemon-pallet-town");
  await expect(page.getByText("1–10 of 100")).toBeVisible();
  await page.getByRole("button", { name: "Preview notification" }).click();
  await expect(page.locator("[data-sonner-toast]")).toContainText(
    "12 players have locked in",
  );
  await page.screenshot({
    path: ".codex/previews/party-design/light-theme.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("a real fifty-player kart scoreboard fits the projector and keeps every player reachable", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await page.goto("/admin/kart");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Create kart lobby" }).click();
  const code = (
    await page.locator(".admin-live-side .admin-side-code").innerText()
  ).trim();
  const guestContext = await browser.newContext();
  const enrol = await guestContext.newPage();
  await enrol.goto("/join");
  await enrol.evaluate(async (code) => {
    const modulePath = "/src/live/room-api.ts";
    const { joinLobby } = await import(/* @vite-ignore */ modulePath);
    for (let start = 0; start < 50; start += 5) {
      await Promise.all(
        Array.from({ length: 5 }, async (_, offset) => {
          const result = await joinLobby({
            code,
            nickname: `Sample driver ${start + offset + 1}`,
            requestId: crypto.randomUUID(),
          });
          if ("error" in result) throw new Error(result.error);
        }),
      );
    }
  }, code);
  const stage = await page.context().newPage();
  await stage.setViewportSize({ width: 1920, height: 1080 });
  await stage.goto(`/host?code=${code}`);
  await stage.getByRole("button", { name: "Connect room" }).click();
  await stage.getByRole("button", { name: "Present on this screen" }).click();
  await page.getByRole("button", { name: "Start kart race", exact: true }).click();
  await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
    "data-phase",
    "intro",
  );
  for (const phase of ["prompt", "collect"]) {
    await page.getByRole("button", { name: "Advance", exact: true }).click();
    await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
      "data-phase",
      phase,
    );
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await expect(stage.locator("[data-map-player]")).toHaveCount(50);
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
  ]) {
    await stage.setViewportSize(viewport);
    const board = stage.getByRole("complementary", { name: "Race leaderboard" });
    await stage.screenshot({
      path: `.codex/previews/party-design/projector-${viewport.width}.png`,
    });
    expect(
      await board.evaluate(
        (element) => element.getBoundingClientRect().bottom <= innerHeight,
      ),
    ).toBe(true);
    expect(
      await stage
        .locator(".projector-footer")
        .evaluate((element) => element.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    expect(
      await stage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await stage.screenshot({
      path: `.codex/previews/party-design/projector-${viewport.width}.png`,
    });
  }
  for (let i = 0; i < 4; i++)
    await stage.getByRole("button", { name: "Next players" }).click();
  await expect(stage.getByText("41–50 of 50")).toBeVisible();
  await stage.getByRole("button", { name: "Back to leaders" }).click();
  await expect(stage.getByText("1–10 of 50")).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  for (const phase of ["reveal", "scores"]) {
    await page.getByRole("button", { name: "Advance", exact: true }).click();
    await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
      "data-phase",
      phase,
    );
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
  ]) {
    await stage.setViewportSize(viewport);
    await stage.screenshot({
      path: `.codex/previews/party-design/standings-${viewport.width}.png`,
    });
    expect(
      await stage
        .getByRole("region", { name: "Scoreboard panel" })
        .evaluate((element) => element.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
  }
  await guestContext.close();
});
