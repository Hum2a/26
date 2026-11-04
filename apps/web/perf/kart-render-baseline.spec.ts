import { mkdir, writeFile } from "node:fs/promises";
import WebSocket from "ws";
import type { KartRaceView } from "@26/shared";
import { expect, test, type Page } from "@playwright/test";

type ProbeSample = {
  durationMs: number;
  rafFrames: number;
  visible: boolean;
  gaps: number[];
  drawCalls: number[];
  contexts: number;
  capped: boolean;
};
type ProbeWindow = Window & {
  __kartRenderProbe: { start(): void; stop(): ProbeSample };
};

// Explicit local measurements using the real room, bot fleet and renderers.
// Draw submissions and RAF cadence are not physical GPU presentation timings.
for (const size of [1, 16, 21, 50, 80]) {
  test(
    "records connected rendering with " + size + " simulated racers",
    async ({ page, browser }, testInfo) => {
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
      const phoneContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        reducedMotion: "no-preference",
      });
      const phone = await phoneContext.newPage();
      const live = page;
      const stage = await page.context().newPage();
      const drivingBots = new Set<object>();
      page.on("websocket", (socket) =>
        socket.on("framesent", (frame) => {
          const text = String(frame.payload);
          if (!text.startsWith("{")) return;
          const packet = JSON.parse(text) as {
            name?: string;
            input?: { gas?: boolean };
          };
          if (packet.name === "kart-input" && packet.input?.gas)
            drivingBots.add(socket);
        }),
      );
      const errors: string[] = [];
      live.on("requestfailed", (request) =>
        console.log(
          "KART-HOST-REQUEST-FAILED " +
            JSON.stringify({
              population: size,
              path: new URL(request.url()).pathname,
              error: request.failure()?.errorText,
            }),
        ),
      );
      const observation: {
        race: { trackId: string; participantCount: number } | null;
      } = { race: null };
      let humanMoved = false;
      let motionFailure: unknown;
      const controlEvidence: {
        gasPackets: number;
        lastSequence: number;
        selfCursor: number | null;
        human: unknown;
        self: unknown;
      } = { gasPackets: 0, lastSequence: 0, selfCursor: null, human: null, self: null };
      phone.on("websocket", (socket) => {
        socket.on("framesent", (frame) => {
          const text = String(frame.payload);
          if (!text.startsWith("{")) return;
          const packet = JSON.parse(text) as {
            name?: string;
            input?: { sequence: number; gas: boolean };
          };
          if (packet.name === "kart-input" && packet.input) {
            if (packet.input.gas) controlEvidence.gasPackets++;
            controlEvidence.lastSequence = packet.input.sequence;
          }
        });
        socket.on("framereceived", (frame) => {
          const text = String(frame.payload);
          if (!text.startsWith("{")) return;
          const packet = JSON.parse(text) as {
            kart?: KartRaceView;
            snapshot?: { play?: { kart?: KartRaceView } };
            set?: { play?: { kart?: KartRaceView } };
          };
          const race =
            packet.kart ?? packet.snapshot?.play?.kart ?? packet.set?.play?.kart;
          if (!race) return;
          controlEvidence.selfCursor = race.inputCursor ?? null;
          const self = race.participants.find(
            (driver) => driver.playerId === race.selfPlayerId,
          );
          if (self)
            controlEvidence.self = {
              speed: self.speed,
              x: self.x,
              z: self.z,
              number: self.number,
              status: self.status,
            };
        });
      });
      let closeWorkerObserver = () => {};
      stage.on("websocket", (socket) =>
        socket.on("framereceived", (frame) => {
          const text = String(frame.payload);
          if (!text.startsWith("{")) return;
          const packet = JSON.parse(text) as {
            kart?: {
              trackId: string;
              participantCount: number;
              participants: { name: string; speed: number }[];
            };
            snapshot?: {
              play?: {
                kart?: {
                  trackId: string;
                  participantCount: number;
                  participants: { name: string; speed: number }[];
                };
              };
            };
            set?: {
              play?: {
                kart?: {
                  trackId: string;
                  participantCount: number;
                  participants: { name: string; speed: number }[];
                };
              };
            };
          };
          const race =
            packet.kart ?? packet.snapshot?.play?.kart ?? packet.set?.play?.kart;
          if (race) {
            observation.race = {
              trackId: race.trackId,
              participantCount: race.participantCount,
            };
            const human = race.participants.find(
              (driver) => driver.name === "Render stand-in",
            );
            if (human) controlEvidence.human = human;
            humanMoved ||= race.participants.some(
              (driver) => driver.name === "Render stand-in" && driver.speed > 0,
            );
          }
        }),
      );
      phone.on("pageerror", (error) => errors.push(error.message));
      stage.on("pageerror", (error) => errors.push(error.message));
      try {
        await installProbe(phone);
        await installProbe(stage);
        await phone.goto("/j/" + code);
        await phone.getByLabel("Nickname").fill("Render stand-in");
        await phone.getByRole("button", { name: "Join", exact: true }).click();
        await expect(
          phone.getByRole("heading", { name: "In the lobby" }),
        ).toBeVisible();
        await page.getByRole("link", { name: "Developer tools", exact: true }).click();
        await page.getByLabel("Bot count", { exact: true }).fill(String(size - 1));
        await page
          .getByRole("button", { name: "Apply bot count", exact: true })
          .click();
        await expect(
          page.getByRole("region", { name: "Rehearsal results" }),
        ).toContainText(size - 1 + " / " + (size - 1), { timeout: 30_000 });
        if (size > 1) {
          await page
            .getByRole("button", {
              name: "Enable automatic answers",
              exact: true,
            })
            .click();
          await page.getByLabel("Send kart controls at 10 per second").check();
        }
        // The Developer tab owns the sole control socket and keeps its fleet alive.
        await stage.setViewportSize({ width: 1440, height: 900 });
        await stage.emulateMedia({ reducedMotion: "no-preference" });
        await stage.goto("/host?code=" + code);
        await stage.getByRole("button", { name: "Connect room", exact: true }).click();
        await stage
          .getByRole("button", { name: "Present on this screen", exact: true })
          .click();
        const profileRequested = testInfo.project.metadata.captureWorkerCPU !== false;
        const observer = profileRequested ? await openWorkerObserver() : undefined;
        closeWorkerObserver = () => observer?.close();
        await live
          .getByRole("button", { name: "Start kart race", exact: true })
          .click();
        for (const phase of ["intro", "prompt", "collect"]) {
          if (phase !== "intro")
            await live
              .getByRole("button", { name: "Advance beat", exact: true })
              .click();
          await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
            "data-phase",
            phase,
          );
        }
        await expect(stage.locator("[data-map-player]")).toHaveCount(size);
        await expect.poll(() => drivingBots.size).toBe(size - 1);
        await expect(
          page.getByRole("region", { name: "Rehearsal results" }),
        ).toContainText(size - 1 + " / " + (size - 1));
        await expect
          .poll(() => observation.race)
          .toEqual({ trackId: "mario-circuit-v1", participantCount: size });
        await expect(
          phone.locator('canvas[aria-label="Your driving view"]'),
        ).toBeVisible();
        await phone.bringToFront();
        const pedal = phone.getByRole("button", { name: "Accelerate", exact: true });
        const phoneSample = await measure(phone, async () => {
          const steering = phone.getByRole("slider", { name: "Steering", exact: true });
          await steering.focus();
          for (let n = 0; n < 10; n++) await steering.press("ArrowLeft");
          await expect(steering).toHaveValue("-0.1");
          await pedal.hover();
          await phone.mouse.down();
          await expect(pedal).toHaveAttribute("aria-pressed", "true");
        });
        await expect(pedal).toHaveAttribute("aria-pressed", "true");
        await phone.mouse.up();
        const canvas = await phone
          .locator('canvas[aria-label="Your driving view"]')
          .evaluate((node: HTMLCanvasElement) => ({
            width: node.width,
            height: node.height,
            cssWidth: node.clientWidth,
            cssHeight: node.clientHeight,
            containerWidth: node.parentElement!.clientWidth,
            containerHeight: node.parentElement!.clientHeight,
            viewportWidth: window.innerWidth,
          }));
        expect(canvas.cssWidth).toBe(canvas.containerWidth);
        expect(canvas.cssHeight).toBe(canvas.containerHeight);
        try {
          await expect.poll(() => humanMoved).toBe(true);
        } catch (error) {
          console.log(
            "KART-CONTROL-EVIDENCE " +
              JSON.stringify({ population: size, ...controlEvidence }),
          );
          motionFailure = error;
        }
        const graphics = await phone
          .locator(".kart-graphics [role=status]")
          .textContent();
        expect(phoneSample.contexts).toBeGreaterThan(0);
        expect(phoneSample.drawFrames).toBeGreaterThan(0);
        await expect(
          phone.getByRole("button", { name: "Retry circuit", exact: true }),
        ).toHaveCount(0);
        if (size === 1 || size === 21 || size === 80) {
          await mkdir(".codex/previews/kart", { recursive: true });
          await phone.screenshot({
            path: ".codex/previews/kart/kart-phone-dpr2-" + size + ".png",
          });
        }
        await phone
          .getByRole("button", { name: "Use lightweight map", exact: true })
          .click();
        await expect(phone.locator("canvas")).toHaveCount(0);
        const stageSample = await measure(stage);
        expect(stageSample.rafFrames).toBeGreaterThan(0);
        expect(stageSample.drawFrames).toBe(0);
        expect(errors).toEqual([]);
        // Keep one stable server-only window after unmounting phone WebGL.
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const result = {
          methodVersion: 10,
          observedDrivingBotConnections: drivingBots.size,
          motionVerified: !motionFailure,
          configuredHumanSteer: -0.1,
          cpuProfileRequested: profileRequested,
          runtime: testInfo.config.metadata.kartRuntime ?? "vite-development",
          runtimeVariant: process.env.KART_RUNTIME_VARIANT ?? "vite-locked",
          paused: false,
          hostPauseResponseMs: null as number | null,
          environment:
            "Local workerd and headless Chromium; co-resident bot fleet; not physical devices or GPU presentation FPS",
          population: size,
          botConnections: size - 1,
          configuredBotInputHz: size > 1 ? 10 : 0,
          track: observation.race?.trackId,
          phone: { ...phoneSample, canvas, graphics },
          stage: stageSample,
          worker: null as Awaited<
            ReturnType<Awaited<ReturnType<typeof openWorkerObserver>>["finish"]>
          > | null,
          errors,
        };
        const resultPath =
          "artifacts/kart-fix-checks/render-baseline-v10-" +
          (profileRequested ? "profiled-" : "rendering-") +
          size +
          ".json";
        await mkdir("artifacts/kart-fix-checks", { recursive: true });
        await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n");
        await live.bringToFront();
        const pauseBegan = Date.now();
        const [pauseResponse] = await Promise.all([
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
        ]);
        result.hostPauseResponseMs = Date.now() - pauseBegan;
        expect(pauseResponse.status()).toBe(200);
        await expect(
          live.getByRole("button", { name: "Resume game", exact: true }),
        ).toBeVisible();
        await phone.bringToFront();
        await expect(
          phone.getByRole("button", { name: "Accelerate", exact: true }),
        ).toBeDisabled();
        result.paused = true;
        await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n");
        if (observer && profileRequested) result.worker = await observer.finish(size);
        await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n");
        console.log("KART-RENDER " + JSON.stringify(result));
        // Preserve the original motion failure after collecting the command boundary.
        if (motionFailure) throw motionFailure;
      } finally {
        closeWorkerObserver();
        const pause = live.getByRole("button", { name: "Pause game", exact: true });
        if (
          (await pause.isVisible().catch(() => false)) &&
          (await pause.isEnabled().catch(() => false))
        ) {
          await live.bringToFront().catch(() => undefined);
          await pause.click({ timeout: 5000 }).catch(() => undefined);
        }
        await phone.mouse.up().catch(() => undefined);
        await phoneContext.close();
        await stage.close();
        await live.close();
      }
    },
  );
}

async function installProbe(page: Page) {
  await page.addInitScript(() => {
    let active = false,
      began = 0,
      stamp = 0,
      last = 0,
      contexts = 0,
      frames = 0,
      capped = false;
    let gaps: number[] = [];
    let draws = new Map<number, number>();
    const seen = new WeakSet<object>();
    const original = HTMLCanvasElement.prototype.getContext as (
      this: HTMLCanvasElement,
      kind: string,
      options?: unknown,
    ) => RenderingContext | null;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      options?: unknown,
    ) {
      const context = original.call(this, kind, options);
      if (context && (kind === "webgl" || kind === "webgl2") && !seen.has(context)) {
        seen.add(context);
        contexts++;
        const gl = context as unknown as Record<
          string,
          (...args: unknown[]) => unknown
        >;
        for (const method of [
          "drawElements",
          "drawArrays",
          "drawElementsInstanced",
          "drawArraysInstanced",
        ]) {
          const draw = gl[method];
          if (typeof draw !== "function") continue;
          gl[method] = function (this: RenderingContext, ...args: unknown[]) {
            if (active && stamp >= began) {
              if (draws.has(stamp) || draws.size < 2000)
                draws.set(stamp, (draws.get(stamp) ?? 0) + 1);
              else capped = true;
            }
            return draw.apply(this, args);
          };
        }
      }
      return context;
    } as typeof HTMLCanvasElement.prototype.getContext;
    function frame(now: number) {
      stamp = now;
      if (active) {
        frames++;
        if (last) {
          if (gaps.length < 2000) gaps.push(now - last);
          else capped = true;
        }
        last = now;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    (window as ProbeWindow).__kartRenderProbe = {
      start() {
        active = true;
        began = performance.now();
        last = 0;
        frames = 0;
        gaps = [];
        draws = new Map();
        capped = false;
      },
      stop() {
        active = false;
        return {
          durationMs: performance.now() - began,
          rafFrames: frames,
          visible: document.visibilityState === "visible",
          gaps,
          drawCalls: [...draws.values()],
          contexts,
          capped,
        };
      },
    };
  });
}

async function measure(page: Page, prepare?: () => Promise<void>) {
  await page.bringToFront();
  await prepare?.();
  // A measured warm-up, rather than pretending shader/asset startup is steady state.
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 2000)));
  const raw = await page.evaluate(async () => {
    const probe = (window as ProbeWindow).__kartRenderProbe;
    probe.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 4000));
    return probe.stop();
  });
  expect(raw.visible).toBe(true);
  expect(raw.capped).toBe(false);
  const sorted = [...raw.gaps].sort((a, b) => a - b);
  const seconds = raw.durationMs / 1000;
  return {
    seconds: Math.round(seconds * 100) / 100,
    rafFrames: raw.rafFrames,
    rafCallbacksPerSecond: Math.round((raw.rafFrames / seconds) * 10) / 10,
    rafGapP95Ms: sorted.length
      ? Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]! * 10) / 10
      : null,
    drawFrames: raw.drawCalls.length,
    drawSubmissionsPerSecond: Math.round((raw.drawCalls.length / seconds) * 10) / 10,
    drawCallsPerFrameMean: raw.drawCalls.length
      ? Math.round(
          (raw.drawCalls.reduce((sum, n) => sum + n, 0) / raw.drawCalls.length) * 10,
        ) / 10
      : null,
    contexts: raw.contexts,
  };
}

// Follow the supported profiler workflow: start before load, stop after pause.
// Inspector samples include idle/native work; they are not billed CPU milliseconds.
async function openWorkerObserver() {
  const targets = (await fetch("http://127.0.0.1:9229/json/list", {
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json())) as { webSocketDebuggerUrl: string }[];
  const target = targets.find(
    (t) => t.webSocketDebuggerUrl === "ws://127.0.0.1:9229/26-browser-rehearsal",
  );
  if (!target)
    throw new Error("The isolated local rehearsal Worker inspector is unavailable.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Local Worker inspector connection timed out")),
      5000,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("Local Worker inspector connection failed"));
      },
      { once: true },
    );
  });
  let id = 0;
  async function command(method: string): Promise<Record<string, unknown>> {
    const requestId = ++id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.removeEventListener("message", receive);
        reject(new Error(method + " timed out"));
      }, 5000);
      function receive(event: WebSocket.MessageEvent) {
        const response = JSON.parse(String(event.data)) as {
          id?: number;
          error?: { message: string };
          result?: Record<string, unknown>;
        };
        if (response.id !== requestId) return;
        clearTimeout(timer);
        socket.removeEventListener("message", receive);
        if (response.error) reject(new Error(response.error.message));
        else resolve(response.result ?? {});
      }
      socket.addEventListener("message", receive);
      socket.send(JSON.stringify({ id: requestId, method }));
    });
  }
  try {
    await command("Runtime.enable");
    await command("Profiler.enable");
    await command("Profiler.start");
    return {
      close: () => socket.close(),
      finish: async (size: number) => {
        const result = await command("Profiler.stop");
        const profile = result.profile as {
          startTime: number;
          endTime: number;
          nodes: { id: number; callFrame: { functionName: string } }[];
          samples?: number[];
        };
        expect(profile.nodes.length).toBeGreaterThan(0);
        expect(profile.endTime).toBeGreaterThan(profile.startTime);
        const samples = profile.samples ?? [];
        expect(samples.length).toBeGreaterThan(0);
        const counts = new Map<number, number>();
        for (const sample of samples) counts.set(sample, (counts.get(sample) ?? 0) + 1);
        const top = profile.nodes
          .map((n) => ({
            function: n.callFrame.functionName || "(anonymous)",
            samples: counts.get(n.id) ?? 0,
          }))
          .filter((n) => n.samples > 0)
          .sort((a, b) => b.samples - a.samples)
          .slice(0, 15);
        await mkdir("artifacts/kart-fix-checks", { recursive: true });
        await writeFile(
          "artifacts/kart-fix-checks/worker-baseline-" + size + ".cpuprofile",
          JSON.stringify(profile),
        );
        return {
          durationMs: (profile.endTime - profile.startTime) / 1000,
          samples: samples.length,
          top,
          scope:
            "Local workerd isolate sampling from race start through pause, including warm-up, phone/stage samples and a map-only window; excludes player joins; not production/billed CPU",
        };
      },
    };
  } catch (error) {
    socket.close();
    throw error;
  }
}
