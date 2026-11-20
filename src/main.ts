import "./style.css";
import { Engine, clearModelCache, detectDevice, modelCacheBytes, type ModelSize } from "./asr";
import { SR, decodeFile, quietCut, toWav } from "./audio";
import { clock, toMarkdown, toSrt, toTxt, toVtt, paragraphs, type Segment } from "./format";
import { getLang, locale, setLang, t, type Key, type Lang } from "./i18n";
import { LiveTranscriber } from "./live";
import { Recorder } from "./recorder";
import { autoTitle, deleteNote, getNote, listNotes, newId, saveNote, search, type Note } from "./store";
import { highlights, keywords } from "./summary";
import { cue, setSound, soundOn } from "./sound";
import { canInstall, installHint, keepAwake, onInstallable, promptInstall } from "./install";

// ---------- settings ----------
interface Settings { model: ModelSize; lang: string; theme: "system" | "light" | "dark"; ui: Lang }
const DEFAULTS: Settings = { model: "base", lang: "tr", theme: "system", ui: navigator.language?.startsWith("tr") ? "tr" : "en" };
function loadSettings(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("katip.settings") ?? "{}") }; } catch { return { ...DEFAULTS }; }
}
const settings = loadSettings();
function saveSettings() { try { localStorage.setItem("katip.settings", JSON.stringify(settings)); } catch { /* private mode */ } }
function applyTheme() {
  const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#141b2b" : "#f6f1e7");
}
setLang(settings.ui);
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

// ---------- tiny DOM helper ----------
type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "class") el.className = String(v);
    else if (k === "html") el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
const icon = (name: string) => h("span", { class: "ic", "aria-hidden": "true", html: ICONS[name] ?? "" });
const ICONS: Record<string, string> = {
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 18v-6M9 15l3-3 3 3"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
};

// ---------- app state ----------
const engine = new Engine();
let device: "webgpu" | "wasm" = "wasm";
const deviceReady = detectDevice().then((d) => (device = d));
let notes: Note[] = [];
let session: { rec: Recorder; live: LiveTranscriber; started: number; pausedMs: number; pausedAt: number } | null = null;
let busy: "" | "finishing" | "file" = "";
let fileProgress = 0;
let modelState: { loading: boolean; pct: number; error?: string } = { loading: false, pct: 0 };
let releaseAwake: (() => void) | null = null;
let libraryQuery = "";

engine.onProgress = (loaded, total) => {
  modelState.pct = total ? loaded / total : 0;
  updateModelBar();
};

async function ensureModel(): Promise<void> {
  await deviceReady;
  modelState = { loading: true, pct: 0 };
  updateModelBar();
  try {
    await engine.load(settings.model, device);
  } catch (e) {
    if (device === "webgpu") { device = "wasm"; return ensureModel(); } // fall back to CPU
    modelState = { loading: false, pct: 0, error: String(e instanceof Error ? e.message : e) };
    updateModelBar();
    throw e;
  }
  modelState = { loading: false, pct: 1 };
  updateModelBar();
}

// ---------- routing ----------
const app = document.getElementById("app")!;
function route(): { view: string; id?: string } {
  const [, view = "", id] = location.hash.split("/");
  return { view, id };
}
window.addEventListener("hashchange", render);
const go = (hash: string) => { if (location.hash !== hash) location.hash = hash; else render(); };

async function render() {
  notes = await listNotes();
  const r = route();
  app.replaceChildren(shell(r.view, await body(r)));
  document.title = r.view === "note" ? `${notes.find((n) => n.id === r.id)?.title ?? ""} · Kâtip` : "Kâtip";
}

async function body(r: { view: string; id?: string }): Promise<HTMLElement> {
  if (r.view === "notes") return libraryView(true);
  if (r.view === "settings") return settingsView();
  if (r.view === "note" && r.id) {
    const n = await getNote(r.id);
    if (n) return noteView(n);
  }
  return recordView();
}

// ---------- shell ----------
function shell(view: string, main: HTMLElement): HTMLElement {
  const nav = (hash: string, key: Key, ic: string, active: boolean) =>
    h("a", { href: hash, class: "nav" + (active ? " on" : ""), "aria-current": active ? "page" : undefined }, icon(ic), h("span", {}, t(key)));
  const v = view || "rec";
  return h("div", { class: "shell" },
    h("aside", { class: "side" },
      h("a", { class: "brand", href: "#/" }, logo(), h("span", { class: "word" }, "Kâtip")),
      h("p", { class: "tagline" }, t("tagline")),
      h("nav", { class: "sidenav" }, nav("#/", "home", "mic", v === "rec"), nav("#/settings", "settings", "gear", v === "settings")),
      libraryView(false),
      h("div", { class: "side-foot" }, toggles(), canInstall() && h("button", { class: "btn ghost sm", onclick: install }, icon("dl"), t("install")))),
    h("header", { class: "top" },
      h("a", { class: "brand", href: "#/" }, logo(), h("span", { class: "word" }, "Kâtip")), toggles()),
    h("main", { class: "main" }, main),
    h("nav", { class: "bottom" }, nav("#/", "home", "mic", v === "rec"), nav("#/notes", "library", "list", v === "notes" || v === "note"), nav("#/settings", "settings", "gear", v === "settings")),
  );
}

function logo(): SVGElement {
  const d = document.createElement("span");
  d.innerHTML = '<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" class="seal"/><path d="M13 27c4-1 9-6 13-14l2 1c-3 8-8 13-14 15z" class="quill"/><path d="M12 29h16" class="line"/></svg>';
  return d.firstElementChild as SVGElement;
}

function toggles(): HTMLElement {
  return h("div", { class: "toggles" },
    h("button", { class: "chip", title: t("uiLang"), onclick: () => { settings.ui = getLang() === "tr" ? "en" : "tr"; setLang(settings.ui); saveSettings(); render(); } }, getLang() === "tr" ? "EN" : "TR"),
    h("button", { class: "chip snd", title: t("sounds"), "aria-label": t("sounds"), "aria-pressed": String(soundOn()), onclick: (e: Event) => {
      setSound(!soundOn()); (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(soundOn())); void cue("tap");
    } }, h("span", { class: "spk", "aria-hidden": "true" })),
    h("button", { class: "chip", title: t("theme"), "aria-label": t("theme"), onclick: () => {
      const dark = document.documentElement.dataset.theme === "dark";
      settings.theme = dark ? "light" : "dark"; saveSettings(); applyTheme();
    } }, h("span", { class: "moon", "aria-hidden": "true" })));
}

async function install() { await promptInstall(); render(); }
onInstallable(() => render());

// ---------- record view ----------
let liveBox: HTMLElement | null = null;
let timerEl: HTMLElement | null = null;
let meterEl: HTMLElement | null = null;
let modelBar: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;

function recordView(): HTMLElement {
  const recording = !!session;
  const seal = h("button", {
    class: "seal-btn" + (recording ? " live" : "") + (session?.rec.paused ? " held" : ""),
    "aria-label": recording ? t("stop") : t("record"),
    disabled: busy !== "",
    onclick: () => (recording ? finishRecording() : startRecording()),
  }, h("span", { class: "ring" }), h("span", { class: "face" }, recording ? h("span", { class: "sq" }) : icon("mic")));
  meterEl = seal.querySelector(".ring");
  timerEl = h("div", { class: "timer" }, recording ? clock(elapsed()) : "00:00");
  statusEl = h("div", { class: "status" }, statusText());
  liveBox = h("div", { class: "live-text", "aria-live": "polite" });
  modelBar = h("div", { class: "model-bar" });
  const file = h("input", { type: "file", accept: "audio/*,video/*", hidden: true, onchange: (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) importFile(f);
  } }) as HTMLInputElement;

  const view = h("section", { class: "record" },
    h("div", { class: "desk" },
      h("div", { class: "seal-wrap" }, seal),
      timerEl, statusEl,
      h("div", { class: "rec-actions" },
        recording && h("button", { class: "btn ghost", onclick: togglePause }, icon(session!.rec.paused ? "play" : "pause"), t(session!.rec.paused ? "resume" : "pause")),
        !recording && h("button", { class: "btn ghost", disabled: busy !== "", onclick: () => file.click() }, icon("file"), t("import")), file),
      modelBar),
    h("article", { class: "paper sheet" + (recording || busy ? "" : " empty") }, liveBox),
    h("p", { class: "promise" }, icon("lock"), h("span", {}, t("sent"), ": ", h("b", {}, t("bytes")), " · ", t("firstTime"))));

  view.addEventListener("dragover", (e) => { e.preventDefault(); view.classList.add("drop"); });
  view.addEventListener("dragleave", () => view.classList.remove("drop"));
  view.addEventListener("drop", (e) => {
    e.preventDefault(); view.classList.remove("drop");
    const f = e.dataTransfer?.files[0];
    if (f && !session && !busy) importFile(f);
  });
  updateLive(); updateModelBar();
  return view;
}

function statusText(): string {
  if (busy === "finishing") return t("finishing");
  if (busy === "file") return `${t("transcribingFile")} ${Math.round(fileProgress * 100)}%`;
  if (session) return session.rec.paused ? t("paused") : t("listening");
  return t("tapToRecord");
}
function elapsed(): number {
  if (!session) return 0;
  const now = session.rec.paused ? session.pausedAt : Date.now();
  return (now - session.started - session.pausedMs) / 1000;
}

function updateModelBar() {
  if (!modelBar) return;
  const info = engine.info;
  if (modelState.error) {
    modelBar.replaceChildren(h("span", { class: "err" }, `${t("error")}: ${modelState.error}`));
  } else if (modelState.loading) {
    modelBar.replaceChildren(
      h("span", {}, `${t("loadingModel")} · whisper-${settings.model}`),
      h("span", { class: "bar" }, h("i", { style: `width:${Math.round(modelState.pct * 100)}%` })),
      h("span", { class: "pct" }, `${Math.round(modelState.pct * 100)}%`));
  } else if (info && engine.ready) {
    modelBar.replaceChildren(h("span", { class: "ok" }, `${t("modelReady")} · whisper-${info.model} · ${info.device === "webgpu" ? "WebGPU" : "WASM"}`));
  } else modelBar.replaceChildren();
}

function updateLive() {
  if (!liveBox) return;
  const segs: Segment[] = session?.live.segments ?? fileSegs;
  const draft = session?.live.draft ?? "";
  if (!segs.length && !draft) {
    liveBox.replaceChildren(h("p", { class: "hint" }, session || busy ? "…" : t("tagline")));
    return;
  }
  liveBox.replaceChildren(
    ...paragraphs(segs).map((p) => h("p", {}, h("span", { class: "stamp" }, clock(p[0].start)), " ", p.map((s) => s.text).join(" "))),
    ...(draft ? [h("p", { class: "draft" }, draft)] : []));
  liveBox.parentElement?.scrollTo({ top: liveBox.parentElement.scrollHeight, behavior: "smooth" });
}

let raf = 0;
function tickUi() {
  if (!session) return;
  if (timerEl) timerEl.textContent = clock(elapsed());
  if (meterEl) meterEl.style.setProperty("--lvl", String(session.rec.paused ? 0 : session.rec.level()));
  if (engine.ready && !modelState.loading && !modelState.error) session.live.tick();
  raf = requestAnimationFrame(tickUi);
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === "undefined") return toast(t("unsupported"));
  const live = new LiveTranscriber((pcm, offset) => engine.transcribe(pcm, offset, settings.lang), updateLive);
  const rec = new Recorder((block) => live.push(block));
  await cue("start"); // finishes before the microphone opens
  try { await rec.start(); } catch { return toast(t("micDenied")); }
  session = { rec, live, started: Date.now(), pausedMs: 0, pausedAt: 0 };
  // Phones stop recording when the screen locks: keep it on while we listen.
  releaseAwake = await keepAwake();
  ensureModel().catch(() => {});
  await render();
  raf = requestAnimationFrame(tickUi);
}

function togglePause() {
  if (!session) return;
  const p = !session.rec.paused;
  if (p) session.pausedAt = Date.now(); else session.pausedMs += Date.now() - session.pausedAt;
  session.rec.pause(p);
  render();
}

async function finishRecording() {
  if (!session) return;
  const s = session;
  cancelAnimationFrame(raf);
  busy = "finishing";
  const blob = await s.rec.stop();
  void cue("stop");
  render();
  const t0 = performance.now();
  try {
    await ensureModel();
    const segs = await s.live.finish();
    const audio = s.live.audio();
    const note: Note = {
      id: newId(), title: autoTitle(segs, t("untitled")), created: s.started, duration: audio.length / SR,
      lang: settings.lang, model: settings.model, device: engine.info?.device ?? device,
      procMs: engine.info?.procMs ?? performance.now() - t0, segments: segs, audio: blob ?? toWav(audio), source: "mic",
    };
    await saveNote(note);
    session = null; busy = "";
    releaseAwake?.(); releaseAwake = null;
    void cue("done");
    go(`#/note/${note.id}`);
  } catch (e) {
    session = null; busy = "";
    releaseAwake?.(); releaseAwake = null;
    void cue("error");
    toast(`${t("error")}: ${e instanceof Error ? e.message : e}`);
    render();
  }
}

// ---------- file import ----------
let fileSegs: Segment[] = [];
async function importFile(f: File) {
  busy = "file"; fileProgress = 0; fileSegs = [];
  const awake = await keepAwake();
  await render();
  try {
    const [pcm] = await Promise.all([decodeFile(f), ensureModel()]);
    const procBefore = engine.info?.procMs ?? 0;
    let start = 0;
    while (start < pcm.length) {
      let end = pcm.length;
      if ((pcm.length - start) / SR > 28) end = quietCut(pcm.subarray(0, start + 28 * SR), start + 20 * SR);
      const segs = await engine.transcribe(pcm.subarray(start, end), start / SR, settings.lang);
      fileSegs.push(...segs);
      start = end;
      fileProgress = start / pcm.length;
      if (statusEl) statusEl.textContent = statusText();
      updateLive();
    }
    const note: Note = {
      id: newId(), title: autoTitle(fileSegs, f.name.replace(/\.[^.]+$/, "")), created: Date.now(), duration: pcm.length / SR,
      lang: settings.lang, model: settings.model, device: engine.info?.device ?? device,
      procMs: (engine.info?.procMs ?? 0) - procBefore, segments: fileSegs, audio: f.size < 200e6 ? f : toWav(pcm), source: "file",
    };
    await saveNote(note);
    awake();
    busy = ""; fileSegs = [];
    void cue("done");
    go(`#/note/${note.id}`);
  } catch (e) {
    awake();
    busy = ""; fileSegs = [];
    void cue("error");
    toast(`${t("error")}: ${e instanceof Error ? e.message : e}`);
    render();
  }
}

// ---------- library ----------
function libraryView(full: boolean): HTMLElement {
  const listEl = h("ol", { class: "notes" });
  const fill = () => {
    const found = search(notes, libraryQuery);
    const current = route().id;
    listEl.replaceChildren(...(found.length ? found.map(({ note, snippet }) =>
      h("li", {}, h("a", { href: `#/note/${note.id}`, class: note.id === current ? "on" : "" },
        h("span", { class: "n-title" }, note.title),
        h("span", { class: "n-meta" }, `${new Date(note.created).toLocaleDateString(locale(), { day: "numeric", month: "short" })} · ${clock(note.duration)}`),
        snippet && h("span", { class: "n-snip" }, snippet)))) :
      [h("li", { class: "none" }, libraryQuery ? "—" : t("noNotes"))]));
  };
  fill();
  const input = h("input", { type: "search", placeholder: t("search"), value: libraryQuery, "aria-label": t("search"),
    oninput: (e: Event) => { libraryQuery = (e.target as HTMLInputElement).value; fill(); } });
  return h("section", { class: "library" + (full ? " full" : "") },
    full && h("h1", { class: "page-h" }, t("library")),
    h("div", { class: "lib-head" }, !full && h("h2", {}, t("library"), h("small", {}, ` ${notes.length}`)), input),
    listEl);
}

// ---------- note ----------
function noteView(n: Note): HTMLElement {
  const text = n.segments.map((s) => s.text).join(" ");
  const hl = highlights(text, 3);
  const kw = keywords(text, 6);
  const audioUrl = n.audio ? URL.createObjectURL(n.audio) : "";
  const player = h("audio", { controls: true, src: audioUrl || undefined, preload: "metadata" }) as HTMLAudioElement;
  const segEls: [Segment, HTMLElement][] = [];
  const paras = paragraphs(n.segments).map((p) => h("p", {},
    h("button", { class: "stamp", onclick: () => seek(p[0].start) }, clock(p[0].start)), " ",
    ...p.flatMap((s) => { const el = h("span", { class: "seg", onclick: () => seek(s.start) }, s.text + " "); segEls.push([s, el]); return [el]; })));
  function seek(sec: number) { if (!audioUrl) return; player.currentTime = sec; player.play().catch(() => {}); }
  player.addEventListener("timeupdate", () => {
    const ct = player.currentTime;
    for (const [s, el] of segEls) el.classList.toggle("now", ct >= s.start && ct < s.end);
  });

  const title = h("h1", { class: "note-title", contenteditable: "plaintext-only", spellcheck: "false", title: t("rename") }, n.title);
  title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); title.blur(); } });
  title.addEventListener("blur", async () => {
    const v = title.textContent?.trim();
    if (v && v !== n.title) { n.title = v; await saveNote(n); notes = await listNotes(); }
  });

  const date = new Date(n.created).toLocaleString(locale(), { dateStyle: "long", timeStyle: "short" });
  const base = n.title.replace(/[\\/:*?"<>|]+/g, "").slice(0, 60) || "katip";
  const exp = (ext: string, body: string, mime: string) => h("button", { class: "btn ghost sm", onclick: () => download(`${base}.${ext}`, body, mime) }, ext.toUpperCase());
  const md = () => toMarkdown(n.title, date, n.segments, hl, kw);
  const words = text.split(/\s+/).filter(Boolean).length;
  const rtf = n.duration ? n.procMs / 1000 / n.duration : 0;

  return h("section", { class: "note" },
    h("a", { class: "back", href: "#/notes" }, icon("back"), t("library")),
    h("header", { class: "note-head" },
      title,
      h("p", { class: "meta" }, `${date} · ${clock(n.duration)} · ${words} ${t("words")} · ${n.source === "mic" ? t("fromMic") : t("fromFile")}`),
      audioUrl ? player : null),
    h("div", { class: "note-grid" },
      h("article", { class: "paper transcript" }, h("h2", { class: "label" }, t("transcript")), ...paras),
      h("aside", { class: "note-side" },
        kw.length ? h("div", { class: "card" }, h("h2", { class: "label" }, t("keywords")), h("div", { class: "kws" }, ...kw.map((k) => h("span", { class: "kw" }, k)))) : null,
        hl.length ? h("div", { class: "card" }, h("h2", { class: "label" }, t("highlights")), h("ol", { class: "hls" }, ...hl.map((s) => h("li", {}, s)))) : null,
        h("div", { class: "card" }, h("h2", { class: "label" }, t("exportAs")),
          h("div", { class: "exports" },
            exp("txt", toTxt(n.segments), "text/plain"), exp("md", md(), "text/markdown"),
            exp("srt", toSrt(n.segments), "application/x-subrip"), exp("vtt", toVtt(n.segments), "text/vtt")),
          h("div", { class: "exports" },
            h("button", { class: "btn ghost sm", onclick: async (e: Event) => { await navigator.clipboard.writeText(toTxt(n.segments)); (e.currentTarget as HTMLElement).lastChild!.textContent = t("copied"); } }, icon("copy"), h("span", {}, t("copy"))),
            "share" in navigator && h("button", { class: "btn ghost sm", onclick: () => shareNote(n, md()) }, icon("share"), t("share")),
            h("button", { class: "btn ghost sm danger", onclick: async () => { if (confirm(t("confirmDel"))) { await deleteNote(n.id); go("#/notes"); } } }, icon("trash"), t("del")))),
        h("details", { class: "card how" },
          h("summary", { class: "label" }, t("how")),
          h("p", {}, t("howText")),
          h("dl", {},
            h("dt", {}, t("sent")), h("dd", {}, h("b", {}, t("bytes"))),
            h("dt", {}, t("model")), h("dd", {}, `whisper-${n.model}`),
            h("dt", {}, t("engine")), h("dd", {}, n.device === "webgpu" ? t("gpu") : t("cpu")),
            h("dt", {}, t("speed")), h("dd", {}, rtf ? `${(1 / rtf).toFixed(1)}${t("rtf")}` : "—"))))));
}

function download(name: string, body: string, mime: string) {
  const url = URL.createObjectURL(new Blob([body], { type: `${mime};charset=utf-8` }));
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function shareNote(n: Note, md: string) {
  const file = new File([md], `${n.title.slice(0, 40)}.md`, { type: "text/markdown" });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: n.title, files: [file] });
    else await navigator.share({ title: n.title, text: toTxt(n.segments) });
  } catch { /* cancelled */ }
}

// ---------- settings ----------
function settingsView(): HTMLElement {
  const radio = <T extends string>(name: string, value: T, current: T, label: string, set: (v: T) => void) =>
    h("label", { class: "opt" }, h("input", { type: "radio", name, value, checked: current === value, onchange: () => { set(value); saveSettings(); render(); } }), h("span", {}, label));
  const storage = h("p", { class: "muted" }, "…");
  (async () => {
    const bytes = await modelCacheBytes().catch(() => 0);
    const est = await (navigator.storage?.estimate?.() ?? Promise.resolve(undefined)).catch(() => undefined);
    storage.textContent = `${notes.length} ${t("notesCount")} · ${(bytes / 1e6).toFixed(0)} MB ${t("modelsCached")}` + (est?.quota ? ` · ${((est.usage ?? 0) / 1e6).toFixed(0)} / ${(est.quota / 1e9).toFixed(1)} GB` : "");
  })();
  return h("section", { class: "settings" },
    h("h1", { class: "page-h" }, t("settings")),
    h("div", { class: "card" }, h("h2", { class: "label" }, t("language")),
      h("div", { class: "opts" }, radio("lang", "tr", settings.lang, "Türkçe", (v) => (settings.lang = v)), radio("lang", "en", settings.lang, "English", (v) => (settings.lang = v)), radio("lang", "auto", settings.lang, t("auto"), (v) => (settings.lang = v)))),
    h("div", { class: "card" }, h("h2", { class: "label" }, t("modelSize")),
      h("div", { class: "opts col" }, ...(["tiny", "base", "small"] as const).map((m) => radio("model", m, settings.model, t(m), (v) => (settings.model = v))))),
    h("div", { class: "card" }, h("h2", { class: "label" }, t("theme")),
      h("div", { class: "opts" }, ...(["system", "light", "dark"] as const).map((m) => radio("theme", m, settings.theme, t(m), (v) => { settings.theme = v; applyTheme(); })))),
    h("div", { class: "card" }, h("h2", { class: "label" }, t("uiLang")),
      h("div", { class: "opts" }, radio("ui", "tr", settings.ui, "Türkçe", (v) => { settings.ui = v; setLang(v); }), radio("ui", "en", settings.ui, "English", (v) => { settings.ui = v; setLang(v); }))),
    h("div", { class: "card" }, h("h2", { class: "label" }, t("storage")), storage,
      h("button", { class: "btn ghost sm", onclick: async (e: Event) => { await clearModelCache(); (e.currentTarget as HTMLElement).textContent = t("cleared"); } }, icon("trash"), t("clearModels"))),
    h("div", { class: "card" }, h("h2", { class: "label" }, t("privacy")), h("p", {}, t("howText"))),
    h("p", { class: "muted small" }, "Kâtip · MIT · ", h("a", { href: "https://github.com/numanak-b221210105/katip" }, "GitHub")));
}

// ---------- misc ----------
function toast(msg: string) {
  const el = h("div", { class: "toast", role: "status" }, msg);
  document.body.append(el);
  setTimeout(() => el.classList.add("out"), 4200);
  setTimeout(() => el.remove(), 4800);
}
window.addEventListener("offline", () => toast(t("offline")));
window.addEventListener("beforeunload", (e) => { if (session || busy) e.preventDefault(); });

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
installHint({ app: "Kâtip", lang: getLang, accent: "#c2412d", bottom: matchMedia("(max-width: 899px)").matches ? 78 : 16 });

// Android share sheet: an audio file shared to Kâtip (e.g. a voice message) arrives
// through the service worker and is transcribed right away.
async function takeShared() {
  if (!location.hash.includes("shared=1")) return;
  history.replaceState(null, "", location.pathname + "#/");
  try {
    const key = new URL("./shared-audio", document.baseURI).href;
    const c = await caches.open("katip-share");
    const r = await c.match(key);
    if (!r) return;
    await c.delete(key);
    const name = decodeURIComponent(r.headers.get("x-name") || "audio");
    const blob = await r.blob();
    await importFile(new File([blob], name, { type: blob.type || r.headers.get("content-type") || "audio/ogg" }));
  } catch (e) {
    toast(`${t("error")}: ${e instanceof Error ? e.message : e}`);
  }
}
render().then(takeShared);
