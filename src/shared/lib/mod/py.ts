// What the engine's Python does with values, done the same way here: a
// string's repr (the engine's messages quote values with it), json.dumps (a
// package's size is counted on it, its hash is taken of it), and Python's
// equality where the engine compares a value with a constant.

// (what str.isprintable() refuses besides the ASCII controls: other separators, format characters)
const UNPRINTABLE = /[\p{Zs}\p{Zl}\p{Zp}\p{Cf}\p{Co}\p{Cn}\p{Cs}]/u;

/** Python's repr() of a string: 'abc', "it's", 'a\nb' */
export function py_repr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === quote || ch === '\\') out += '\\' + ch;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20 || (c >= 0x7f && c <= 0xa0) || c === 0xad) out += '\\x' + c.toString(16).padStart(2, '0');
    else if (ch !== ' ' && UNPRINTABLE.test(ch)) out += c > 0xffff ? '\\U' + c.toString(16).padStart(8, '0') : '\\u' + c.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + quote;
}

/** a string's length as Python counts it (code points, not UTF-16 units) */
export function py_len(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/** how Python writes a number that came from JSON (ints stay ints; floats as repr()) */
export function py_number(x: number): string {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? 'NaN' : x > 0 ? 'Infinity' : '-Infinity';
  if (Number.isInteger(x) && Math.abs(x) < 1e21) return String(x === 0 ? 0 : x);
  const [m, e] = x.toExponential().split('e');
  const exp = Number(e);
  if (exp < -4 || exp >= 16) return `${m}e${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  return String(x);
}

function sorted_keys(o: Record<string, unknown>): string[] {
  return Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** json.dumps(v, ensure_ascii=False): `compact` uses (",", ":") as separators, `sort` sorts the keys */
export function py_dumps(v: unknown, opts: { compact?: boolean; sort?: boolean } = {}): string {
  const comma = opts.compact ? ',' : ', ';
  const colon = opts.compact ? ':' : ': ';
  const walk = (x: unknown): string => {
    if (x === null || x === undefined) return 'null';
    if (x === true) return 'true';
    if (x === false) return 'false';
    if (typeof x === 'number') return py_number(x);
    if (typeof x === 'string') return JSON.stringify(x);
    if (Array.isArray(x)) return '[' + x.map(walk).join(comma) + ']';
    if (typeof x === 'object') {
      const o = x as Record<string, unknown>;
      const keys = opts.sort ? sorted_keys(o) : Object.keys(o);
      return '{' + keys.filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + colon + walk(o[k])).join(comma) + '}';
    }
    return 'null';
  };
  return walk(v);
}

const encoder = new TextEncoder();

/** the UTF-8 size of a string */
export function utf8_size(s: string): number {
  return encoder.encode(s).length;
}

/** Python's == between a JSON value and a constant (True == 1, 1.0 == 1) */
export function py_eq(a: unknown, b: unknown): boolean {
  const num = (v: unknown) => (typeof v === 'boolean' ? Number(v) : v);
  return num(a) === num(b);
}

export const is_object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
