import "server-only";
import JSZip from "jszip";
import { clean, sectionsFromText, type Section } from "../text";

export type DocKind = "pdf" | "pptx" | "docx" | "text";

export function kindFromName(name: string, mime = ""): DocKind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "pptx") return "pptx";
  if (ext === "docx") return "docx";
  if (["txt", "md", "markdown"].includes(ext) || mime.startsWith("text/")) return "text";
  return null;
}

/** Extract citable sections from an uploaded file. */
export async function extractSections(kind: DocKind, data: Uint8Array): Promise<Section[]> {
  switch (kind) {
    case "pdf":
      return extractPdf(data);
    case "pptx":
      return extractPptx(data);
    case "docx":
      return extractDocx(data);
    case "text":
      return sectionsFromText(new TextDecoder().decode(data));
  }
}

async function extractPdf(data: Uint8Array): Promise<Section[]> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[])
    .map((t, i) => ({ label: `Page ${i + 1}`, text: clean(t) }))
    .filter((s) => s.text.length > 0);
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&");

/** Pull text runs out of slide XML, one line per paragraph. */
function slideXmlToText(xml: string): string {
  return xml
    .split(/<\/a:p>/)
    .map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(""))
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

async function extractPptx(data: Uint8Array): Promise<Section[]> {
  const zip = await JSZip.loadAsync(data);
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => +a.match(/(\d+)\.xml/)![1] - +b.match(/(\d+)\.xml/)![1]);
  const out: Section[] = [];
  for (const f of slideFiles) {
    const n = +f.match(/(\d+)\.xml/)![1];
    let text = slideXmlToText(await zip.file(f)!.async("string"));
    const notes = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
    if (notes) {
      const nt = slideXmlToText(await notes.async("string")).replace(/^\d+$/m, "").trim();
      if (nt) text += `\n(Speaker notes) ${nt}`;
    }
    if (text.trim()) out.push({ label: `Slide ${n}`, text: clean(text) });
  }
  return out;
}

async function extractDocx(data: Uint8Array): Promise<Section[]> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(data) });
  // Turn headings into section breaks so citations can point at "Section: <heading>".
  const md = html
    .replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/g, (_, h) => `\n# ${strip(h)}\n`)
    .replace(/<li[^>]*>(.*?)<\/li>/g, (_, li) => `\n- ${strip(li)}`)
    .replace(/<\/p>/g, "\n\n")
    .replace(/<[^>]+>/g, "");
  return sectionsFromText(decodeXml(md), "Paragraph");
}

const strip = (s: string) => decodeXml(s.replace(/<[^>]+>/g, "")).trim();
