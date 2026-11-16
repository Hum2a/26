import { describe, expect, it, vi } from "vitest";
import { describeError, logError } from "../src/log";

describe("server log", () => {
  it("keeps only the error name when a message could hold a secret", () => {
    expect(describeError(new Error("connect postgres://user:pw@host/db"))).toEqual({
      name: "Error",
    });
    expect(describeError(new TypeError("bad secret value"))).toEqual({
      name: "TypeError",
    });
    expect(describeError(new Error("Room is paused"))).toEqual({
      name: "Error",
      message: "Room is paused",
    });
    expect(describeError("plain")).toEqual({ name: "string" });
  });

  it("writes one JSON line with the area and context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("alarm", new Error("boom"), { retryInMs: 2000 });
    expect(JSON.parse(spy.mock.calls[0]![0] as string)).toEqual({
      level: "error",
      area: "alarm",
      retryInMs: 2000,
      error: { name: "Error", message: "boom" },
    });
    spy.mockRestore();
  });
});
