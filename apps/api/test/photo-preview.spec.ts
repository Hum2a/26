import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/auth/routes.ts", () => ({ administratorForRequest: vi.fn() }));
import { administratorForRequest } from "../src/auth/routes.ts";
import { registerMediaRoutes } from "../src/media/routes.ts";

const app = new Hono<{ Bindings: Env }>();
registerMediaRoutes(app);
const transforms: ImageTransform[] = [];
const qualities: number[] = [];
const images = {
  info: async () => ({ format: "image/jpeg", width: 600, height: 300 }),
  input() {
    const handle = {
      transform(options: ImageTransform) {
        transforms.push(options);
        return handle;
      },
      async output(options: { quality: number }) {
        qualities.push(options.quality);
        return { response: () => new Response(new Uint8Array([255, 216, 255, 217])) };
      },
    };
    return handle;
  },
} as unknown as ImagesBinding;
const bindings = { APP_ENV: "staging", IMAGES: images } as Env;
const preview = (
  treatment = "rough",
  origin = "https://example.test",
  body: BodyInit = new Uint8Array([255, 216, 255, 217]),
) =>
  app.request(
    `https://example.test/api/admin/media/photo-preview?treatment=${treatment}`,
    {
      method: "POST",
      headers: { origin, "content-type": "image/jpeg" },
      body,
    },
    bindings,
  );

beforeEach(() => {
  vi.clearAllMocks();
  transforms.length = qualities.length = 0;
  vi.mocked(administratorForRequest).mockResolvedValue({ email: "admin@example.test" });
});

it("authenticates and checks the origin before processing a rehearsal", async () => {
  expect((await preview("rough", "https://elsewhere.test")).status).toBe(403);
  vi.mocked(administratorForRequest).mockResolvedValue(
    new Response(null, { status: 401 }),
  );
  expect((await preview()).status).toBe(401);
  expect(qualities).toEqual([]);
});

it.each(["clean", "rough"])(
  "uses the real %s processor profile without persisting",
  async (treatment) => {
    const result = await preview(treatment);
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("image/jpeg");
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(qualities).toEqual(treatment === "rough" ? [95, 20] : [95]);
    expect(transforms.at(-1)).toEqual({
      width: treatment === "rough" ? 256 : 1280,
      height: treatment === "rough" ? 256 : 1280,
      fit: "scale-down",
    });
  },
);

it("bounds the body and refuses unknown profiles before processing", async () => {
  expect((await preview("unknown")).status).toBe(400);
  expect(
    (await preview("rough", "https://example.test", new Uint8Array(1_048_577))).status,
  ).toBe(413);
  expect(qualities).toEqual([]);
});
