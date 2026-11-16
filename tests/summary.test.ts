import { describe, expect, it } from "vitest";
import { highlights, keywords, sentences, stem } from "../src/summary";

const text = "Bugünkü toplantıda bütçe planını konuştuk. Pazarlama bütçesi yüzde on artacak. Toplantının sonunda yeni ürün takvimini belirledik. Hava çok güzeldi. Bütçe onayı için finans ekibine sunum yapılacak. Ürün takvimi mart ayında kesinleşecek.";

describe("summary", () => {
  it("splits Turkish sentences", () => {
    expect(sentences(text).length).toBe(6);
  });
  it("stems common suffixes", () => {
    expect(stem("toplantının")).toBe(stem("toplantı"));
    expect(stem("bütçesi")).toBe(stem("bütçe"));
    expect(stem("takvimini")).toBe(stem("takvimi"));
  });
  it("finds the recurring topics as keywords", () => {
    const k = keywords(text);
    expect(k.some((w) => w.startsWith("bütçe"))).toBe(true);
    expect(k.some((w) => w.startsWith("takvim"))).toBe(true);
    expect(k).not.toContain("çok");
  });
  it("picks topical sentences in original order and skips small talk", () => {
    const h = highlights(text, 3);
    expect(h.length).toBe(3);
    expect(h).not.toContain("Hava çok güzeldi.");
    expect(sentences(text).indexOf(h[0])).toBeLessThan(sentences(text).indexOf(h[2]));
  });
});
