import { expect, test, type BrowserContext, type Page } from "@playwright/test";

test("an illustrative quiz runs for the host, the stage, and three phones", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const host = await browser.newContext();
  const aminaContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const bilalContext = await browser.newContext();
  const chenContext = await browser.newContext();
  const frames: string[] = [];
  const amina = await aminaContext.newPage();
  amina.on("websocket", (socket) => {
    socket.on("framereceived", (frame) => {
      frames.push(String(frame.payload ?? ""));
    });
  });

  const admin = await host.newPage();
  await signIn(admin);
  await admin.getByRole("button", { name: "Create a lobby" }).click();
  await expect(
    admin.getByRole("heading", { name: "Ready for the room." }),
  ).toBeVisible();
  const joinCode =
    (await admin.locator(".admin-room-code").textContent())?.trim() ?? "";
  expect(joinCode).toHaveLength(6);
  await admin.getByRole("link", { name: "Live controls", exact: true }).click();

  const stage = await host.newPage();
  await stage.goto(`/host?code=${joinCode}`);
  await stage.getByRole("button", { name: "Connect room" }).click();
  await stage.getByRole("button", { name: "Present on this screen" }).click();
  await expect(stage.getByRole("heading", { name: "In the lobby" })).toBeVisible();
  await expect(stage.getByRole("button", { name: "Pause" })).toHaveCount(0);

  await join(amina, joinCode, "Amina");
  await join(await bilalContext.newPage(), joinCode, "Bilal");
  await join(await chenContext.newPage(), joinCode, "Chen");
  const bilal = bilalContext.pages()[0];
  const chen = chenContext.pages()[0];
  if (!bilal || !chen) {
    throw new Error("The guest pages did not open.");
  }

  await admin.getByRole("button", { name: "Start the illustrative demo" }).click();
  await expect(admin.getByText("The illustrative demo has started.")).toBeVisible();
  await expect(stage.getByRole("heading", { name: "Get ready" })).toBeVisible();
  await advanceUntil(admin, stage, "Answers are open");
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Choose an answer.",
  );
  expect(frames.join("\n")).not.toContain("correctOptionId");
  expect(frames.join("\n")).not.toContain("demo-answer-key-v1");

  const overflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);

  await amina.getByRole("button", { name: "Circle", exact: true }).click();
  await amina.getByRole("button", { name: "Send answer" }).click();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );
  await expect(stage.getByText("1 answer in.")).toBeVisible();

  await admin.getByRole("button", { name: "Pause" }).click();
  await expect(bilal.locator(".skin-status[role=status]")).toContainText(
    "The game is paused.",
  );
  await expect(stage.getByText("Paused.", { exact: true })).toBeVisible();
  await admin.getByRole("button", { name: "Resume" }).click();
  await expect(bilal.locator(".skin-status[role=status]")).toContainText(
    "Choose an answer.",
  );

  await bilal.getByRole("button", { name: "Square", exact: true }).click();
  await bilal.getByRole("button", { name: "Send answer" }).click();
  await expect(bilal.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );
  await expect(stage.getByText("2 answers in.")).toBeVisible();

  await amina.reload();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );

  await advanceUntil(admin, stage, "The answer is Circle.");
  expect(frames.join("\n")).not.toContain("demo-answer-key-v1");
  expect(frames.join("\n")).toContain("correctOptionId");
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "You were right.",
  );
  await expect(bilal.locator(".skin-status[role=status]")).toContainText(
    "That was not the answer.",
  );
  await expect(chen.locator(".skin-status[role=status]")).toContainText(
    "No answer was received.",
  );
  await expect(stage.getByRole("heading", { name: "The reveal" })).toBeVisible();
  await expect(stage.getByText(/1\. Amina —/)).toBeVisible();

  await bilal.reload();
  await expect(bilal.locator(".skin-status[role=status]")).toContainText(
    "That was not the answer.",
  );

  await advanceUntil(admin, stage, "how many letters are in birthday?");
  await advanceUntil(admin, stage, "Answers are open");
  await bilal.getByRole("button", { name: /Play a troll/ }).click();
  await bilal.getByRole("button", { name: "Cracked screen" }).click();
  await bilal.getByRole("button", { name: "Troll Amina", exact: true }).click();
  await bilal.getByRole("button", { name: "Send troll" }).click();
  await bilal.getByRole("button", { name: "Confirm" }).click();
  await expect(amina.getByRole("dialog", { name: "Demo crack" })).toBeVisible();
  const trollOverflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(trollOverflow).toBe(false);
  await expect(stage.getByText(/Bilal used Cracked screen on Amina/)).toBeVisible();
  await amina.getByRole("button", { name: "Dismiss" }).click();
  await expect(amina.getByRole("dialog", { name: "Demo crack" })).toHaveCount(0);
  expect(frames.join("\n")).not.toContain('"truth"');
  const slider = amina.getByRole("slider", { name: "Estimate" });
  // A phase can reach the projector before the phone's socket/render catches up.
  // Keyboard events do not wait for an input to become enabled like click/fill do.
  await expect(slider).toBeEnabled();
  await expect(slider).toHaveValue("10");
  await slider.press("ArrowLeft");
  await slider.press("ArrowLeft");
  await expect(slider).toHaveValue("8");
  await amina.getByRole("button", { name: "Higher" }).click();
  await expect(slider).toHaveValue("9");
  await amina.getByRole("button", { name: "Lower" }).click();
  await expect(slider).toHaveValue("8");
  const sliderOverflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(sliderOverflow).toBe(false);
  await amina.getByRole("button", { name: "Send estimate" }).click();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );
  await amina.reload();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );
  await expect(amina.getByRole("slider", { name: "Estimate" })).toHaveValue("8");

  await advanceUntil(admin, stage, "The answer is 8 letters.");
  expect(frames.join("\n")).toContain('"truth"');
  await expect(
    stage.getByText("Amina guessed 8 letters and scored 100."),
  ).toBeVisible();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Exact. You scored 100",
  );

  await advanceUntil(admin, stage, "put these in the party order.");
  await advanceUntil(admin, stage, "Answers are open");
  expect(frames.join("\n")).not.toContain('"itemIds"');
  for (const [item, tier] of [
    ["Friends", "1st"],
    ["Cake", "2nd"],
    ["Song", "3rd"],
    ["Candles", "4th"],
  ] as const) {
    await amina.getByRole("button", { name: item, exact: true }).click();
    await amina.getByRole("button", { name: tier, exact: true }).click();
  }
  const rankOverflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(rankOverflow).toBe(false);
  await amina.getByRole("button", { name: "Send ranking" }).click();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );
  await amina.reload();
  await expect(amina.getByText("Friends · 1st")).toBeVisible();

  await advanceUntil(admin, stage, "The order is Friends, Cake, Song, Candles.");
  await expect(stage.getByText(/Amina scored 80/)).toBeVisible();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "You scored 80 for that ranking.",
  );

  await advanceUntil(admin, stage, "write a short toast.");
  await advanceUntil(admin, stage, "Answers are open");
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Write an answer.",
  );
  await amina.getByLabel("Your line").fill("Cheers from Amina");
  await bilal.getByLabel("Your line").fill("Cheers from Bilal");
  const textOverflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(textOverflow).toBe(false);
  await amina.getByRole("button", { name: "Send line" }).click();
  await bilal.getByRole("button", { name: "Send line" }).click();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );
  await expect(bilal.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );

  await advanceUntil(admin, stage, "Voting");
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Choose one answer.",
  );
  const ballot = amina.locator("[data-ballot] button");
  await expect(ballot).toHaveCount(2);
  const ballotOrder = await ballot.allTextContents();
  await amina.getByRole("button", { name: "Cheers from Bilal" }).click();
  await bilal.getByRole("button", { name: "Cheers from Amina" }).click();
  await bilal.getByRole("button", { name: "Send vote" }).click();
  await expect(bilal.locator(".skin-status[role=status]")).toContainText(
    "Vote accepted.",
  );
  expect(await ballot.allTextContents()).toEqual(ballotOrder);
  const ballotOverflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ballotOverflow).toBe(false);
  await amina.getByRole("button", { name: "Send vote" }).click();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Vote accepted.",
  );
  await amina.reload();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Vote accepted.",
  );
  await expect(amina.locator("[data-ballot] button")).toHaveText(ballotOrder);

  await advanceUntil(admin, stage, "2 answers won");
  await expect(stage.getByText(/Amina wrote it/)).toBeVisible();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "You scored 60 for your line.",
  );

  await advanceUntil(admin, stage, "write a spare line.");
  await advanceUntil(admin, stage, "Answers are open");
  await amina.getByLabel("Your line").fill("Spare from Amina");
  await bilal.getByLabel("Your line").fill("Spare from Bilal");
  await amina.getByRole("button", { name: "Send line" }).click();
  await bilal.getByRole("button", { name: "Send line" }).click();
  await expect(bilal.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );
  await admin.getByRole("button", { name: "Include Bilal" }).click();
  await expect(admin.getByText("That answer is on the ballot.")).toBeVisible();

  await advanceUntil(admin, stage, "Voting");
  await expect(amina.getByRole("button", { name: "Spare from Bilal" })).toBeVisible();
  await expect(amina.getByRole("button", { name: /Spare from Amina/ })).toHaveCount(0);
  await amina.getByRole("button", { name: "Spare from Bilal" }).click();
  await amina.getByRole("button", { name: "Send vote" }).click();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Vote accepted.",
  );

  await advanceUntil(admin, stage, "1 answer won");
  await expect(stage.getByText(/wrote it/)).toHaveCount(0);
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Your line scored 0.",
  );

  await advanceUntil(admin, stage, "who is holding the playlist?");
  await advanceUntil(admin, stage, "Answers are open");
  expect(frames.join("\n")).not.toContain("truthNickname");
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Choose a player.",
  );
  await amina
    .getByRole("textbox", { name: "Find a player", exact: true })
    .and(amina.locator(".skin-field"))
    .fill("Bil");
  await amina.getByRole("button", { name: "Bilal", exact: true }).click();
  const guessOverflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(guessOverflow).toBe(false);
  await amina.getByRole("button", { name: "Send guess" }).click();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );

  await advanceUntil(admin, stage, "The answer is Bilal.");
  expect(frames.join("\n")).not.toContain("truthNickname");
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "You scored 80 for that guess.",
  );

  await advanceUntil(admin, stage, "closer to 26");
  await expect(amina.locator(".skin-status[role=status]")).toContainText(/You face/);
  await advanceUntil(admin, stage, "Answers are open");
  for (const phone of [amina, bilal, chen]) {
    await phone.getByLabel("Your number").fill("26");
  }
  const duelOverflow = await amina.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(duelOverflow).toBe(false);
  await amina.getByRole("button", { name: "Send number" }).click();
  await bilal.getByRole("button", { name: "Send number" }).click();
  await chen.getByRole("button", { name: "Send number" }).click();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "Answer accepted.",
  );

  await advanceUntil(admin, stage, "Podium");
  expect(frames.join("\n")).not.toContain('"kind":"finale"');
  await expect(
    stage.getByRole("heading", { name: "Podium", exact: true }),
  ).toBeVisible();
  await expect(amina.locator(".skin-status[role=status]")).toContainText(
    "The quiz has ended.",
  );
  await expect(amina.locator(".skin-status[role=status]")).toContainText("1st");
  await expect(chen.locator(".skin-status[role=status]")).toContainText(
    "The quiz has ended.",
  );

  await closeAll(host, aminaContext, bilalContext, chenContext);
});

async function signIn(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "You are signed in as" }),
  ).toContainText("You are signed in as humzab1711@hotmail.com.");
}

async function join(page: Page, code: string, nickname: string) {
  await page.goto("/join");
  await page.getByLabel("Join code").fill(code);
  await page.getByLabel("Nickname").fill(nickname);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("status")).toContainText(
    `You are in. This phone is ${nickname}.`,
  );
}

async function advanceUntil(admin: Page, stage: Page, text: string) {
  for (let step = 0; step < 40; step += 1) {
    if (
      await stage
        .getByText(text)
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }
    const phase = stage.locator("[data-phase-motion]");
    const previous = (await phase.getAttribute("data-phase")) ?? "";
    await Promise.all([
      admin.waitForResponse(
        (response) =>
          response.url().includes("/api/rooms/play") && response.status() === 200,
      ),
      (async () => {
        const finish = admin.getByRole("button", { name: "Finish quiz", exact: true });
        if (await finish.isVisible()) {
          await finish.click();
          await admin
            .getByRole("dialog")
            .getByRole("button", { name: "Finish quiz", exact: true })
            .click();
        } else
          await admin.getByRole("button", { name: "Advance", exact: true }).click();
      })(),
    ]);
    await expect(phase).not.toHaveAttribute("data-phase", previous, { timeout: 5_000 });
  }
  await expect(stage.getByText(text)).toBeVisible();
}

async function closeAll(...contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close()));
}
