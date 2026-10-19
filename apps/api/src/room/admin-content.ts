import { adminContentSchema, type AdminContent } from "@26/shared";
import type { Hono } from "hono";
import { authFailure, jsonData } from "../auth/http.ts";
import { missingRequirements } from "../questions/definition.ts";
import { questionPacks } from "../questions/registry.ts";
import { rejectUnlessRoomCreator } from "./access.ts";

/** Explicit read-only authoring projection. Never serialise authored objects. */
export function adminContent(): AdminContent | null {
  const parsed = adminContentSchema.safeParse({
    packs: questionPacks.map((pack) => ({
      id: pack.packId,
      version: pack.version,
      release: pack.release,
      illustrative: pack.illustrative,
      questions: [...pack.catalogue]
        .sort((a, b) => {
          const left = pack.order.indexOf(a.id),
            right = pack.order.indexOf(b.id);
          return (left < 0 ? Infinity : left) - (right < 0 ? Infinity : right);
        })
        .map((question) => ({
          id: question.id,
          title: question.title,
          prompt: question.prompt,
          mechanic: question.kind,
          presentation: question.presentation,
          status: question.status,
          order: pack.order.includes(question.id)
            ? pack.order.indexOf(question.id) + 1
            : null,
          missing: missingRequirements(question).map(({ code, name, detail }) => ({
            code,
            name,
            detail,
          })),
        })),
    })),
  });
  if (!parsed.success) {
    const paths = parsed.error.issues
      .map((issue) => issue.path.join(".") || "(root)")
      .slice(0, 12);
    console.error("Admin content projection failed", paths.join(", "));
    return null;
  }
  return parsed.data;
}

export function registerAdminContentRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/admin/content", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) {
      return rejected;
    }
    const content = adminContent();
    if (!content) {
      return authFailure("invalid", 500);
    }
    return jsonData(content);
  });
}
