export async function recordWav(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const gain = context.createGain();
  gain.gain.value = 0;
  const samples: number[] = [];
  const maxSamples = Math.floor(context.sampleRate * 2.9);
  const done = new Promise<void>((resolve) => {
    processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      for (const sample of channel) {
        if (samples.length < maxSamples) {
          samples.push(sample);
        }
      }
      if (samples.length >= maxSamples) {
        resolve();
      }
    };
    window.setTimeout(resolve, 2900);
  });
  source.connect(processor);
  processor.connect(gain);
  gain.connect(context.destination);
  await done;
  processor.disconnect();
  source.disconnect();
  gain.disconnect();
  for (const track of stream.getTracks()) {
    track.stop();
  }
  const blob = encodeWav(new Float32Array(samples), context.sampleRate);
  await context.close();
  return blob;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  write(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(view, 8, "WAVE");
  write(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function write(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
