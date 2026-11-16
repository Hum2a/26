import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

function localRuntimeProcesses() {
  if (process.platform !== "win32") return null;
  try {
    return JSON.parse(
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "@(Get-Process -Name workerd -ErrorAction SilentlyContinue | Select-Object Id,CPU,WorkingSet) | ConvertTo-Json -Compress",
        ],
        { windowsHide: true, timeout: 3000, encoding: "utf8" },
      ) || "[]",
    ) as unknown;
  } catch {
    return { unavailable: true };
  }
}

// Separate from renderer measurements: no phone or WebGL context is opened.
// A failure here must remain a failure, even if a later request recovers.
test("local runtime remains responsive with 50 simulated racers without WebGL", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Kart", exact: true }).click();
  await page.getByRole("button", { name: "Create kart lobby" }).click();
  await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/live$/);
  const code = (
    await page.locator(".admin-live-side .admin-side-code").innerText()
  ).trim();
  const drivingBots = new Set<object>();
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => {
      const text = String(frame.payload);
      if (!text.startsWith("{")) return;
      const packet = JSON.parse(text) as { name?: string; input?: { gas?: boolean } };
      if (packet.name === "kart-input" && packet.input?.gas) drivingBots.add(socket);
    }),
  );
  await page.getByRole("link", { name: "Developer tools", exact: true }).click();
  await page.getByLabel("Bot count", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Apply bot count", exact: true }).click();
  await expect(page.getByRole("region", { name: "Rehearsal results" })).toContainText(
    "50 / 50",
    { timeout: 30_000 },
  );
  await page
    .getByRole("button", { name: "Enable automatic answers", exact: true })
    .click();
  await page.getByLabel("Send kart controls at 10 per second").check();
  const live = page;
  const stage = await page.context().newPage();
  const processes: { before: unknown; afterTraffic: unknown; afterCommand: unknown } = {
    before: null,
    afterTraffic: null,
    afterCommand: null,
  };
  let frames = 0;
  let moving = false;
  stage.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => {
      const text = String(frame.payload);
      if (!text.startsWith("{")) return;
      const packet = JSON.parse(text) as {
        kart?: { participantCount: number; participants: { speed: number }[] };
      };
      if (packet.kart) {
        frames++;
        moving ||=
          packet.kart.participantCount === 50 &&
          packet.kart.participants.some((driver) => driver.speed > 0);
      }
    }),
  );
  try {
    await stage.goto("/host?code=" + code);
    await stage.getByRole("button", { name: "Connect room", exact: true }).click();
    await stage
      .getByRole("button", { name: "Present on this screen", exact: true })
      .click();
    processes.before = localRuntimeProcesses();
    await live.getByRole("button", { name: "Start kart race", exact: true }).click();
    await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
      "data-phase",
      "intro",
    );
    for (const phase of ["prompt", "collect"]) {
      const response = live.waitForResponse(
        (response) =>
          response.url().includes("/api/rooms/play") &&
          response.request().method() === "POST",
      );
      await live.getByRole("button", { name: "Advance beat", exact: true }).click();
      expect((await response).status()).toBe(200);
      await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
        "data-phase",
        phase,
      );
    }
    await expect.poll(() => drivingBots.size).toBe(50);
    await expect.poll(() => moving).toBe(true);
    await page.waitForTimeout(20_000);
    processes.afterTraffic = localRuntimeProcesses();
    const began = Date.now();
    const health = fetch("http://localhost:4173/api/health", {
      signal: AbortSignal.timeout(5000),
    }).then(async (response) => {
      await response.arrayBuffer();
      return { status: response.status, milliseconds: Date.now() - began };
    });
    const pause = Promise.all([
      Promise.race([
        live.waitForResponse(
          (response) =>
            response.url().includes("/api/rooms/play") &&
            response.request().method() === "POST",
        ),
        live
          .waitForEvent("requestfailed", {
            predicate: (request) => request.url().includes("/api/rooms/play"),
          })
          .then((request) => {
            throw new Error(
              "Host pause request failed: " + request.failure()?.errorText,
            );
          }),
      ]),
      live.getByRole("button", { name: "Pause game", exact: true }).click(),
    ]).then(([response]) => ({
      status: response.status(),
      milliseconds: Date.now() - began,
    }));
    const results = await Promise.allSettled([health, pause]);
    processes.afterCommand = localRuntimeProcesses();
    const evidence = {
      diagnosticVersion: 2,
      runtimeVariant: process.env.KART_RUNTIME_VARIANT ?? "vite-locked",
      processes,
      population: 50,
      phoneContexts: 0,
      configuredInputHz: 10,
      observedDrivingBotConnections: drivingBots.size,
      moving,
      frames,
      results: results.map((result) =>
        result.status === "fulfilled"
          ? result
          : { status: result.status, reason: String(result.reason) },
      ),
    };
    await mkdir("artifacts/kart-fix-checks", { recursive: true });
    await writeFile(
      "artifacts/kart-fix-checks/runtime-without-webgl-v2.json",
      JSON.stringify(evidence, null, 2) + "\n",
    );
    console.log("KART-RUNTIME " + JSON.stringify(evidence));
    for (const result of results) {
      expect(result.status).toBe("fulfilled");
      if (result.status === "fulfilled") expect(result.value.status).toBe(200);
    }
    await expect(
      live.getByRole("button", { name: "Resume game", exact: true }),
    ).toBeVisible();
  } finally {
    await page.bringToFront().catch(() => undefined);
    await page
      .getByLabel("Send kart controls at 10 per second")
      .uncheck()
      .catch(() => undefined);
    await stage.close();
  }
});
