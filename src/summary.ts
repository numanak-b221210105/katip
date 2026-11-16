// Extractive highlights and keywords, computed on the device without a model.
// Sentences are scored by how many frequent content words they contain
// (a light TF-IDF over the transcript itself), favouring early, mid-length sentences.

const STOP_TR = new Set(("bugün bugünkü yarın dün şimdi şey şeyi evet hayır tamam acaba ama ancak artık aslında az bana bazı belki ben beni benim bile bir biraz birçok birkaç biri birisi birşey biz bize bizi bizim bu buna bunda bundan bunu bunun burada böyle çok çünkü da daha dahi de değil diğer diye dolayı en fakat gibi göre hem hep hepsi her hiç için ile ise işte kadar ki kim kimse mi mı mu mü nasıl ne neden nerede nereye niye o ona onda ondan onu onun orada öyle şey şimdi şu şuna şunda şundan şunu siz size sizi sizin tabii tüm var ve veya ya yani yine yok zaten olarak olan olur oldu olduğu olsun ayrıca sonra önce evet hayır tamam yani işte şöyle böylece biraz bile hatta kendi").split(" "));
const STOP_EN = new Set(("a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with you your yeah okay like know think going really right well").split(" "));

const words = (s: string) => s.toLocaleLowerCase("tr").match(/[\p{L}\p{N}]+/gu) ?? [];
/** Turkish stemming by truncation ("F5"): the first five letters are a strong stem
 *  for an agglutinative language, so "toplantı", "toplantıda", "toplantının" all match. */
export function stem(w: string): string {
  return w.length <= 5 ? w : w.slice(0, 5);
}

export function sentences(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?…])\s+(?=[\p{Lu}\d"“'])/u).map((s) => s.trim()).filter((s) => s.length > 2);
}

export function keywords(text: string, n = 6): string[] {
  const freq = new Map<string, { count: number; forms: Map<string, number> }>();
  for (const w of words(text)) {
    if (w.length < 3 || STOP_TR.has(w) || STOP_EN.has(w) || /^\d+$/.test(w)) continue;
    const k = stem(w);
    const e = freq.get(k) ?? { count: 0, forms: new Map() };
    e.count++;
    e.forms.set(w, (e.forms.get(w) ?? 0) + 1);
    freq.set(k, e);
  }
  return [...freq.values()]
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((e) => [...e.forms.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0]);
}

export function highlights(text: string, n = 3): string[] {
  const sents = sentences(text);
  if (sents.length <= n) return sents.filter((s) => words(s).length >= 4);
  const freq = new Map<string, number>();
  for (const w of words(text)) if (w.length >= 3 && !STOP_TR.has(w) && !STOP_EN.has(w)) freq.set(stem(w), (freq.get(stem(w)) ?? 0) + 1);
  const scored = sents.map((s, i) => {
    const ws = words(s);
    const content = ws.filter((w) => w.length >= 3 && !STOP_TR.has(w) && !STOP_EN.has(w));
    const score = content.reduce((a, w) => a + Math.log(1 + (freq.get(stem(w)) ?? 0)), 0) / Math.sqrt(Math.max(4, ws.length));
    const lenOk = ws.length >= 6 && ws.length <= 40 ? 1 : 0.5;
    return { s, i, score: score * lenOk * (1 - (i / sents.length) * 0.15) };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
}
