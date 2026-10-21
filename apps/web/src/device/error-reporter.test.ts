import { afterEach, expect, it } from "vitest";
import { takeConnectionDelta } from "./connection-log";
import { installErrorReporter } from "./error-reporter";

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  takeConnectionDelta();
});

it("counts uncaught errors and rejections into the next connection summary", () => {
  takeConnectionDelta();
  uninstall = installErrorReporter(window);
  window.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
  const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
  Object.defineProperty(rejection, "reason", { value: new Error("nope") });
  window.dispatchEvent(rejection);
  const delta = takeConnectionDelta();
  expect(delta?.scriptErrors).toBe(2);
  expect(delta?.lastScriptError).toMatch(/nope$/);
  expect(takeConnectionDelta()).toBeNull();
});
