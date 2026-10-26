/** Tiny, safe renderer for the traps sheet: ## headings, - lists, **bold**, paragraphs. */
function inline(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={`${key}-${i}`} className="font-semibold">{p.slice(2, -2)}</strong> : <span key={`${key}-${i}`}>{p}</span>,
  );
}

export function Markdown({ source }: { source: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      const items = list;
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="space-y-2 mb-6">
          {items.map((l, i) => (
            <li key={i} className="pl-4 border-l-2 border-line">{inline(l, `li-${blocks.length}-${i}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (/^[-*]\s+/.test(line)) list.push(line.replace(/^[-*]\s+/, ""));
    else if (/^#{1,3}\s+/.test(line)) {
      flush();
      blocks.push(<h2 key={`h-${blocks.length}`} className="text-lg font-semibold mt-2 mb-3">{line.replace(/^#+\s+/, "")}</h2>);
    } else if (line) {
      flush();
      blocks.push(<p key={`p-${blocks.length}`} className="mb-4">{inline(line, `p-${blocks.length}`)}</p>);
    } else flush();
  }
  flush();
  return <div>{blocks}</div>;
}
