// Generates the theme song jingle at apps/web/public/assets/demo-sting.wav.
// A bright four-note fanfare with a cymbal-ish tail, about 2.4 seconds,
// 22.05 kHz mono 16-bit PCM. Run: node scripts/generate-theme-sting.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rate = 22_050;
// Note frequencies (Hz) and lengths (seconds): G4, C5, E5, then a held G5.
const notes = [
  [392.0, 0.18],
  [523.25, 0.18],
  [659.25, 0.18],
  [783.99, 1.4],
];
const tail = 0.45;
const total = notes.reduce((sum, [, length]) => sum + length, 0) + tail;
const samples = new Float32Array(Math.ceil(total * rate));

let start = 0;
for (const [frequency, length] of notes) {
  const first = Math.floor(start * rate);
  const count = Math.floor((length + tail) * rate);
  for (let index = 0; index < count && first + index < samples.length; index += 1) {
    const time = index / rate;
    // Quick attack, exponential decay; brassy with a couple of harmonics.
    const envelope = Math.min(1, time / 0.012) * Math.exp(-time * (length > 1 ? 1.6 : 7));
    const tone =
      Math.sin(2 * Math.PI * frequency * time) +
      0.45 * Math.sin(2 * Math.PI * frequency * 2 * time) +
      0.2 * Math.sin(2 * Math.PI * frequency * 3 * time);
    samples[first + index] += 0.22 * envelope * tone;
  }
  start += length;
}

// A soft noise swell under the last note, like a cymbal.
const cymbal = Math.floor((start - 1.4) * rate);
let seed = 26;
for (let index = 0; index + cymbal < samples.length; index += 1) {
  seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
  const noise = seed / 0x7fffffff - 0.5;
  const time = index / rate;
  samples[cymbal + index] += 0.08 * noise * Math.exp(-time * 2.5);
}

const pcm = Buffer.alloc(samples.length * 2);
for (let index = 0; index < samples.length; index += 1) {
  const clamped = Math.max(-1, Math.min(1, samples[index]));
  pcm.writeInt16LE(Math.round(clamped * 32_767), index * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

const target = fileURLToPath(new URL("../apps/web/public/assets/demo-sting.wav", import.meta.url));
writeFileSync(target, Buffer.concat([header, pcm]));
console.log(`Wrote ${target} (${(total).toFixed(2)} s, ${header.length + pcm.length} bytes).`);
