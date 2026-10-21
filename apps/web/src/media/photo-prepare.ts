/** Photo preparation shared by question photos and driver faces. */
export async function compactJpeg(
  file: File,
  maxEdge = 1280,
  square = false,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  // A square crop keeps the middle of the photo, where a selfie's face is.
  const side = Math.min(bitmap.width, bitmap.height);
  const source = square
    ? {
        x: Math.round((bitmap.width - side) / 2),
        y: Math.round((bitmap.height - side) / 2),
        w: side,
        h: side,
      }
    : { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  const edge = Math.max(source.w, source.h);
  const scale = edge > maxEdge ? maxEdge / edge : 1;
  const width = Math.max(1, Math.round(source.w * scale));
  const height = Math.max(1, Math.round(source.h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This phone cannot prepare that photo.");
  }
  context.drawImage(
    bitmap,
    source.x,
    source.y,
    source.w,
    source.h,
    0,
    0,
    width,
    height,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/jpeg", 0.8);
  });
  if (!blob) {
    throw new Error("This phone cannot prepare that photo.");
  }
  return blob;
}

export function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}
