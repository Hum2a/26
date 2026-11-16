import { describe, expect, it } from "vitest";
import type { RouteObject } from "react-router";
import { appRoutes } from "../routes";
import { adminExempt, adminFeatures, adminNavGroups, featurePath } from "./features";

/**
 * The admin coverage rule (.agents/rules/50-admin-coverage.md): every feature
 * folder has an admin page, and every admin page is in the registry. A new
 * folder fails here until it is given to a feature or exempted with a reason.
 */
// Lazy globs: the keys list every source file without importing any of them.
const apiFiles = Object.keys(import.meta.glob("../../../api/src/*/**/*.{ts,tsx}"));
const webFiles = Object.keys(import.meta.glob("../*/**/*.{ts,tsx}"));

/** Top-level folders under apps/api/src and apps/web/src that hold source. */
function featureFolders(): string[] {
  const folders = new Set<string>();
  for (const file of apiFiles) {
    folders.add(`apps/api/src/${file.split("/api/src/")[1]?.split("/")[0]}`);
  }
  for (const file of webFiles) {
    // Vite writes this test's own folder as "./", not "../admin/".
    const folder = file.startsWith("./")
      ? "admin"
      : file.replace(/^\.\.\//, "").split("/")[0];
    folders.add(`apps/web/src/${folder}`);
  }
  return [...folders].sort();
}

function adminPaths(): string[] {
  const found: string[] = [];
  const walk = (routes: RouteObject[], prefix: string) => {
    for (const route of routes) {
      const own = route.index
        ? prefix
        : route.path
          ? route.path.startsWith("/")
            ? route.path
            : `${prefix}/${route.path}`
          : prefix;
      if (
        own.startsWith("/admin") &&
        (route.element || route.Component || route.lazy || route.index)
      ) {
        found.push(own);
      }
      if (route.children) {
        walk(route.children, own);
      }
    }
  };
  walk(appRoutes, "");
  return [...new Set(found)];
}

describe("admin coverage", () => {
  const owned = adminFeatures.flatMap((feature) =>
    feature.owns.map((folder) => ({ folder, feature: feature.id })),
  );

  it("gives every feature folder to exactly one admin feature or an exemption", () => {
    const missing: string[] = [];
    const doubled: string[] = [];
    for (const folder of featureFolders()) {
      const owners = owned.filter((item) => item.folder === folder).length;
      const exempt = folder in adminExempt ? 1 : 0;
      if (owners + exempt === 0) missing.push(folder);
      if (owners + exempt > 1) doubled.push(folder);
    }
    expect(missing, "Add these folders to a feature in admin/features.ts").toEqual([]);
    expect(doubled, "Each folder belongs to one feature only").toEqual([]);
  });

  it("only names folders that exist", () => {
    const real = new Set(featureFolders());
    const stale = [
      ...owned.map((item) => item.folder),
      ...Object.keys(adminExempt),
    ].filter((folder) => !real.has(folder));
    expect(stale).toEqual([]);
  });

  it("describes what each feature shows and what the host can rehearse", () => {
    const ids = adminFeatures.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(adminNavGroups.map((group) => group.id));
    for (const feature of adminFeatures) {
      expect(feature.summary.length, feature.id).toBeGreaterThan(10);
      expect(feature.rehearsal.length, feature.id).toBeGreaterThan(10);
      expect(groups.has(feature.group), feature.id).toBe(true);
    }
    for (const reason of Object.values(adminExempt)) {
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it("matches the admin routes in both directions", () => {
    const routes = adminPaths().map((route) => route.replace(":gameId", "ROOM"));
    const registered = adminFeatures.map((feature) => featurePath(feature, "ROOM"));
    // Sign-in pages and question detail pages are not features.
    const pages = routes.filter(
      (route) =>
        !/^\/admin\/(login|confirm)$/.test(route) &&
        !route.startsWith("/admin/content/") &&
        !route.startsWith("/admin/phone-preview") &&
        !route.startsWith("/admin/stage-preview"),
    );
    expect(
      pages.filter((route) => !registered.includes(route)),
      "Routes with no registry entry",
    ).toEqual([]);
    expect(
      registered.filter((route) => !routes.includes(route)),
      "Registry entries with no route",
    ).toEqual([]);
  });
});
