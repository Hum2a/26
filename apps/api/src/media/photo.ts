import { decode, encode } from "jpeg-js";
import {
  acceptedImageBytes,
  mediaConfigMessage,
  mediaHeicMessage,
  mediaLargeMessage,
  mediaTypeMessage,
  photoEdgePx,
} from "../room/limits.ts";

export type PhotoCheck =
  | {
      ok: true;
      bytes: Uint8Array;
      width: number;
      height: number;
      contentType: "image/jpeg";
    }
  | { ok: false; message: string };

const imageFormats = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
]);

export function createPhotoProcessor(env: {
  APP_ENV: string;
  IMAGES?: ImagesBinding;
}): (bytes: Uint8Array) => Promise<PhotoCheck> {
  if (env.IMAGES) {
    const images = env.IMAGES;
    return (bytes) => cloudflarePhoto(images, bytes);
  }
  if (env.APP_ENV === "local") {
    return localJpegPhoto;
  }
  return async () => ({ ok: false, message: mediaConfigMessage });
}

export async function localJpegPhoto(bytes: Uint8Array): Promise<PhotoCheck> {
  if (isHeic(bytes)) {
    return { ok: false, message: mediaHeicMessage };
  }
  try {
    const decoded = decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 20,
      maxMemoryUsageInMB: 32,
    });
    const scaled = scaleDown(decoded, photoEdgePx);
    let quality = 80;
    let encoded = encode(
      { data: scaled.data, width: scaled.width, height: scaled.height },
      quality,
    );
    while (encoded.data.byteLength > acceptedImageBytes && quality > 40) {
      quality -= 10;
      encoded = encode(
        { data: scaled.data, width: scaled.width, height: scaled.height },
        quality,
      );
    }
    if (encoded.data.byteLength > acceptedImageBytes) {
      return { ok: false, message: mediaLargeMessage };
    }
    const checked = decode(encoded.data, { useTArray: true, maxResolutionInMP: 20 });
    if (checked.width < 1 || checked.height < 1) {
      return { ok: false, message: mediaTypeMessage };
    }
    return {
      ok: true,
      bytes: encoded.data,
      width: checked.width,
      height: checked.height,
      contentType: "image/jpeg",
    };
  } catch {
    return { ok: false, message: mediaTypeMessage };
  }
}

async function cloudflarePhoto(
  images: ImagesBinding,
  bytes: Uint8Array,
): Promise<PhotoCheck> {
  try {
    const info = await images.info(streamFrom(bytes));
    if (!("width" in info) || info.width < 1 || info.height < 1) {
      return { ok: false, message: mediaTypeMessage };
    }
    const format = info.format.startsWith("image/")
      ? info.format
      : `image/${info.format}`;
    if (!imageFormats.has(format)) {
      return {
        ok: false,
        message: format === "image/heic" ? mediaHeicMessage : mediaTypeMessage,
      };
    }
    const response = (
      await images
        .input(streamFrom(bytes))
        .transform({ width: photoEdgePx, fit: "scale-down" })
        .output({ format: "image/jpeg", quality: 80 })
    ).response();
    const encoded = new Uint8Array(await response.arrayBuffer());
    if (encoded.byteLength > acceptedImageBytes || encoded.byteLength < 4) {
      return { ok: false, message: mediaLargeMessage };
    }
    return {
      ok: true,
      bytes: encoded,
      width: Math.min(info.width, photoEdgePx),
      height:
        info.width > photoEdgePx
          ? Math.max(1, Math.round((info.height * photoEdgePx) / info.width))
          : info.height,
      contentType: "image/jpeg",
    };
  } catch {
    return { ok: false, message: mediaTypeMessage };
  }
}

function scaleDown(
  image: { data: Uint8Array; width: number; height: number },
  maxEdge: number,
): { data: Uint8Array; width: number; height: number } {
  const edge = Math.max(image.width, image.height);
  if (edge <= maxEdge) {
    return image;
  }
  const scale = maxEdge / edge;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor(x / scale));
      const from = (sourceY * image.width + sourceX) * 4;
      const to = (y * width + x) * 4;
      data.set(image.data.subarray(from, from + 4), to);
    }
  }
  return { data, width, height };
}

function streamFrom(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function isHeic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) {
    return false;
  }
  const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
  return (
    text(bytes, 4, 4) === "ftyp" &&
    (brand.startsWith("heic") || brand.startsWith("heif") || brand === "mif1")
  );
}

function text(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}
