import type { KartPad } from "./gamepad";

export function testPad(axis = 0, held: number[] = [], index = 0): KartPad {
  return {
    index,
    connected: true,
    axes: [axis],
    buttons: Array.from({ length: 8 }, (_, i) => ({
      pressed: held.includes(i),
      touched: held.includes(i),
      value: held.includes(i) ? 1 : 0,
    })),
  };
}
