// Live transcription while recording.
// Audio keeps arriving; whenever the model is free it transcribes everything
// since the last "commit point" as a draft. Once that window grows past ~24 s,
// it cuts at a quiet moment, transcribes that part one final time and commits it,
// so the model never sees more than 30 s at once and words are not split.
import { SR, concat, quietCut } from "./audio";
import type { Segment } from "./format";

export type Transcribe = (pcm: Float32Array, offset: number) => Promise<Segment[]>;

export class LiveTranscriber {
  private blocks: Float32Array[] = [];
  private length = 0;
  private committedAt = 0; // sample index
  private lastRunAt = 0;
  private busy: Promise<void> | null = null;
  segments: Segment[] = [];
  draft = "";
  runs = 0;

  constructor(private transcribe: Transcribe, private onChange: () => void, private opts = { window: 24, minNew: 1.5 }) {}

  push(block: Float32Array): void {
    this.blocks.push(block);
    this.length += block.length;
  }
  get seconds(): number { return this.length / SR; }
  get committedSeconds(): number { return this.committedAt / SR; }
  audio(): Float32Array {
    const all = concat(this.blocks);
    this.blocks = [all];
    return all;
  }

  /** Call regularly; starts a pass if the model is idle and enough new audio arrived. */
  tick(): void {
    if (this.busy) return;
    if ((this.length - this.lastRunAt) / SR < this.opts.minNew) return;
    this.busy = this.pass(false).catch(() => { /* retried on the next tick */ }).finally(() => { this.busy = null; });
  }

  /** Stops listening and transcribes whatever is left. */
  async finish(): Promise<Segment[]> {
    while (this.busy) await this.busy;
    await this.pass(true);
    return this.segments;
  }

  private async pass(final: boolean, force = false): Promise<void> {
    const pcm = this.audio();
    this.lastRunAt = pcm.length;
    const winLen = (pcm.length - this.committedAt) / SR;
    if (winLen < 0.3) { this.draft = ""; this.onChange(); return; }
    // A final pass on a long tail is split so each call stays within the model's 30 s window.
    if (final && winLen > 28) { await this.pass(false, true); return this.pass(true); }
    const commit = final || force || winLen >= this.opts.window;
    let end = pcm.length;
    if (commit && !final) {
      // Look for a pause between (window-6) s and 28 s, so the model never gets more than 28 s.
      const limit = Math.min(pcm.length, this.committedAt + 28 * SR);
      end = quietCut(pcm.subarray(0, limit), this.committedAt + Math.round((this.opts.window - 6) * SR));
    }
    const start = this.committedAt;
    const segs = await this.transcribe(pcm.slice(start, end), start / SR);
    this.runs++;
    if (commit) {
      this.segments.push(...segs.filter((s) => s.text.trim()));
      this.committedAt = end;
      this.draft = "";
    } else {
      this.draft = segs.map((s) => s.text).join(" ").trim();
    }
    this.onChange();
  }
}

/** Turns Whisper's chunks into absolute segments. */
export function toSegments(chunks: { timestamp: [number, number | null]; text: string }[], offset: number, duration: number): Segment[] {
  return chunks
    .map((c, i) => {
      const s = c.timestamp[0] ?? 0;
      const e = c.timestamp[1] ?? chunks[i + 1]?.timestamp[0] ?? duration;
      return { start: offset + s, end: offset + Math.max(s, Math.min(e, duration)), text: c.text.trim() };
    })
    .filter((s) => s.text && !/^\[.*\]$|^\(.*\)$/.test(s.text)); // drop "[Music]" style tags
}
