import assert from "node:assert/strict";
import { test } from "node:test";
import {
  apiMechanic,
  boundaryViolations,
  importSpecifiers,
  posixJoin,
  unexpectedEntries,
  webFeature,
  webFiles,
  webFolders,
} from "./check-structure.mjs";

test("allowlists reject unknown top-level folders", () => {
  assert.deepEqual(unexpectedEntries(["play", "mystery"], webFolders, webFiles), [
    "mystery",
  ]);
  assert.deepEqual(unexpectedEntries(["play", "main.tsx"], webFolders, webFiles), []);
});

test("import specifiers include static and dynamic imports", () => {
  assert.deepEqual(
    importSpecifiers(
      `import { x } from "../api/src/room.ts";\nconst y = import("../kart/GuestKart");`,
    ),
    ["../api/src/room.ts", "../kart/GuestKart"],
  );
});

test("boundary: web cannot import api; rounds cannot import each other", () => {
  assert.ok(
    boundaryViolations(
      "apps/web/src/guest/guest-page.tsx",
      "../../../api/src/room/party-room.ts",
    ).length > 0,
  );
  assert.deepEqual(
    boundaryViolations("apps/web/src/kart/KartCanvas.tsx", "../chess/chess-game"),
    ["kart must not import chess internals"],
  );
  assert.deepEqual(
    boundaryViolations("apps/web/src/play/guest-play.tsx", "../kart/GuestKart"),
    [],
  );
  assert.deepEqual(
    boundaryViolations("packages/shared/src/index.ts", "../../apps/api/src/index.ts"),
    ["shared must stay free of apps and UI/runtime packages"],
  );
  assert.deepEqual(
    boundaryViolations(
      "apps/api/src/questions/kart/kart.ts",
      "../chess/chess-mechanic.ts",
    ),
    ["questions/kart must not import questions/chess"],
  );
});

test("feature helpers", () => {
  assert.equal(webFeature("apps/web/src/kart/KartCanvas.tsx"), "kart");
  assert.equal(webFeature("apps/web/src/play/guest-play.tsx"), null);
  assert.equal(apiMechanic("apps/api/src/questions/wordle/wordle.ts"), "wordle");
  assert.equal(
    posixJoin("apps/web/src/kart/KartCanvas.tsx", "../chess/guest-chess"),
    "apps/web/src/chess/guest-chess",
  );
});
