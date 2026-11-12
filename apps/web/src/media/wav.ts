export async function recordWav(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: ScriptProcessorNode | undefined;
  let gain: GainNode | undefined;
  try {
    context = new AudioContext();
    source = context.createMediaStreamSource(stream);
    const node = (processor = context.createScriptProcessor(4096, 1, 1));
    gain = context.createGain();
    gain.gain.value = 0;
    const maxSamples = Math.floor(context.sampleRate * 2.9);
    const samples = new Float32Array(maxSamples);
    let filled = 0;
    const done = new Promise<void>((resolve) => {
      let timer = 0;
      const finish = () => {
        window.clearTimeout(timer);
        resolve();
      };
      node.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        const remaining = maxSamples - filled;
        if (remaining > 0) {
          const slice =
            channel.length > remaining ? channel.subarray(0, remaining) : channel;
          samples.set(slice, filled);
          filled += slice.length;
        }
        if (filled >= maxSamples) {
          finish();
        }
      };
      timer = window.setTimeout(finish, 2900);
    });
    source.connect(node);
    node.connect(gain);
    gain.connect(context.destination);
    await done;
    return encodeWav(samples.subarray(0, filled), context.sampleRate);
  } finally {
    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
    }
    source?.disconnect();
    gain?.disconnect();
    for (const track of stream.getTracks()) {
      track.stop();
    }
    if (context) {
      await context.close().catch(() => {});
    }
  }
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
