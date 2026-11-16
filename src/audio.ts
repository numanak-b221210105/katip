// Audio helpers: everything Whisper needs is 16 kHz mono Float32 PCM.
export const SR = 16000;

/** Linear-interpolation resampler (good enough for speech). */
export function resample(input: Float32Array, from: number, to = SR): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio, i0 = Math.floor(x), t = x - i0;
    const a = input[i0] ?? 0, b = input[i0 + 1] ?? a;
    out[i] = a + (b - a) * t;
  }
  return out;
}

export function mixdown(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** Decodes any audio/video file the browser understands into 16 kHz mono. */
export async function decodeFile(file: Blob): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(buf);
    const chans = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
    return resample(mixdown(chans), audio.sampleRate);
  } finally {
    ctx.close();
  }
}

/** 16-bit PCM WAV, used to store and replay recordings when MediaRecorder is unavailable. */
export function toWav(pcm: Float32Array, sampleRate = SR): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** Root-mean-square level of a block, 0..1. */
export function rms(block: Float32Array): number {
  let s = 0;
  for (let i = 0; i < block.length; i++) s += block[i] * block[i];
  return Math.sqrt(s / Math.max(1, block.length));
}

/** Concatenates PCM blocks. */
export function concat(blocks: Float32Array[]): Float32Array {
  const out = new Float32Array(blocks.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const b of blocks) { out.set(b, o); o += b.length; }
  return out;
}

/**
 * Finds a quiet place to cut a live recording: the lowest-energy 200 ms window
 * in the last part of the buffer. Cutting in a pause avoids splitting words.
 */
export function quietCut(pcm: Float32Array, searchFrom: number): number {
  const win = SR / 5;
  let best = pcm.length, bestE = Infinity;
  for (let s = Math.max(0, searchFrom); s + win <= pcm.length; s += win / 2) {
    const e = rms(pcm.subarray(s, s + win));
    if (e < bestE) { bestE = e; best = s + win / 2; }
  }
  return Math.min(pcm.length, Math.round(best));
}
