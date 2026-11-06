import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    kartTestPad: { axis: number; held: number[]; connected: boolean };
  }
}
// An explicit browser-input fixture. Physics, rooms, transport and renderers stay real.
async function installPad(page: Page) {
  await page.addInitScript(() => {
    window.kartTestPad = { axis: 0, held: [], connected: true };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => {
        const state = window.kartTestPad;
        return state.connected
          ? [
              {
                index: 0,
                connected: true,
                axes: [state.axis],
                buttons: Array.from({ length: 8 }, (_, i) => ({
                  pressed: state.held.includes(i),
                  touched: state.held.includes(i),
                  value: state.held.includes(i) ? 1 : 0,
                })),
              },
            ]
          : [];
      },
    });
  });
}
async function pad(page: Page, axis = 0, held: number[] = [], connected = true) {
  await page.evaluate(
    (state) => {
      Object.assign(window.kartTestPad, state);
    },
    { axis, held, connected },
  );
}
async function signIn(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("real Controls bench supports shared gamepad, fresh resume, shortcuts, tuning and opt-in mouse", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await installPad(page);
  await signIn(page);
  await page.goto("/admin/kart?view=controls");
  const bench = page.getByRole("region", { name: "Kart controls rehearsal" });
  const output = bench.getByLabel("Current driving input");
  await expect(bench.getByText("Gamepad connected", { exact: true })).toBeVisible();
  await pad(page, 0.8, [0]);
  await expect(output).toContainText("Accelerate on");
  await expect(output).toContainText("Steering 0.76");
  await bench.getByRole("button", { name: "Pause controls" }).click();
  await expect(output).toContainText("Accelerate off");
  await bench.getByRole("button", { name: "Resume controls" }).click();
  await expect(output).toContainText("Accelerate off");
  await pad(page);
  await expect(
    bench.getByRole("button", { name: "Accelerate", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("e");
  await page.keyboard.press("r");
  await expect(bench.getByText("Item attempts: 1 · Recoveries: 1")).toBeVisible();
  await bench.getByRole("button", { name: "Controls", exact: true }).click();
  await bench.getByLabel("Steering response").focus();
  await page.keyboard.press("Home");
  await expect(bench.getByLabel("Steering response")).toHaveValue("0.5");
  await bench.getByLabel("Enable mouse steering area").check();
  await bench.getByRole("button", { name: "Back to driving" }).click();
  const area = bench.getByRole("group", { name: "Mouse steering area" });
  await area.scrollIntoViewIfNeeded();
  const box = (await area.boundingBox())!;
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
  await page.mouse.down();
  await expect(output).toContainText("Steering 1.00");
  await page.mouse.up();
  await expect(output).toContainText("Steering 0.00");
  await pad(page, 0, [0]);
  await expect(output).toContainText("Accelerate on");
  await pad(page, 0, [], false);
  await expect(output).toContainText("Accelerate off");
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 844],
    [740, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    const headingBox = (await bench
      .getByRole("heading", { name: "Controls bench" })
      .boundingBox())!;
    const controlsBox = (await bench.locator(".kart-controller-shell").boundingBox())!;
    expect(controlsBox.y).toBeGreaterThanOrEqual(headingBox.y + headingBox.height);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({
    path: ".codex/previews/kart/phase5-controls-bench.png",
    fullPage: true,
  });
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
  expect(errors).toEqual([]);
});

test("native solo consumes the same gamepad controls and releases them through pause and recovery", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installPad(page);
  await page.goto("/kart-engine/index.html");
  await page.getByRole("button", { name: "Start driving", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("Gamepad connected", { exact: true })).toBeVisible();
  await pad(page, 0, [0]);
  await expect
    .poll(async () =>
      parseInt(await page.getByLabel("Speed", { exact: true }).innerText()),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Keep driving", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await pad(page);
  await expect(page.getByText("Gamepad connected", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to track", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("r");
  await expect(
    page.getByText("Back on track — controls released", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

test("connected gamepad uses the existing intent socket, releases on host pause and receipts keyboard recovery", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  await page.goto("/admin/kart");
  const created = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/rooms" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create kart lobby", exact: true }).click();
  expect((await created).ok()).toBe(true);
  await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/live$/);
  const code = (
    await page.locator(".admin-live-side .admin-side-code").innerText()
  ).trim();
  await page.getByRole("button", { name: "Use arcade bounce handling" }).click();
  await expect(
    page.getByText("Next race: Arcade bounce.", { exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const phone = await context.newPage();
    await installPad(phone);
    const inputs: { gas: boolean; steer: number; keys: string[] }[] = [];
    let sockets = 0,
      recoveries = 0;
    const impacts = new Map<number, number>();
    const profiles = new Set<string>();
    phone.on("pageerror", (error) => errors.push(error.message));
    phone.on("websocket", (socket) => {
      if (new URL(socket.url()).pathname === "/") return;
      sockets++;
      socket.on("framereceived", (frame) => {
        if (
          typeof frame.payload !== "string" ||
          !frame.payload.trimStart().startsWith("{")
        )
          return;
        const message = JSON.parse(frame.payload);
        expect(message).not.toHaveProperty("kartContactHistory");
        expect(message.snapshot ?? {}).not.toHaveProperty("kartContactHistory");
        expect(message.set ?? {}).not.toHaveProperty("kartContactHistory");
        for (const target of [message, message.snapshot ?? {}, message.set ?? {}]) {
          expect(target).not.toHaveProperty("kartHandlingHistory");
          expect(target).not.toHaveProperty("kartHandling");
          expect(target).not.toHaveProperty("kartRecap");
        }
        const kart =
          message.kind === "kart"
            ? message.kart
            : message.kind === "snapshot"
              ? message.snapshot?.play?.kart
              : undefined;
        if (kart?.presentation?.version === 2)
          profiles.add(kart.presentation.handling?.preset ?? "slide-v1");
        if (kart?.presentation?.version === 2)
          for (const event of kart.presentation.contacts)
            impacts.set(event.eventId, event.atMs);
      });
      socket.on("framesent", (frame) => {
        // The existing clock synchronisation also sends plain `time:` frames.
        if (
          typeof frame.payload !== "string" ||
          !frame.payload.trimStart().startsWith("{")
        )
          return;
        const message = JSON.parse(frame.payload);
        if (message.name === "kart-input" && inputs.length < 500)
          inputs.push({
            gas: message.input.gas,
            steer: message.input.steer,
            keys: Object.keys(message.input).sort(),
          });
        if (message.name === "kart-recover") recoveries++;
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
    for (let phase = 0; phase < 2; phase++)
      await page.getByRole("button", { name: "Advance", exact: true }).click();
    const accelerate = phone.getByRole("button", { name: "Accelerate", exact: true });
    await expect(accelerate).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Use original slide handling" }),
    ).toBeDisabled();
    await phone.bringToFront();
    await phone.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(phone.getByText("Gamepad connected", { exact: true })).toBeVisible();
    await pad(phone, 0.4, [0]);
    await expect.poll(() => inputs.at(-1)?.gas).toBe(true);
    // The phone's speed is projected by the room, rather than self prediction.
    await expect
      .poll(async () =>
        parseInt(await phone.locator(".kart-telemetry-labels span").last().innerText()),
      )
      .toBeGreaterThan(0);
    expect(inputs.at(-1)!.keys).toEqual([
      "brake",
      "drift",
      "gas",
      "raceId",
      "sequence",
      "steer",
    ]);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(accelerate).toBeDisabled();
    await expect.poll(() => inputs.at(-1)?.gas).toBe(false);
    const resumedAt = inputs.length;
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(accelerate).toBeEnabled();
    await phone.waitForTimeout(250); // Observe more than two input heartbeats with the original button still held.
    expect(inputs.slice(resumedAt).every((input) => !input.gas)).toBe(true);
    await pad(phone);
    await expect(accelerate).toHaveAttribute("aria-pressed", "false");
    await phone.bringToFront();
    await phone.keyboard.press("r");
    await expect.poll(() => recoveries).toBe(1);
    await expect(
      phone.getByText("Back on track — controls released", { exact: true }),
    ).toBeVisible();
    // Drive the real straight into a real boundary, then observe accepted
    // contact metadata and the host's private live history on the same sockets.
    await expect(accelerate).toBeEnabled();
    await pad(phone);
    await phone.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await pad(phone, 0, [0]);
    await expect.poll(() => inputs.at(-1)?.gas).toBe(true);
    await expect.poll(() => impacts.size, { timeout: 15_000 }).toBeGreaterThan(0);
    await pad(phone);
    const history = page.getByRole("list", {
      name: "Recent kart contacts and recoveries",
    });
    const observedImpactAt = impacts.values().next().value!;
    await expect(
      history.getByRole("listitem").filter({
        hasText: `Barrier impact · ${(observedImpactAt / 1000).toFixed(2)}s`,
      }),
    ).toBeVisible();
    await expect(history.getByText(/Back to track/)).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Race recap" })
        .getByText(/Back to track 1 time/),
    ).toBeVisible();
    expect(profiles).toEqual(new Set(["bounce-v1"]));
    expect(sockets).toBe(1);
    expect(errors).toEqual([]);
    await phone.getByRole("button", { name: "Show small map", exact: true }).click();
    await expect(
      phone.locator('.kart-driver-viewport[data-inset="true"]'),
    ).toBeVisible();
    await expect(phone.getByLabel("Your heading", { exact: true })).toBeVisible();
    for (const [width, height] of [
      [320, 568],
      [430, 844],
      [740, 360],
    ]) {
      await phone.setViewportSize({ width: width!, height: height! });
      expect(
        await phone.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await phone.screenshot({
        path: `.codex/previews/kart/phase6-navigation-${width}.png`,
        fullPage: true,
      });
      await expect
        .poll(() =>
          phone.evaluate(() => {
            const names = [
              ".kart-steering",
              ".kart-pedals",
              ".kart-control-options",
              ".kart-inset-toggle",
              ".kart-view-toggle",
              ".kart-phone-hud",
              ".kart-telemetry",
            ];
            const map = document
              .querySelector(".kart-driver-map")
              ?.getBoundingClientRect();
            if (!map) return ["Missing map"];
            const overlaps = (a: DOMRect, b: DOMRect) =>
              a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top;
            const issues = names.flatMap((name) => {
              const element = document.querySelector(name);
              if (!element || !element.getClientRects().length)
                return [`Missing or hidden ${name}`];
              const rect = element.getBoundingClientRect();
              return overlaps(map, rect)
                ? [
                    `${innerWidth}×${innerHeight} map overlaps ${name}: ${JSON.stringify({ map: map.toJSON(), control: rect.toJSON() })}`,
                  ]
                : [];
            });
            const inset = document
              .querySelector(".kart-inset-toggle")!
              .getBoundingClientRect();
            const tools = document
              .querySelector(".kart-control-options")!
              .getBoundingClientRect();
            if (overlaps(inset, tools))
              issues.push(
                `${innerWidth}×${innerHeight} inset button overlaps secondary tools`,
              );
            return issues;
          }),
        )
        .toEqual([]);
    }
    await phone.screenshot({
      path: ".codex/previews/kart/phase6-connected-navigation.png",
      fullPage: true,
    });
    await phone.screenshot({
      path: ".codex/previews/kart/phase5-connected-controls.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
