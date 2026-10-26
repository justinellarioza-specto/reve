// Builds real PDF / PPTX / DOCX files in memory so parsing is tested end to end.
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import PptxGenJS from "pptxgenjs";
import { PDFDocument, StandardFonts } from "pdf-lib";

export async function makePdf(pages: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = pdf.addPage([595, 842]);
    text.split("\n").forEach((line, i) => page.drawText(line, { x: 50, y: 780 - i * 18, size: 12, font }));
  }
  return pdf.save();
}

export async function makePptx(slides: { title: string; body: string; notes?: string }[]): Promise<Uint8Array> {
  const p = new PptxGenJS();
  for (const s of slides) {
    const slide = p.addSlide();
    slide.addText(s.title, { x: 0.5, y: 0.3, w: 9, h: 1, fontSize: 28 });
    slide.addText(s.body, { x: 0.5, y: 1.5, w: 9, h: 3, fontSize: 16 });
    if (s.notes) slide.addNotes(s.notes);
  }
  const buf = (await p.write({ outputType: "nodebuffer" })) as Buffer;
  return new Uint8Array(buf);
}

export async function makeDocx(sections: { heading: string; paragraphs: string[] }[]): Promise<Uint8Array> {
  const doc = new Document({
    sections: [
      {
        children: sections.flatMap((s) => [
          new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_1 }),
          ...s.paragraphs.map((t) => new Paragraph({ text: t })),
        ]),
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
