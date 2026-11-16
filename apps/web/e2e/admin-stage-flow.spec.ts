import { expect, test, type Page } from "@playwright/test";
const sizes = [
  { width: 320, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
async function layout(page: Page, name: string) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `.codex/previews/admin-redesign/${name}-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  const overflowing = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("main *, .entry-main *")]
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 6)
      .map((el) => `${el.tagName}.${el.className}`),
  }));
  expect(
    overflowing.scroll,
    `${name}: ${JSON.stringify(overflowing)}`,
  ).toBeLessThanOrEqual(overflowing.width + 1);
}
test("admin controls, phone recovery and the restricted projector work together", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(240_000);
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Create a lobby", exact: true }).click();
  const code = (await page.locator(".admin-room-code").innerText()).trim();
  const room = new URL(page.url()).pathname;
  const gameId = room.split("/").at(-1)!;
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const phone = await phoneContext.newPage();
  await phone.goto(`/j/${code}`);
  await phone.getByLabel("Nickname").fill("Amina");
  await phone.getByRole("button", { name: "Join", exact: true }).click();
  await expect(phone.getByRole("heading", { name: "In the lobby" })).toBeVisible();
  // A join code and even a guest identity confer no projector authority.
  const denied = await phoneContext.newPage();
  await denied.goto(`/screen?code=${code}`);
  await denied.getByRole("button", { name: "Connect room" }).click();
  await expect(
    denied.getByRole("button", { name: "Present on this screen" }),
  ).toBeDisabled();
  await expect(denied.getByText("No room is connected.")).toHaveCount(0);
  await denied.close();
  const stage = await context.newPage();
  const frames: string[] = [];
  let projectorCommands = 0;
  stage.on("request", (request) => {
    if (request.url().includes("/api/rooms/play")) projectorCommands++;
  });
  stage.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => frames.push(String(frame.payload))),
  );
  await stage.emulateMedia({ reducedMotion: "reduce" });
  await stage.goto(`/screen?code=${code}`);
  await stage.getByRole("button", { name: "Connect room" }).click();
  await expect(
    stage.getByRole("button", { name: "Present on this screen" }),
  ).toBeEnabled();
  for (const size of sizes) {
    await stage.setViewportSize(size);
    await layout(stage, "projector-setup");
  }
  await stage.getByRole("button", { name: "Present on this screen" }).click();
  await expect(
    stage.getByRole("main", { name: "Projector presentation" }),
  ).toBeFocused();
  await expect(stage.getByRole("heading", { name: "In the lobby" })).toBeVisible();
  await expect(stage.getByRole("navigation")).toHaveCount(0);
  await expect(stage.getByRole("textbox")).toHaveCount(0);
  for (const key of ["Space", "p", "h", "d", "o"]) await stage.keyboard.press(key);
  expect(projectorCommands).toBe(0);
  expect(await stage.locator(".stage-safe-outline").count()).toBe(0);
  for (const size of sizes) {
    await stage.setViewportSize(size);
    await layout(stage, "projector-lobby");
  }
  await stage.keyboard.press("Escape");
  await expect(stage.getByRole("heading", { name: "Projector setup" })).toBeVisible();
  await expect(
    stage.getByRole("button", { name: "Present on this screen" }),
  ).toBeFocused();
  await stage.getByRole("button", { name: "Present on this screen" }).press("Enter");
  await page.goto(`${room}/live`);
  await page
    .getByRole("button", { name: "Start the illustrative demo instead" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start the demo", exact: true })
    .click();
  for (
    let i = 0;
    i < 5 &&
    !(await stage.getByRole("heading", { name: "Answers are open" }).isVisible());
    i++
  ) {
    await page.getByRole("button", { name: "Advance", exact: true }).click();
    await expect(page.locator(".admin-command-feedback[aria-busy=true]")).toHaveCount(
      0,
    );
  }
  await expect(stage.getByRole("heading", { name: "Answers are open" })).toBeVisible();
  await phone.getByRole("button", { name: "Circle", exact: true }).click();
  await phone.getByRole("button", { name: "Send answer" }).click();
  await expect(phone.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(stage.getByText("Paused.", { exact: true })).toBeVisible();
  await phone.reload();
  await expect(phone.locator(".skin-status[role=status]")).toContainText("paused");
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled();
  for (const size of sizes) {
    await stage.setViewportSize(size);
    await layout(stage, "projector-question");
    if (size.width >= 1280) {
      await expect(stage.locator(".stage-prompt")).toBeInViewport({ ratio: 1 });
      for (const option of await stage.locator(".stage-option").all())
        await expect(option).toBeInViewport({ ratio: 1 });
      expect(
        await stage
          .getByRole("button", { name: "Projector setup" })
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBe(16);
    }
  }
  await stage.setViewportSize({ width: 1440, height: 900 });
  await stage.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await layout(stage, "projector-zoom-200");
  await stage.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(phone.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );
  await page.getByRole("button", { name: "More controls" }).click();
  await page
    .getByRole("button", { name: "Finish after this question", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finish after this question", exact: true })
    .click();
  for (
    let i = 0;
    i < 12 &&
    !(await page.getByText("The quiz is complete.", { exact: true }).isVisible());
    i++
  ) {
    const finish = page.getByRole("button", { name: "Finish quiz", exact: true });
    if (await finish.isVisible()) {
      await finish.click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Finish quiz", exact: true })
        .click();
    } else await page.getByRole("button", { name: "Advance", exact: true }).click();
    await expect(page.locator(".admin-command-feedback[aria-busy=true]")).toHaveCount(
      0,
    );
    const hide = page.getByRole("button", { name: "Hide stage content", exact: true });
    if (await hide.isVisible()) {
      await hide.click();
      await expect(
        stage.getByRole("heading", { name: "Hidden by the host." }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Show stage content", exact: true })
        .click();
    }
  }
  await expect(
    stage.getByRole("heading", { name: "Podium", exact: true }),
  ).toBeVisible();
  expect(frames.join("\n")).not.toMatch(
    /adminPlayers|presenterNotes|deviceDiagnostics|demo-answer-key-v1/,
  );
  await page.getByRole("link", { name: "Results", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Final standings", exact: true }),
  ).toBeVisible();
  await phone.goto(`/r/${gameId}`);
  await expect(async () => {
    await phone.reload();
    await expect(phone.getByRole("heading", { name: "What a night." })).toBeVisible();
  }).toPass({ timeout: 20_000, intervals: [1000] });
  // Exercise every layout family at the requested widths and actual 200% browser CSS zoom.
  for (const path of [
    "/",
    "/join",
    "/admin",
    "/admin/content",
    room,
    `${room}/live`,
    `${room}/players`,
    `${room}/media`,
    `${room}/results`,
    `${room}/health`,
    `/r/${gameId}`,
    "/screen",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const size of sizes) {
      await page.setViewportSize(size);
      await layout(page, `polish-${path.replaceAll("/", "-") || "home"}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await layout(page, `zoom-${path.replaceAll("/", "-") || "home"}`);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
  }
  await phoneContext.close();
});

test("all question designs keep prompts, options and reveals readable", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design?surface=stage&still=1");
  await expect(page.getByRole("combobox", { name: /^Design/ })).toBeVisible();
  const ids = await page
    .getByRole("combobox", { name: /^Design/ })
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
  expect(ids.length).toBeGreaterThanOrEqual(10);
  for (const id of ids)
    for (const surface of ["phone", "stage"])
      for (const phase of ["collect", "reveal"])
        for (const width of surface === "stage" ? [320, 768, 1280, 1920] : [320, 390]) {
          await page.setViewportSize(
            surface === "phone"
              ? { width, height: 844 }
              : { width, height: width === 1920 ? 1080 : 800 },
          );
          await page.goto(`/design?q=${id}&surface=${surface}&phase=${phase}&still=1`);
          await expect(
            page.locator(surface === "stage" ? ".design-stage" : ".design-phone"),
          ).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `${id} ${surface} ${phase} ${width}`,
          ).toBe(true);
          if (surface === "stage") {
            const prompt = page.locator(".design-stage-prompt").first();
            if (await prompt.count())
              expect(
                await prompt.evaluate((el) =>
                  parseFloat(getComputedStyle(el).fontSize),
                ),
              ).toBeGreaterThanOrEqual(48);
            const control = page.locator(".design-stage").first();
            expect(await control.evaluate((el) => getComputedStyle(el).opacity)).toBe(
              "1",
            );
          }
          await page.screenshot({
            path: `.codex/previews/admin-redesign/design-${id}-${surface}-${phase}-${width}.png`,
            fullPage: true,
          });
        }
});
