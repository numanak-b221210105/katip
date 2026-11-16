// Main-thread client for the Whisper worker.
import type { FromWorker, ModelSize, ToWorker } from "./asr.worker";
import { SR } from "./audio";
import { toSegments } from "./live";
import type { Segment } from "./format";

export type { ModelSize };
export interface EngineInfo { model: ModelSize; device: "webgpu" | "wasm"; loadMs: number; runs: number; audioSec: number; procMs: number }

export async function detectDevice(): Promise<"webgpu" | "wasm"> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (gpu && (await gpu.requestAdapter())) return "webgpu";
  } catch { /* fall through */ }
  return "wasm";
}

export class Engine {
  private worker: Worker | null = null;
  private pending = new Map<number, { res: (s: Segment[]) => void; rej: (e: Error) => void; offset: number; dur: number }>();
  private nextId = 1;
  private loading: Promise<void> | null = null;
  private wanted = "";
  info: EngineInfo | null = null;
  onProgress: (loaded: number, total: number) => void = () => {};

  private spawn(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL("./asr.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<FromWorker>) => this.handle(e.data);
    w.onerror = (e) => this.failAll(new Error(e.message || "worker error"));
    this.worker = w;
    return w;
  }

  private loadRes: (() => void) | null = null;
  private loadRej: ((e: Error) => void) | null = null;

  private handle(m: FromWorker) {
    if (m.type === "progress") this.onProgress(m.loaded, m.total);
    else if (m.type === "ready") {
      if (this.info) Object.assign(this.info, { loadMs: m.ms });
      this.loadRes?.();
    } else if (m.type === "result") {
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (this.info) { this.info.runs++; this.info.procMs += m.ms; this.info.audioSec += p.dur; }
      p.res(toSegments(m.chunks, p.offset, p.dur));
    } else if (m.type === "error") {
      if (m.id !== undefined) { this.pending.get(m.id)?.rej(new Error(m.message)); this.pending.delete(m.id); }
      else { this.loadRej?.(new Error(m.message)); this.loading = null; this.wanted = ""; }
    }
  }
  private failAll(e: Error) {
    this.loadRej?.(e);
    for (const p of this.pending.values()) p.rej(e);
    this.pending.clear();
  }

  load(model: ModelSize, device: "webgpu" | "wasm"): Promise<void> {
    const key = model + device;
    if (this.loading && this.wanted === key) return this.loading;
    this.wanted = key;
    this.info = { model, device, loadMs: 0, runs: 0, audioSec: 0, procMs: 0 };
    this.loading = new Promise<void>((res, rej) => {
      this.loadRes = res; this.loadRej = rej;
      this.spawn().postMessage({ type: "load", model, device } satisfies ToWorker);
    });
    return this.loading;
  }
  get ready(): boolean { return !!this.loading; }

  transcribe(pcm: Float32Array, offset: number, language: string): Promise<Segment[]> {
    const id = this.nextId++;
    const copy = pcm.slice();
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej, offset, dur: pcm.length / SR });
      this.spawn().postMessage({ type: "run", id, pcm: copy, language } satisfies ToWorker, [copy.buffer]);
    });
  }

  /** Real-time factor: seconds of compute per second of audio. */
  get rtf(): number { return this.info && this.info.audioSec ? this.info.procMs / 1000 / this.info.audioSec : 0; }
}

/** Deletes downloaded model weights from the browser cache. */
export async function clearModelCache(): Promise<number> {
  let n = 0;
  for (const k of await caches.keys()) if (k.includes("transformers")) { await caches.delete(k); n++; }
  return n;
}
export async function modelCacheBytes(): Promise<number> {
  let total = 0;
  for (const k of await caches.keys()) {
    if (!k.includes("transformers")) continue;
    const c = await caches.open(k);
    for (const req of await c.keys()) {
      const r = await c.match(req);
      const len = Number(r?.headers.get("content-length") ?? 0);
      total += len || (r ? (await r.clone().blob()).size : 0);
    }
  }
  return total;
}
