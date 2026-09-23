import {
  mediaTypeMessage,
  mediaVoiceMessage,
  voiceMaxBytes,
  voiceMaxMs,
} from "../room/limits.ts";

export type VoiceCheck =
  | { ok: true; bytes: Uint8Array; durationMs: number; contentType: "audio/wav" }
  | { ok: false; message: string };

export function validateWav(bytes: Uint8Array): VoiceCheck {
  if (bytes.byteLength > voiceMaxBytes) {
    return { ok: false, message: mediaVoiceMessage };
  }
  const parsed = parseWav(bytes);
  if (!parsed) {
    return { ok: false, message: mediaTypeMessage };
  }
  if (parsed.durationMs <= 0 || parsed.durationMs > voiceMaxMs) {
    return { ok: false, message: mediaVoiceMessage };
  }
  return {
    ok: true,
    bytes: canonicalWav(parsed),
    durationMs: parsed.durationMs,
    contentType: "audio/wav",
  };
}

type ParsedWav = {
  sampleRate: number;
  channels: number;
  bits: number;
  samples: Uint8Array;
  durationMs: number;
};

function parseWav(bytes: Uint8Array): ParsedWav | null {
  if (bytes.byteLength < 44) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (text(bytes, 0, 4) !== "RIFF" || text(bytes, 8, 4) !== "WAVE") {
    return null;
  }
  const declared = view.getUint32(4, true);
  if (declared + 8 > bytes.byteLength) {
    return null;
  }
  let format: number | null = null;
  let channels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let bits = 0;
  let samples: Uint8Array | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const id = text(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (size < 0 || start + size > bytes.byteLength) {
      return null;
    }
    if (id === "fmt ") {
      if (size < 16) {
        return null;
      }
      format = view.getUint16(start, true);
      channels = view.getUint16(start + 2, true);
      sampleRate = view.getUint32(start + 4, true);
      byteRate = view.getUint32(start + 8, true);
      bits = view.getUint16(start + 14, true);
    } else if (id === "data") {
      samples = bytes.slice(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  if (
    format !== 1 ||
    (channels !== 1 && channels !== 2) ||
    sampleRate < 8_000 ||
    sampleRate > 48_000 ||
    (bits !== 16 && bits !== 8) ||
    !samples
  ) {
    return null;
  }
  const block = channels * (bits / 8);
  if (
    block <= 0 ||
    samples.byteLength % block !== 0 ||
    byteRate !== sampleRate * block
  ) {
    return null;
  }
  const durationMs = Math.round((samples.byteLength / byteRate) * 1000);
  return { sampleRate, channels, bits, samples, durationMs };
}

function canonicalWav(parsed: ParsedWav): Uint8Array {
  const header = 44;
  const bytes = new Uint8Array(header + parsed.samples.byteLength);
  const view = new DataView(bytes.buffer);
  write(bytes, 0, "RIFF");
  view.setUint32(4, 36 + parsed.samples.byteLength, true);
  write(bytes, 8, "WAVE");
  write(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, parsed.channels, true);
  view.setUint32(24, parsed.sampleRate, true);
  const block = parsed.channels * (parsed.bits / 8);
  view.setUint32(28, parsed.sampleRate * block, true);
  view.setUint16(32, block, true);
  view.setUint16(34, parsed.bits, true);
  write(bytes, 36, "data");
  view.setUint32(40, parsed.samples.byteLength, true);
  bytes.set(parsed.samples, header);
  return bytes;
}

function text(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function write(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}
