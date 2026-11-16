import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { autoTitle, deleteNote, getNote, listNotes, newId, saveNote, search, type Note } from "../src/store";

const note = (title: string, text: string, created: number): Note => ({ id: newId(), title, created, duration: 10, lang: "tr", model: "base", device: "wasm", procMs: 5000, source: "mic", segments: [{ start: 0, end: 10, text }] });

describe("notes store", () => {
  it("saves, lists newest first, and deletes", async () => {
    const a = await saveNote(note("A", "birinci not", 1));
    const b = await saveNote(note("B", "ikinci not", 2));
    expect((await listNotes()).map((n) => n.title)).toEqual(["B", "A"]);
    expect((await getNote(a.id))?.title).toBe("A");
    await deleteNote(b.id);
    expect((await listNotes()).length).toBe(1);
  });
  it("searches transcripts with Turkish case rules", () => {
    const notes = [note("Toplantı", "İstanbul ofisinde bütçe görüşüldü", 1), note("Ders", "Bugün türev konusu işlendi", 2)];
    const r = search(notes, "istanbul");
    expect(r.length).toBe(1);
    expect(r[0].snippet).toContain("İstanbul");
  });
  it("makes a title from the first words", () => {
    expect(autoTitle([{ start: 0, end: 1, text: "Bugün pazarlama bütçesini ve yeni ürün takvimini konuştuk. Sonra" }], "Not")).toBe("Bugün pazarlama bütçesini ve yeni ürün takvimini…");
    expect(autoTitle([], "Yeni not")).toBe("Yeni not");
  });
});
