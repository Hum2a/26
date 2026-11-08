import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertDeployAllowed,
  inDeployFreeze,
  deployFreeze,
} from "./release-support.ts";

describe("release safeguards", () => {
  const nowOutsideFreeze = Date.parse("2026-11-15T12:00:00Z");
  const nowInsideFreeze = Date.parse("2026-11-21T12:00:00Z");

  describe("inDeployFreeze", () => {
    it("returns false before freeze period", () => {
      assert.strictEqual(inDeployFreeze(deployFreeze.from - 1000), false);
    });

    it("returns true at freeze start", () => {
      assert.strictEqual(inDeployFreeze(deployFreeze.from), true);
    });

    it("returns true during freeze period", () => {
      assert.strictEqual(inDeployFreeze(nowInsideFreeze), true);
    });

    it("returns false at freeze end", () => {
      assert.strictEqual(inDeployFreeze(deployFreeze.until), false);
    });

    it("returns false after freeze period", () => {
      assert.strictEqual(inDeployFreeze(deployFreeze.until + 1000), false);
    });
  });

  describe("assertDeployAllowed", () => {
    it("allows staging deploys without confirmation", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(
          ["staging"],
          { dryRun: false, confirmProduction: false, overrideFreeze: false },
          nowOutsideFreeze,
          { branch: "feature-branch", clean: false },
        );
      });
    });

    it("allows dry-run production deploys without confirmation", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(
          ["production"],
          { dryRun: true, confirmProduction: false, overrideFreeze: false },
          nowOutsideFreeze,
          { branch: "feature-branch", clean: false },
        );
      });
    });

    it("rejects production deploy without confirmation", () => {
      assert.throws(
        () => {
          assertDeployAllowed(
            ["production"],
            { dryRun: false, confirmProduction: false, overrideFreeze: false },
            nowOutsideFreeze,
            { branch: "master", clean: true },
          );
        },
        {
          message: /Deploying to production needs --confirm-production/,
        },
      );
    });

    it("rejects production deploy during freeze without override", () => {
      assert.throws(
        () => {
          assertDeployAllowed(
            ["production"],
            { dryRun: false, confirmProduction: true, overrideFreeze: false },
            nowInsideFreeze,
            { branch: "master", clean: true },
          );
        },
        {
          message: /Production is frozen for the party weekend/,
        },
      );
    });

    it("allows production deploy during freeze with override", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(
          ["production"],
          { dryRun: false, confirmProduction: true, overrideFreeze: true },
          nowInsideFreeze,
          { branch: "master", clean: true },
        );
      });
    });

    it("rejects production deploy from non-master branch", () => {
      assert.throws(
        () => {
          assertDeployAllowed(
            ["production"],
            { dryRun: false, confirmProduction: true, overrideFreeze: false },
            nowOutsideFreeze,
            { branch: "feature-branch", clean: true },
          );
        },
        {
          message: /Production deploys must be from master.*feature-branch/,
        },
      );
    });

    it("rejects production deploy with dirty working tree", () => {
      assert.throws(
        () => {
          assertDeployAllowed(
            ["production"],
            { dryRun: false, confirmProduction: true, overrideFreeze: false },
            nowOutsideFreeze,
            { branch: "master", clean: false },
          );
        },
        {
          message: /Production deploys require a clean working tree/,
        },
      );
    });

    it("allows production deploy with all guards satisfied", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(
          ["production"],
          { dryRun: false, confirmProduction: true, overrideFreeze: false },
          nowOutsideFreeze,
          { branch: "master", clean: true },
        );
      });
    });

    it("allows production deploy without git state check when not provided", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(
          ["production"],
          { dryRun: false, confirmProduction: true, overrideFreeze: false },
          nowOutsideFreeze,
          undefined,
        );
      });
    });

    it("still requires confirmation when git state is skipped", () => {
      assert.throws(
        () => {
          assertDeployAllowed(
            ["production"],
            { dryRun: false, confirmProduction: false, overrideFreeze: false },
            nowOutsideFreeze,
            undefined,
          );
        },
        { message: /needs --confirm-production/ },
      );
    });

    it("still requires freeze override when git state is skipped", () => {
      assert.throws(
        () => {
          assertDeployAllowed(
            ["production"],
            { dryRun: false, confirmProduction: true, overrideFreeze: false },
            nowInsideFreeze,
            undefined,
          );
        },
        { message: /Production is frozen for the party weekend/ },
      );
    });

    it("rejects both staging+production without confirmation", () => {
      assert.throws(
        () => {
          assertDeployAllowed(
            ["staging", "production"],
            { dryRun: false, confirmProduction: false, overrideFreeze: false },
            nowOutsideFreeze,
            { branch: "master", clean: true },
          );
        },
        {
          message: /Deploying to production needs --confirm-production/,
        },
      );
    });

    it("allows both staging+production with confirmation and clean state", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(
          ["staging", "production"],
          { dryRun: false, confirmProduction: true, overrideFreeze: false },
          nowOutsideFreeze,
          { branch: "master", clean: true },
        );
      });
    });
  });
});
