// Time formatting and export formats.
export interface Segment { start: number; end: number; text: string }

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
/** 75.5 -> "01:15", 3725 -> "1:02:05" */
export function clock(sec: number): string {
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function stamp(sec: number, sep: "," | "."): string {
  sec = Math.max(0, sec);
  const ms = Math.round((sec % 1) * 1000);
  const whole = Math.floor(sec) + (ms === 1000 ? 1 : 0);
  return `${pad(whole / 3600)}:${pad((whole % 3600) / 60)}:${pad(whole % 60)}${sep}${pad(ms === 1000 ? 0 : ms, 3)}`;
}
const clean = (segs: Segment[]) => segs.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text);

export function toSrt(segs: Segment[]): string {
  return clean(segs).map((s, i) => `${i + 1}\n${stamp(s.start, ",")} --> ${stamp(s.end, ",")}\n${s.text}\n`).join("\n");
}
export function toVtt(segs: Segment[]): string {
  return "WEBVTT\n\n" + clean(segs).map((s) => `${stamp(s.start, ".")} --> ${stamp(s.end, ".")}\n${s.text}\n`).join("\n");
}
export function toTxt(segs: Segment[]): string {
  return paragraphs(clean(segs)).map((p) => p.map((s) => s.text).join(" ")).join("\n\n") + "\n";
}
export function toMarkdown(title: string, date: string, segs: Segment[], highlights: string[] = [], keywords: string[] = []): string {
  let md = `# ${title}\n\n_${date}_\n\n`;
  if (keywords.length) md += `**${keywords.join(" · ")}**\n\n`;
  if (highlights.length) md += highlights.map((h) => `> ${h}`).join("\n>\n") + "\n\n";
  md += paragraphs(clean(segs)).map((p) => `**[${clock(p[0].start)}]** ${p.map((s) => s.text).join(" ")}`).join("\n\n");
  return md + "\n";
}

/** Groups segments into paragraphs at long pauses (or every ~6 segments). */
export function paragraphs(segs: Segment[], pause = 1.6, max = 6): Segment[][] {
  const out: Segment[][] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (!last || s.start - last[last.length - 1].end > pause || last.length >= max) out.push([s]);
    else last.push(s);
  }
  return out;
}
