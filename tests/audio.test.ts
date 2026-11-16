import { describe, expect, it } from "vitest";
import { SR, concat, mixdown, quietCut, resample, rms, toWav } from "../src/audio";

describe("audio", () => {
  it("resamples 48 kHz to 16 kHz", () => {
    const x = new Float32Array(48000).map((_, i) => Math.sin(i / 10));
    const y = resample(x, 48000);
    expect(y.length).toBe(16000);
    expect(y[100]).toBeCloseTo(x[300], 5);
  });
  it("mixes channels down", () => {
    expect([...mixdown([new Float32Array([1, 0]), new Float32Array([0, 1])])]).toEqual([0.5, 0.5]);
  });
  it("writes a valid WAV header", async () => {
    const w = toWav(new Float32Array(SR));
    const b = new Uint8Array(await w.arrayBuffer());
    expect(String.fromCharCode(...b.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...b.slice(8, 12))).toBe("WAVE");
    expect(b.length).toBe(44 + SR * 2);
  });
  it("cuts in the quietest place", () => {
    const loud = () => new Float32Array(SR).map((_, i) => Math.sin(i) * 0.5);
    const pcm = concat([loud(), loud(), new Float32Array(SR / 2), loud()]);
    const cut = quietCut(pcm, SR);
    expect(cut).toBeGreaterThan(2 * SR);
    expect(cut).toBeLessThan(2.5 * SR);
    expect(rms(pcm.subarray(cut - 800, cut + 800))).toBeLessThan(0.01);
  });
});
