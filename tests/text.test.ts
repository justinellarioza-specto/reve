import { describe, expect, it } from "vitest";
import { answerMatches, chunkSections, cosine, lexicalEmbedding, sectionsFromText } from "@/lib/text";

describe("text utilities", () => {
  it("splits pasted notes by headings", () => {
    const s = sectionsFromText("# Routing\nRouters forward packets.\n\n# Switching\nSwitches forward frames by MAC address.");
    expect(s.map((x) => x.label)).toEqual(["Section: Routing", "Section: Switching"]);
  });
  it("treats Title Case lines as headings but not sentences", () => {
    const s = sectionsFromText("Network Layer\nRouters work here and use IP.\nThis is a sentence\nmore text.");
    expect(s[0].label).toBe("Section: Network Layer");
    expect(s).toHaveLength(1);
  });
  it("chunks long sections and keeps the label", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} talks about routing tables.`).join(" ");
    const c = chunkSections([{ label: "Page 3", text: long }], 300);
    expect(c.length).toBeGreaterThan(3);
    expect(c.every((x) => x.label === "Page 3" && x.text.length <= 360)).toBe(true);
  });
  it("lexical embeddings rank related text higher", () => {
    const q = lexicalEmbedding("what does a router do with IP addresses");
    const a = lexicalEmbedding("Routers operate at the Network layer and route using IP addresses.");
    const b = lexicalEmbedding("UDP has an 8-byte header and is connectionless.");
    expect(cosine(q, a)).toBeGreaterThan(cosine(q, b));
  });
  it("accepts close typed answers", () => {
    expect(answerMatches("Segment", ["segment"])).toBe(true);
    expect(answerMatches("segmnt", ["segment"])).toBe(true);
    expect(answerMatches("packet", ["segment"])).toBe(false);
    expect(answerMatches("443", ["443"])).toBe(true);
    expect(answerMatches("", ["x"])).toBe(false);
  });
});
