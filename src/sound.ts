// Quiet interface sounds (SoundKit palette). They never play while the microphone
// is open, so they cannot end up in a recording. "ambient" session: they mix with
// other audio and follow the phone's silent switch.
import { SoundKit, uiSounds } from "./soundkit";

const kit = uiSounds(new SoundKit({ storageKey: "katip.sound", volume: 0.7, reverb: 0.14, session: "ambient" }));
export const soundOn = () => kit.enabled;
export function setSound(v: boolean) { kit.setEnabled(v); }

const NAMES = { start: "start", done: "notify", error: "error", tap: "tap", stop: "stop" } as const;
const VOL = { start: 0.5, done: 0.45, error: 0.5, tap: 0.35, stop: 0.45 } as const;

/** Plays a cue; for "start" it resolves after the sound so recording begins in silence. */
export async function cue(kind: keyof typeof NAMES): Promise<void> {
  await kit.playSoon(NAMES[kind], { vol: VOL[kind] });
  if (kind === "start" && kit.enabled) await new Promise((r) => setTimeout(r, 420));
}
