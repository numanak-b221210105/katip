// Microphone capture: 16 kHz mono blocks for the model, plus a compressed copy for playback.
import { SR, resample } from "./audio";

const WORKLET = `class Tap extends AudioWorkletProcessor{process(i){const c=i[0];if(c&&c[0])this.port.postMessage(c[0].slice(0));return true}}registerProcessor("katip-tap",Tap);`;

export class Recorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private media: MediaRecorder | null = null;
  private parts: Blob[] = [];
  private analyser: AnalyserNode | null = null;
  private buf: Float32Array[] = [];
  private bufLen = 0;
  paused = false;

  constructor(private onBlock: (pcm16k: Float32Array) => void) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.ctx = new AudioContext();
    // iOS creates contexts suspended outside a tap; capturing audio allows resuming.
    if (this.ctx.state !== "running") await this.ctx.resume().catch(() => {});
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.node = new AudioWorkletNode(this.ctx, "katip-tap");
    const rate = this.ctx.sampleRate;
    const blockLen = Math.round(rate / 4); // 250 ms
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (this.paused) return;
      this.buf.push(e.data);
      this.bufLen += e.data.length;
      if (this.bufLen >= blockLen) {
        const all = new Float32Array(this.bufLen);
        let o = 0;
        for (const b of this.buf) { all.set(b, o); o += b.length; }
        this.buf = []; this.bufLen = 0;
        this.onBlock(rate === SR ? all : resample(all, rate));
      }
    };
    src.connect(this.analyser);
    src.connect(this.node);
    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported?.(m));
    try {
      this.media = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      this.media.ondataavailable = (e) => e.data.size && this.parts.push(e.data);
      this.media.start(1000);
    } catch { this.media = null; }
  }

  pause(p: boolean) {
    this.paused = p;
    if (this.media?.state === "recording" && p) this.media.pause();
    else if (this.media?.state === "paused" && !p) this.media.resume();
  }

  /** Current input level 0..1 for the meter. */
  level(): number {
    if (!this.analyser) return 0;
    const d = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(d);
    let s = 0;
    for (const x of d) s += x * x;
    return Math.min(1, Math.sqrt(s / d.length) * 4);
  }

  async stop(): Promise<Blob | null> {
    const done = this.media && this.media.state !== "inactive"
      ? new Promise<void>((r) => { this.media!.onstop = () => r(); this.media!.stop(); })
      : Promise.resolve();
    await done;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close();
    const type = this.media?.mimeType || "audio/webm";
    return this.parts.length ? new Blob(this.parts, { type }) : null;
  }
}
