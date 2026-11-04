import {
  kartAssetManifest,
  adminContentSchema,
  adminTrollsSchema,
  type AdminContent,
  type AdminTrolls,
  type BirthdayOrder,
  saveBirthdayOrderSchema,
} from "@26/shared";
import { implementedTrollKinds, trollDefinitions } from "../troll/catalogue.ts";
import type { Hono } from "hono";
import { authFailure, jsonData } from "../auth/http.ts";
import { missingRequirements } from "../questions/definition.ts";
import { questionPacks } from "../questions/registry.ts";
import { rejectUnlessRoomCreator } from "./access.ts";
import { kartPreview } from "./kart-preview.ts";
import { adminQuestion } from "./admin-question.ts";
import { previewWordle, readWordlePreviewBody } from "./wordle-preview.ts";
import { questionPreview } from "./question-preview.ts";

/**
 * The troll catalogue for the admin Trolls pages. Named fields only, so a new
 * catalogue field can never make the strict schema refuse the whole page.
 */
export function adminTrollCatalogue(): AdminTrolls {
  return adminTrollsSchema.parse({
    trolls: implementedTrollKinds.map((kind) => {
      const definition = trollDefinitions[kind];
      return {
        kind: definition.kind,
        label: definition.label,
        assetLabel: definition.assetLabel,
        slot: definition.slot,
        durationMs: definition.durationMs,
        phases: [...definition.phases],
        escape: definition.escape,
        disruptsSubmission: definition.disruptsSubmission,
        announce: definition.announce,
        questionKinds: [...(definition.questionKinds ?? [])],
        modifier: definition.modifier === true || kind === "double",
      };
    }),
  });
}

/** Explicit read-only authoring projection. Never serialise authored objects. */
export function adminContent(order?: BirthdayOrder): AdminContent | null {
  const parsed = adminContentSchema.safeParse({
    packs: questionPacks.map((pack) => ({
      id: pack.packId,
      version: pack.version,
      release: pack.release,
      illustrative: pack.illustrative,
      ...(pack.packId === "birthday" && order ? { runningOrder: order } : {}),
      questions: [...pack.catalogue]
        .sort((a, b) => {
          const left = (
              pack.packId === "birthday" && order ? order.ids : pack.order
            ).indexOf(a.id),
            right = (
              pack.packId === "birthday" && order ? order.ids : pack.order
            ).indexOf(b.id);
          return (left < 0 ? Infinity : left) - (right < 0 ? Infinity : right);
        })
        .map((question) => ({
          id: question.id,
          title: question.title,
          prompt: question.prompt,
          mechanic: question.kind,
          presentation: question.presentation,
          status: question.status,
          order: (pack.packId === "birthday" && order
            ? order.ids
            : pack.order
          ).includes(question.id)
            ? (pack.packId === "birthday" && order ? order.ids : pack.order).indexOf(
                question.id,
              ) + 1
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
  app.post("/api/admin/content/birthday/order", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) return rejected;
    let raw: unknown;
    try {
      if (Number(c.req.header("content-length") ?? 0) > 16384)
        return authFailure("invalid", 413);
      raw = await readWordlePreviewBody(c.req.raw, 16384);
    } catch {
      return authFailure("invalid", 400);
    }
    const parsed = saveBirthdayOrderSchema.safeParse(raw);
    if (!parsed.success) return authFailure("invalid", 400);
    try {
      const result = await c.env.ROOM_CODE_REGISTRY.getByName(
        "codes",
      ).updateBirthdayOrder(parsed.data, Date.now());
      return jsonData(result, "error" in result ? 409 : 200);
    } catch (error) {
      return jsonData(
        {
          error: "invalid",
          message:
            error instanceof Error
              ? error.message
              : "The running order could not be saved.",
        },
        409,
      );
    }
  });
  app.post(
    "/api/admin/content/:version/questions/:questionId/preview/wordle",
    async (c) => {
      const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
      if (rejected) return rejected;
      const pack = questionPacks.find(
        (pack) => pack.version === c.req.param("version"),
      );
      const question = pack?.catalogue.find((q) => q.id === c.req.param("questionId"));
      if (!question) return authFailure("invalid", 404);
      return jsonData(previewWordle(question, await readWordlePreviewBody(c.req.raw)));
    },
  );
  app.get("/api/admin/content/:version/questions/:questionId/preview", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) return rejected;
    const pack = questionPacks.find((pack) => pack.version === c.req.param("version"));
    const question = pack?.catalogue.find(
      (question) => question.id === c.req.param("questionId"),
    );
    if (!pack || !question)
      return jsonData(
        {
          error: "not_found",
          message: "That question could not be found in this pack.",
        },
        404,
      );
    return jsonData(
      questionPreview(
        pack.packId === "birthday"
          ? {
              ...pack,
              order: (await c.env.ROOM_CODE_REGISTRY.getByName("codes").birthdayOrder())
                .ids,
            }
          : pack,
        question,
      ),
    );
  });
  app.get("/api/admin/content/:version/questions/:questionId", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) return rejected;
    const pack = questionPacks.find((pack) => pack.version === c.req.param("version"));
    const question = pack?.catalogue.find(
      (question) => question.id === c.req.param("questionId"),
    );
    if (!pack || !question)
      return jsonData(
        {
          error: "not_found",
          message: "That question could not be found in this pack.",
        },
        404,
      );
    const detail = adminQuestion(
      pack.packId === "birthday"
        ? {
            ...pack,
            order: (await c.env.ROOM_CODE_REGISTRY.getByName("codes").birthdayOrder())
              .ids,
          }
        : pack,
      question,
    );
    return detail ? jsonData(detail) : authFailure("invalid", 500);
  });
  app.get("/api/admin/kart-preview", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) return rejected;
    try {
      return jsonData(kartPreview(c.req.query("beat") ?? "grid"));
    } catch {
      return authFailure("invalid", 400);
    }
  });
  app.get("/api/admin/kart-assets", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    return rejected ?? jsonData(kartAssetManifest);
  });
  app.get("/api/admin/trolls", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) {
      return rejected;
    }
    return jsonData(adminTrollCatalogue());
  });
  app.get("/api/admin/content", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) {
      return rejected;
    }
    let order: BirthdayOrder;
    try {
      order = await c.env.ROOM_CODE_REGISTRY.getByName("codes").birthdayOrder();
    } catch {
      return authFailure("invalid", 500);
    }
    const content = adminContent(order);
    if (!content) {
      return authFailure("invalid", 500);
    }
    return jsonData(content);
  });
}
