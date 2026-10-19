import { expect, test } from "@playwright/test";

test("live desk and player tools keep actions deliberate and private across devices", async ({
  page,
  browser,
  context,
}) => {
  test.setTimeout(180_000);
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Create a lobby", exact: true }).click();
  const code = (await page.locator(".admin-room-code").innerText()).trim();
  const roomUrl = page.url();
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const guest = await guestContext.newPage();
  await guest.goto(`/j/${code}`);
  await guest.getByLabel("Nickname").fill("Amina");
  await guest.getByRole("button", { name: "Join", exact: true }).click();
  await expect(guest.getByRole("heading", { name: "In the lobby" })).toBeVisible();
  const stage = await context.newPage();
  const stageFrames: string[] = [];
  stage.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => stageFrames.push(String(frame.payload))),
  );
  await stage.goto(`/host?code=${code}`);
  await stage.getByRole("button", { name: "Connect room" }).click();
  await stage.getByRole("button", { name: "Present on this screen" }).click();

  await page.getByRole("link", { name: "Players", exact: true }).click();
  await page.getByRole("button", { name: /^Select Amina,/ }).click();
  await page.getByLabel("New nickname").fill("Mina");
  await page.getByRole("button", { name: "Review rename" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "player ID, answers and score stay",
  );
  await page.getByRole("button", { name: "Rename player", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mina", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Score", exact: true }).click();
  await page.getByLabel("Score adjustment", { exact: true }).fill("-25");
  await page.getByLabel("Reason", { exact: true }).fill("Private operator correction");
  await page.getByRole("button", { name: "Review score change" }).click();
  await page.getByRole("button", { name: "Confirm score adjustment" }).click();
  await expect(page.getByLabel("Player details")).toContainText("-25 points");
  await expect(page.getByLabel("Player details")).toContainText(
    "Private operator correction",
  );

  await page.getByRole("button", { name: "Phones", exact: true }).click();
  await page.getByRole("button", { name: "Transfer Mina" }).click();
  await page.getByRole("button", { name: "Create transfer code" }).click();
  await expect(
    page.getByRole("heading", { name: "Private device code" }),
  ).toBeVisible();
  const transferCode = (
    await page.locator(".admin-private-code .admin-side-code").innerText()
  ).trim();
  await page.getByRole("button", { name: "Hide code" }).click();
  await expect(page.getByText(transferCode, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Remove Mina" }).click();
  await page.getByRole("button", { name: "Remove player", exact: true }).click();
  await expect(page.getByRole("button", { name: "Recover Mina" })).toBeVisible();
  await page.getByRole("button", { name: "Recover Mina" }).click();
  await page.getByRole("button", { name: "Recover player", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Private recovery code" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hide code" }).click();

  await page.getByRole("button", { name: "Score", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review score change" })).toBeVisible();
  // Browse the actual populated page at phone, tablet and desktop sizes.
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    if ([390, 1280, 1920].includes(width))
      await page.screenshot({
        path: `.codex/previews/admin-redesign/players-${width}.png`,
        fullPage: true,
      });
  }
  await page.goto(`${roomUrl}/live`);
  await page.getByRole("button", { name: "Start the illustrative demo" }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled();
  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    if (width >= 1280) {
      const bounds = await page.getByLabel("Current question").boundingBox();
      expect(bounds!.y).toBeLessThan(650);
      await expect(
        page.getByRole("button", { name: "Resume", exact: true }),
      ).toBeInViewport();
    }
    if ([390, 1280, 1920].includes(width))
      await page.screenshot({
        path: `.codex/previews/admin-redesign/live-${width}.png`,
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: /More controls/ }).click();
  await page
    .getByRole("button", { name: "Finish after this question", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "current question will finish first",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finish after this question", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Finish after this question", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finish after this question", exact: true })
    .click();
  await expect(
    page.getByText("The quiz will finish after this question.").last(),
  ).toBeVisible();
  for (
    let step = 0;
    step < 12 &&
    !(await page.getByText("The quiz is complete.", { exact: true }).isVisible());
    step++
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
  }
  await expect(
    stage.getByRole("heading", { name: "Podium", exact: true }),
  ).toBeVisible();
  const publicText = stageFrames.join("\n");
  expect(publicText).not.toContain("adminPlayers");
  expect(publicText).not.toContain("Private operator correction");
  expect(publicText).not.toContain(transferCode);
  expect(publicText).not.toContain("presenterNotes");
  await guestContext.close();
});
