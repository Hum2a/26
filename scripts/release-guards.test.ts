import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertDeployAllowed } from "./release-support.ts";

describe("release safeguards", () => {
  const beforeParty = Date.parse("2026-11-15T12:00:00Z");
  // The party weekend used to be frozen; the owner removed that on 18 Nov 2026.
  const duringParty = Date.parse("2026-11-21T12:00:00Z");

  describe("assertDeployAllowed", () => {
    it("allows staging deploys without git checks", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(["staging"], { dryRun: false }, beforeParty, {
          branch: "feature-branch",
          clean: false,
        });
      });
    });

    it("allows dry-run production deploys without git checks", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(["production"], { dryRun: true }, beforeParty, {
          branch: "feature-branch",
          clean: false,
        });
      });
    });

    it("allows a production deploy during the party weekend with no override", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(
          ["production"],
          { dryRun: false, overrideFreeze: false },
          duringParty,
          { branch: "master", clean: true },
        );
      });
    });

    it("still accepts the old override flag and ignores it", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(
          ["production"],
          { dryRun: false, overrideFreeze: true },
          duringParty,
          { branch: "master", clean: true },
        );
      });
    });

    it("rejects production deploy from non-master branch", () => {
      assert.throws(
        () => {
          assertDeployAllowed(["production"], { dryRun: false }, beforeParty, {
            branch: "feature-branch",
            clean: true,
          });
        },
        {
          message: /Production deploys must be from master.*feature-branch/,
        },
      );
    });

    it("rejects production deploy with dirty working tree", () => {
      assert.throws(
        () => {
          assertDeployAllowed(["production"], { dryRun: false }, duringParty, {
            branch: "master",
            clean: false,
          });
        },
        {
          message: /Production deploys require a clean working tree/,
        },
      );
    });

    it("allows production deploy with all guards satisfied", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(["production"], { dryRun: false }, beforeParty, {
          branch: "master",
          clean: true,
        });
      });
    });

    it("allows production deploy without git state check when not provided", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(["production"], { dryRun: false }, duringParty, undefined);
      });
    });

    it("allows both staging+production with clean state", () => {
      assert.doesNotThrow(() => {
        assertDeployAllowed(["staging", "production"], { dryRun: false }, duringParty, {
          branch: "master",
          clean: true,
        });
      });
    });
  });
});
