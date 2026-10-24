import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

// Local, repeatable cold-load measurements; never reads build output or credentials.
const baseURL = process.env.PERF_URL ?? "http://localhost:4173";
const label = process.argv[2] ?? "current";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Use a simple audit label.");
const directory = "artifacts/browser-checks/performance";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const path of ["/", "/join", "/host", "/admin/login"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    // Explicit read-only fixtures isolate front-end cost from local Worker transport.
    await page.route("**/api/admin/session", (route) =>
      route.fulfill({ json: { signedIn: false } }),
    );
    await page.route("**/api/rooms/session", (route) =>
      route.fulfill({ status: 401, json: {} }),
    );
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.__perf = { lcp: 0, cls: 0, blockingMs: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__perf.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          window.__perf.blockingMs += Math.max(0, entry.duration - 50);
      }).observe({ type: "longtask", buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200_000,
      uploadThroughput: 100_000,
    });
    await page.goto(new URL(path, baseURL).href, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.locator("h1").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const measurements = await page.evaluate(() => ({
      ...window.__perf,
      fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
      resources: performance
        .getEntriesByType("resource")
        .filter((entry) => !new URL(entry.name).pathname.startsWith("/api/"))
        .map((entry) => ({
          path: new URL(entry.name).pathname,
          initiator: entry.initiatorType,
          bytes: entry.decodedBodySize,
          transferBytes: entry.transferSize,
        })),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      heading: document.querySelector("h1")?.textContent,
    }));
    await page.screenshot({
      path: `${directory}/${label}-${path.replaceAll("/", "_") || "home"}.png`,
      fullPage: true,
    });
    results.push({ path, ...measurements, errors });
    await writeFile(
      `${directory}/${label}.json`,
      JSON.stringify(
        {
          baseURL,
          sessionFixtures: true,
          cpuSlowdown: 4,
          downloadBytesPerSecond: 200_000,
          latencyMs: 150,
          results,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        path,
        ...measurements,
        resources: measurements.resources.length,
        scriptBytes: measurements.resources
          .filter((entry) => entry.path.endsWith(".js"))
          .reduce((sum, entry) => sum + entry.bytes, 0),
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  `${directory}/${label}.json`,
  JSON.stringify(
    {
      baseURL,
      sessionFixtures: true,
      cpuSlowdown: 4,
      downloadBytesPerSecond: 200_000,
      latencyMs: 150,
      results,
    },
    null,
    2,
  ),
);
