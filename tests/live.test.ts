import { describe, expect, it } from "vitest";
import { SR } from "../src/audio";
import { LiveTranscriber, toSegments } from "../src/live";

const speech = (sec: number) => new Float32Array(Math.round(sec * SR)).map((_, i) => Math.sin(i / 7) * 0.3);

describe("live transcription", () => {
  it("never sends more than 30 s and commits in order", async () => {
    const seen: number[] = [];
    const live = new LiveTranscriber(async (pcm, offset) => {
      seen.push(pcm.length / SR);
      return [{ start: offset, end: offset + pcm.length / SR, text: `parça@${Math.round(offset)}` }];
    }, () => {});
    for (let t = 0; t < 70; t += 2) {
      live.push(speech(2));
      live.tick();
      await new Promise((r) => setTimeout(r, 0));
    }
    const segs = await live.finish();
    expect(Math.max(...seen)).toBeLessThanOrEqual(30);
    expect(segs.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < segs.length; i++) expect(segs[i].start).toBeGreaterThanOrEqual(segs[i - 1].end - 0.01);
    expect(segs[segs.length - 1].end).toBeCloseTo(70, 0);
  });
  it("shows a draft before committing", async () => {
    const live = new LiveTranscriber(async () => [{ start: 0, end: 1, text: "taslak" }], () => {});
    live.push(speech(3));
    live.tick();
    await new Promise((r) => setTimeout(r, 0));
    expect(live.draft).toBe("taslak");
    expect(live.segments.length).toBe(0);
  });
  it("maps Whisper chunks to absolute times and drops tags", () => {
    const s = toSegments([{ timestamp: [0, 2], text: " Merhaba" }, { timestamp: [2, null], text: "[Müzik]" }, { timestamp: [3, null], text: " dünya" }], 10, 5);
    expect(s).toEqual([{ start: 10, end: 12, text: "Merhaba" }, { start: 13, end: 15, text: "dünya" }]);
  });
});

describe("slow model", () => {
  it("keeps every call within 30 s even when audio piles up", async () => {
    const seen: number[] = [];
    const live = new LiveTranscriber(async (pcm, offset) => {
      seen.push(pcm.length / SR);
      return [{ start: offset, end: offset + pcm.length / SR, text: "x" }];
    }, () => {});
    live.push(speech(3)); live.tick();      // starts a pass on 3 s
    live.push(speech(40));                    // 40 s arrive while it is busy
    await new Promise((r) => setTimeout(r, 0));
    live.tick();
    const segs = await live.finish();
    expect(Math.max(...seen)).toBeLessThanOrEqual(28.01);
    expect(segs[segs.length - 1].end).toBeCloseTo(43, 0);
  });
});
