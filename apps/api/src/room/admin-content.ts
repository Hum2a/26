import { adminContentSchema } from "@26/shared";
import type { Hono } from "hono";
import { jsonData } from "../auth/http.ts";
import { missingRequirements } from "../questions/definition.ts";
import { questionPacks } from "../questions/registry.ts";
import { rejectUnlessRoomCreator } from "./access.ts";

/** Explicit read-only authoring projection. Never serialise authored objects. */
export function adminContent() {
  return adminContentSchema.parse({
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
}
export function registerAdminContentRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/admin/content", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    return rejected ?? jsonData(adminContent());
  });
}
