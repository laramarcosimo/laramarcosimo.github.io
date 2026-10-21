export interface ParsedItem {
  name: string;
  qty: number;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Interpreta una línea de la lista: «2 yogures», «huevos x6», «leche (3)», «500 g de arroz». */
export function parseLine(raw: string): ParsedItem | null {
  let t = raw.replace(/^[\s•·\-–*○◦☐☑✓✔☐☑]+/, '').replace(/^\(?\s*[xX ]?\s*\)\s*/, '').trim();
  if (!t) return null;
  let qty = 1;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d+)\s*[x×]?\s+(?!(?:g|gr|kg|ml|l|cl)\b)(.+)$/i))) {
    qty = Number(m[1]);
    t = m[2];
  } else if ((m = t.match(/^(.+?)\s*[x×]\s*(\d+)$/i))) {
    t = m[1];
    qty = Number(m[2]);
  } else if ((m = t.match(/^(.+?)\s*\((\d+)\)$/))) {
    t = m[1];
    qty = Number(m[2]);
  } else if ((m = t.match(/^\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|l|cl)\b\s*(?:de\s+)?(.+)$/i))) {
    t = m[1];
  }
  t = t.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 60) return null;
  return { name: cap(t), qty: Math.min(Math.max(1, qty), 99) };
}

/** Lista pegada (una línea por producto; también separa por «|» y «;»). Une duplicados. */
export function parseList(text: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const line of text.split(/[\n\r|;]+/)) {
    const it = parseLine(line);
    if (!it) continue;
    const hit = out.find((o) => o.name.toLowerCase() === it.name.toLowerCase());
    if (hit) hit.qty += it.qty;
    else out.push(it);
  }
  return out;
}
