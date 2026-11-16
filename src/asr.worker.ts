/// <reference lib="webworker" />
// Runs Whisper entirely in the browser. Weights are downloaded once from the
// Hugging Face hub and kept in the browser's Cache Storage; audio never leaves the device.
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

export type ModelSize = "tiny" | "base" | "small";
export type ToWorker =
  | { type: "load"; model: ModelSize; device: "webgpu" | "wasm" }
  | { type: "run"; id: number; pcm: Float32Array; language: string };
export type FromWorker =
  | { type: "progress"; loaded: number; total: number; file?: string }
  | { type: "ready"; model: ModelSize; device: string; ms: number }
  | { type: "result"; id: number; chunks: { timestamp: [number, number | null]; text: string }[]; ms: number }
  | { type: "error"; id?: number; message: string };

const post = (m: FromWorker, t?: Transferable[]) => (self as DedicatedWorkerGlobalScope).postMessage(m, t ?? []);
let asr: AutomaticSpeechRecognitionPipeline | null = null;
let current = "";
let queue: Promise<unknown> = Promise.resolve();

async function load(model: ModelSize, device: "webgpu" | "wasm") {
  const key = model + device;
  if (asr && current === key) return post({ type: "ready", model, device, ms: 0 });
  await asr?.dispose();
  asr = null;
  const t0 = performance.now();
  const dtype = device === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8";
  asr = (await pipeline("automatic-speech-recognition", `onnx-community/whisper-${model}`, {
    device,
    dtype: dtype as never,
    progress_callback: (p: { status: string; loaded?: number; total?: number; file?: string }) => {
      if (p.status === "progress_total") post({ type: "progress", loaded: p.loaded ?? 0, total: p.total ?? 0 });
    },
  })) as AutomaticSpeechRecognitionPipeline;
  current = key;
  post({ type: "ready", model, device, ms: performance.now() - t0 });
}

async function run(id: number, pcm: Float32Array, language: string) {
  if (!asr) throw new Error("model not loaded");
  const t0 = performance.now();
  const out = (await asr(pcm, {
    language: language === "auto" ? null : language,
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  } as never)) as { text: string; chunks?: { timestamp: [number, number | null]; text: string }[] };
  const chunks = out.chunks?.length ? out.chunks : [{ timestamp: [0, pcm.length / 16000] as [number, number], text: out.text }];
  post({ type: "result", id, chunks, ms: performance.now() - t0 });
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  queue = queue.then(() => (m.type === "load" ? load(m.model, m.device) : run(m.id, m.pcm, m.language))).catch((err: unknown) => {
    post({ type: "error", id: m.type === "run" ? m.id : undefined, message: err instanceof Error ? err.message : String(err) });
  });
};
