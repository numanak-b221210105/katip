import { describe, expect, it } from "vitest";
import { clock, paragraphs, toMarkdown, toSrt, toTxt, toVtt } from "../src/format";

const segs = [
  { start: 0, end: 2.5, text: " Merhaba arkadaşlar." },
  { start: 2.5, end: 61.04, text: "Bugün bütçeyi konuşacağız." },
  { start: 64, end: 3725.5, text: "Teşekkürler." },
];

describe("formats", () => {
  it("clock", () => {
    expect(clock(75.5)).toBe("01:15");
    expect(clock(3725)).toBe("1:02:05");
  });
  it("SRT uses comma milliseconds and 1-based cues", () => {
    expect(toSrt(segs)).toBe("1\n00:00:00,000 --> 00:00:02,500\nMerhaba arkadaşlar.\n\n2\n00:00:02,500 --> 00:01:01,040\nBugün bütçeyi konuşacağız.\n\n3\n00:01:04,000 --> 01:02:05,500\nTeşekkürler.\n");
  });
  it("VTT has a header and dot milliseconds", () => {
    expect(toVtt(segs).startsWith("WEBVTT\n\n00:00:00.000 --> 00:00:02.500\n")).toBe(true);
  });
  it("paragraphs break at long pauses", () => {
    expect(paragraphs(segs).length).toBe(2);
    expect(toTxt(segs)).toBe("Merhaba arkadaşlar. Bugün bütçeyi konuşacağız.\n\nTeşekkürler.\n");
  });
  it("markdown includes title, highlights and time marks", () => {
    const md = toMarkdown("Toplantı", "16 Kasım 2026", segs, ["Bugün bütçeyi konuşacağız."], ["bütçe"]);
    expect(md).toContain("# Toplantı");
    expect(md).toContain("> Bugün bütçeyi konuşacağız.");
    expect(md).toContain("**[00:00]** Merhaba arkadaşlar.");
  });
});
