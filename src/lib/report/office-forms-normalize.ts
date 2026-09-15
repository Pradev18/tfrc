/** Office Forms report — item codes stay strings (no float / scientific notation). */

export function normalizeItemCode(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel may store codes as numbers — rebuild without scientific notation.
    if (Number.isInteger(value)) return String(value);
    const asInt = Math.round(value);
    if (Math.abs(value - asInt) < 1e-9) return String(asInt);
    return String(value);
  }
  let text = String(value).trim();
  if (!text) return "";
  // Strip wrapping quotes Excel sometimes adds
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  // Numeric string that Excel may have turned into 1.1e+11
  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(text)) {
    try {
      const n = Number(text);
      if (Number.isFinite(n) && Number.isInteger(n)) return String(n);
    } catch {
      // keep original
    }
  }
  if (/^\d+\.0+$/.test(text)) return text.replace(/\.0+$/, "");
  return text;
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");
}

export function headersInclude(headers: string[], ...needles: string[]): boolean {
  const normalized = headers.map(normalizeHeader);
  return needles.every((needle) =>
    normalized.some((h) => h === needle || h.includes(needle))
  );
}

export function findHeaderIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  // Exact match first (unambiguous).
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const exact = normalized.findIndex((h) => h === target);
    if (exact >= 0) return exact;
  }
  // Controlled soft match only for multi-word aliases (or long tokens).
  // Short single-token aliases must be exact to avoid wrong-column mapping.
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const isMultiWord = target.includes(" ");
    if (!isMultiWord && target.length < 8) continue;
    if (target.length < 4) continue;
    const soft = normalized.findIndex((h) => {
      if (h === target) return true;
      // Phrase containment with word boundaries.
      const re = new RegExp(`(?:^|\\s)${escapeRegExp(target)}(?:\\s|$)`);
      return re.test(h);
    });
    if (soft >= 0) return soft;
  }
  return -1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
