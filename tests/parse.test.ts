import { describe, expect, it } from "vitest";
import { extractSections, kindFromName } from "@/lib/parse";
import { makeDocx, makePdf, makePptx } from "./fixtures";

describe("file parsing", () => {
  it("detects kinds", () => {
    expect(kindFromName("Lecture 3.PDF")).toBe("pdf");
    expect(kindFromName("slides.pptx")).toBe("pptx");
    expect(kindFromName("notes.docx")).toBe("docx");
    expect(kindFromName("notes.md")).toBe("text");
    expect(kindFromName("old.ppt")).toBeNull();
  });

  it("extracts PDF text per page", async () => {
    const data = await makePdf(["Routing basics\nRouters forward packets using IP addresses.", "Switching\nSwitches use MAC addresses."]);
    const s = await extractSections("pdf", data);
    expect(s.map((x) => x.label)).toEqual(["Page 1", "Page 2"]);
    expect(s[1].text).toContain("MAC addresses");
  });

  it("extracts PPTX text per slide, in order, with speaker notes", async () => {
    const data = await makePptx([
      { title: "TCP", body: "TCP uses a three-way handshake & retransmission." },
      { title: "UDP", body: "UDP is connectionless.", notes: "Mention DNS and VoIP." },
    ]);
    const s = await extractSections("pptx", data);
    expect(s.map((x) => x.label)).toEqual(["Slide 1", "Slide 2"]);
    expect(s[0].text).toContain("three-way handshake & retransmission");
    expect(s[1].text).toContain("Mention DNS and VoIP");
  });

  it("extracts DOCX text grouped by headings", async () => {
    const data = await makeDocx([
      { heading: "Subnetting", paragraphs: ["Usable hosts are 2^h − 2.", "The broadcast address is the last address."] },
      { heading: "NAT", paragraphs: ["Private addresses need NAT to reach the internet."] },
    ]);
    const s = await extractSections("docx", data);
    expect(s.map((x) => x.label)).toEqual(["Section: Subnetting", "Section: NAT"]);
    expect(s[0].text).toContain("broadcast address");
  });
});
