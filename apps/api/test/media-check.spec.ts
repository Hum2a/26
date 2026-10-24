import { encode } from "jpeg-js";
import { describe, expect, it, vi } from "vitest";
import { readAcceptedBody } from "../src/media/store.ts";
import { acceptedMediaHeaders } from "../src/media/finalise.ts";
import { temporaryKey } from "../src/media/keys.ts";
import { localJpegPhoto, createPhotoProcessor } from "../src/media/photo.ts";
import { realBucketReport, uploadTarget } from "../src/media/presign.ts";
import { validateWav } from "../src/media/wav.ts";
import {
  mediaConfigMessage,
  mediaHeicMessage,
  mediaTypeMessage,
  mediaVoiceMessage,
} from "../src/room/limits.ts";

describe("media checks", () => {
  it("streams an accepted object with one read and without buffering", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    const arrayBuffer = vi.fn();
    const get = vi.fn().mockResolvedValue({ body, arrayBuffer });
    expect(
      await readAcceptedBody({ get } as Pick<R2Bucket, "get">, "final/photo"),
    ).toBe(body);
    expect(get).toHaveBeenCalledExactlyOnceWith("final/photo");
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect([...new Uint8Array(await new Response(body).arrayBuffer())]).toEqual([
      1, 2, 3,
    ]);
    get.mockResolvedValue(null);
    expect(
      await readAcceptedBody({ get } as Pick<R2Bucket, "get">, "missing"),
    ).toBeNull();
  });
  it("re-encodes a real JPEG and rejects other bytes", async () => {
    const photo = await localJpegPhoto(tinyJpeg(4, 2));
    expect(photo.ok).toBe(true);
    if (!photo.ok) {
      return;
    }
    expect(photo.contentType).toBe("image/jpeg");
    expect(photo.width).toBe(4);
    expect(photo.bytes[0]).toBe(0xff);
    expect(await localJpegPhoto(new TextEncoder().encode("hello"))).toMatchObject({
      ok: false,
      message: mediaTypeMessage,
    });
    const heic = new Uint8Array(12);
    heic.set(new TextEncoder().encode("ftypheic"), 4);
    expect(await localJpegPhoto(heic)).toMatchObject({
      ok: false,
      message: mediaHeicMessage,
    });
  });

  it("measures WAV duration from the sample bytes and strips extra chunks", () => {
    const clip = validateWav(wav({ sampleRate: 8_000, seconds: 1, extraChunk: true }));
    expect(clip.ok).toBe(true);
    if (!clip.ok) {
      return;
    }
    expect(clip.durationMs).toBe(1000);
    expect(clip.bytes.byteLength).toBe(44 + 8_000 * 2);
    expect(validateWav(wav({ sampleRate: 8_000, seconds: 4 }))).toMatchObject({
      ok: false,
      message: mediaVoiceMessage,
    });
    expect(validateWav(new TextEncoder().encode("not audio"))).toMatchObject({
      ok: false,
      message: mediaTypeMessage,
    });
  });

  it("uses the Images binding outside local development and does not pretend a local JPEG decode is enough", async () => {
    const calls: unknown[] = [];
    const jpeg = tinyJpeg(2, 2);
    const images = {
      async info() {
        return { format: "image/png", fileSize: jpeg.byteLength, width: 2, height: 2 };
      },
      input() {
        const handle = {
          transform(options: ImageTransform) {
            calls.push(options);
            return handle;
          },
          draw() {
            return handle;
          },
          async output() {
            return {
              response() {
                return new Response(jpeg);
              },
              contentType() {
                return "image/jpeg";
              },
              image() {
                throw new Error("The test does not read the image stream.");
              },
            };
          },
        };
        return handle;
      },
    } as unknown as ImagesBinding;
    const processor = createPhotoProcessor({
      APP_ENV: "production",
      IMAGES: images,
    });
    const checked = await processor(jpeg);
    expect(checked.ok).toBe(true);
    expect(calls).toEqual([{ width: 1280, fit: "scale-down" }]);
    const unconfigured = createPhotoProcessor({ APP_ENV: "staging" });
    expect(await unconfigured(jpeg)).toMatchObject({
      ok: false,
      message: mediaConfigMessage,
    });
  });

  it("signs a temporary PUT without a network call and keeps real buckets unverified", async () => {
    const uploadId = crypto.randomUUID();
    const signed = await uploadTarget({
      env: {
        APP_ENV: "production",
        R2_ACCOUNT_ID: "account",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        MEDIA_BUCKET_NAME: "26-humza-media",
      },
      requestUrl: "https://example.com/game",
      gameId: "ABCDEFGH",
      uploadId,
      tempKey: temporaryKey("ABCDEFGH", uploadId),
      contentType: "image/jpeg",
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) {
      return;
    }
    expect(signed.uploadUrl).toContain("/tmp/");
    expect(signed.uploadUrl).not.toContain("/accepted/");
    expect(signed.uploadUrl).toContain("X-Amz-Expires=300");
    const blocked = await uploadTarget({
      env: {
        APP_ENV: "production",
        R2_ACCOUNT_ID: "",
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: "",
        MEDIA_BUCKET_NAME: "",
      },
      requestUrl: "https://example.com/game",
      gameId: "ABCDEFGH",
      uploadId,
      tempKey: temporaryKey("ABCDEFGH", uploadId),
      contentType: "image/jpeg",
    });
    expect(blocked).toMatchObject({ ok: false, message: mediaConfigMessage });
    expect(
      realBucketReport({
        APP_ENV: "local",
        R2_ACCOUNT_ID: "",
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: "",
      }),
    ).toEqual({
      networkChecked: false,
      mode: "credentials-missing",
      missing: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"],
    });
    expect(acceptedMediaHeaders("image/jpeg").get("cache-control")).toBe(
      "private, no-store",
    );
  });
});

function tinyJpeg(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 180;
    data[index + 3] = 255;
  }
  return encode({ data, width, height }, 80).data;
}

function wav(input: {
  sampleRate: number;
  seconds: number;
  extraChunk?: boolean;
}): Uint8Array {
  const sampleBytes = input.sampleRate * input.seconds * 2;
  const extra = input.extraChunk ? 16 : 0;
  const bytes = new Uint8Array(44 + extra + sampleBytes);
  const view = new DataView(bytes.buffer);
  write(bytes, 0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  write(bytes, 8, "WAVE");
  let offset = 12;
  if (input.extraChunk) {
    write(bytes, offset, "LIST");
    view.setUint32(offset + 4, 8, true);
    write(bytes, offset + 8, "INFOtest");
    offset += 16;
  }
  write(bytes, offset, "fmt ");
  view.setUint32(offset + 4, 16, true);
  view.setUint16(offset + 8, 1, true);
  view.setUint16(offset + 10, 1, true);
  view.setUint32(offset + 12, input.sampleRate, true);
  view.setUint32(offset + 16, input.sampleRate * 2, true);
  view.setUint16(offset + 20, 2, true);
  view.setUint16(offset + 22, 16, true);
  offset += 24;
  write(bytes, offset, "data");
  view.setUint32(offset + 4, sampleBytes, true);
  return bytes;
}

function write(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}
