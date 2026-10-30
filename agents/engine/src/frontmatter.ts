// Obsidian notes = YAML frontmatter + markdown body. We keep frontmatter flat
// (scalars and lists) and write non-trivial values in JSON flow style, which
// is valid YAML, so Obsidian shows them as properties and we parse them back exactly.

export type Data = Record<string, unknown>;

const plain = /^[A-Za-z0-9_][A-Za-z0-9_ .\-/:@+]*$/;

function encode(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") {
    const looksTyped = /^(true|false|null|-?\d+(\.\d+)?)$/.test(v) || v.includes(": ") || v.endsWith(":");
    return plain.test(v) && !looksTyped ? v : JSON.stringify(v);
  }
  return JSON.stringify(v);
}

export function serialize(data: Data, body: string): string {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${encode(v)}`);
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}

export function parse(text: string): { data: Data; body: string } {
  const t = text.replace(/\r\n/g, "\n");
  const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: t };
  const data: Data = {};
  let listKey: string | null = null;
  for (const line of m[1].split("\n")) {
    // YAML block lists ("key:" then "  - item"), as Obsidian writes them
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      (data[listKey] as unknown[]).push(decode(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    if (kv[2] === "") {
      listKey = kv[1];
      data[kv[1]] = [];
      continue;
    }
    listKey = null;
    data[kv[1]] = decode(kv[2]);
  }
  return { data, body: m[2].trim() };
}

function decode(raw: string): unknown {
  const v = raw.trim();
  try {
    return JSON.parse(v);
  } catch {
    if (v.startsWith("[") && v.endsWith("]"))
      return v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    return v.replace(/^'(.*)'$/, "$1");
  }
}
