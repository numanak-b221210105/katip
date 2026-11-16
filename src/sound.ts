// Quiet interface sounds. They never play while the microphone is open,
// so they cannot end up in a recording.
let ctx: AudioContext | null = null;
let on = true;
try { on = localStorage.getItem("katip.sound") !== "0"; } catch { /* private mode */ }
export const soundOn = () => on;
export function setSound(v: boolean) { on = v; try { localStorage.setItem("katip.sound", v ? "1" : "0"); } catch { /* ignore */ } }

function tone(f: number, at: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.value = f;
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

/** Plays a cue and resolves when it has finished (so recording can start after it). */
export function cue(kind: "start" | "done" | "error" | "tap"): Promise<void> {
  if (!on) return Promise.resolve();
  try {
    ctx ??= new AudioContext();
    if (ctx.state !== "running") void ctx.resume();
    if (kind === "start") { tone(660, 0, 0.16, 0.05); tone(990, 0.09, 0.2, 0.04); return new Promise((r) => setTimeout(r, 320)); }
    if (kind === "done") { tone(784, 0, 0.3, 0.04); tone(1175, 0.1, 0.4, 0.03); }
    if (kind === "error") { tone(330, 0, 0.25, 0.045); tone(262, 0.12, 0.3, 0.04); }
    if (kind === "tap") tone(1200, 0, 0.05, 0.02);
  } catch { /* audio unavailable */ }
  return Promise.resolve();
}
