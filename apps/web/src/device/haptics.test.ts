import { describe, expect, it } from "vitest";
import { buzz } from "./haptics";

describe("buzz", () => {
  it("calls vibrate with the pattern", () => {
    buzz([12, 24, 12]);
    expect(navigator.vibrate).toHaveBeenCalledWith([12, 24, 12]);
  });

  it("does not throw when vibrate is missing", () => {
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(() => buzz([12])).not.toThrow();
  });
});
