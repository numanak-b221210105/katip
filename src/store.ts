// Notes live in IndexedDB on the device: audio, transcript and stats.
import type { Segment } from "./format";

export interface Note {
  id: string;
  title: string;
  created: number;
  duration: number;
  lang: string;
  model: string;
  device: string;
  procMs: number;
  segments: Segment[];
  audio?: Blob;
  source: "mic" | "file";
}

const DB = "katip", STORE = "notes";
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" }).createIndex("created", "created");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((res, rej) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}
export const saveNote = (n: Note) => tx("readwrite", (s) => s.put(n)).then(() => n);
export const getNote = (id: string) => tx<Note | undefined>("readonly", (s) => s.get(id));
export const deleteNote = (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => undefined);
export async function listNotes(): Promise<Note[]> {
  const all = await tx<Note[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.created - a.created);
}
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Title from the first words of the transcript. */
export function autoTitle(segs: Segment[], fallback: string): string {
  const text = segs.map((s) => s.text).join(" ").trim();
  if (!text) return fallback;
  const first = text.split(/(?<=[.!?])\s/)[0];
  const w = first.split(/\s+/).slice(0, 7).join(" ");
  return w.length < first.length ? w.replace(/[,;:]$/, "") + "…" : w.replace(/[.!?]$/, "");
}

/** Plain-text search across notes: returns notes and the first matching snippet. */
export function search(notes: Note[], q: string): { note: Note; snippet: string }[] {
  const needle = q.toLocaleLowerCase("tr").trim();
  if (!needle) return notes.map((note) => ({ note, snippet: "" }));
  const out: { note: Note; snippet: string }[] = [];
  for (const note of notes) {
    const text = note.segments.map((s) => s.text).join(" ");
    const hay = text.toLocaleLowerCase("tr");
    const i = hay.indexOf(needle);
    if (i >= 0 || note.title.toLocaleLowerCase("tr").includes(needle)) {
      out.push({ note, snippet: i >= 0 ? "…" + text.slice(Math.max(0, i - 40), i + needle.length + 60) + "…" : "" });
    }
  }
  return out;
}
