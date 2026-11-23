// The expression language of content mods: the twin of BalatroEngine's
// balatro/mods/expr.py (and of the game's src/shared/lib/mod-expr): keep the
// three in step. The engine runs a mod's effects; the editor parses and
// checks what the modder writes (the same errors as the engine, word for
// word) and evaluates it on sample values for its previews.
//
// Grammar (lowest precedence first): or, and, not, a comparison (no chains),
// + -, * / %, unary -, ^ (right), field access (.name), then numbers,
// 'strings', true/false/nil, calls name(args) and names, ( ). As in Lua, only
// false and nil are false, `and`/`or` give an operand, / by zero is inf or
// nan, % is Lua's modulo; a type mismatch gives nil instead of an error.
import type { Msg } from './issues.ts';

export type Node =
  | ['num', number] | ['str', string] | ['const', boolean | null]
  | ['var', string, string[]] | ['field', Node, string] | ['call', string, Node[]]
  | ['and', Node, Node] | ['or', Node, Node] | ['not', Node] | ['neg', Node] | ['bin', string, Node, Node];

export class ExprError extends Error {
  readonly msg: Msg;
  /** where in the source (UTF-16 index) the problem is, when known */
  readonly at: number | null;
  constructor(msg: Msg, at: number | null = null) {
    super(msg.k);
    this.msg = msg;
    this.at = at;
  }
}

export interface Env {
  lookup(root: string, path: string[]): unknown;
  field(value: unknown, name: string): unknown;
  call(name: string, args: unknown[]): unknown;
}

export const MAX_LENGTH = 500;
export const MAX_DEPTH = 32;
export const KEYWORDS = new Set(['and', 'or', 'not', 'true', 'false', 'nil']);
const COMPARE = new Set(['==', '!=', '<', '<=', '>', '>=']);
const TOKEN = /(\s+)|(\d+(?:\.\d+)?)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|[<>+\-*/%^(),.])/y;

export type TokKind = 'num' | 'str' | 'name' | 'kw' | 'op' | 'end';
export interface Tok { kind: TokKind; text: string; start: number; end: number }

/** the code-point position Python reports (1-based) for a UTF-16 index */
function py_at(src: string, at: number) {
  let n = 0;
  for (const _ of src.slice(0, at)) n++;
  return n + 1;
}

export function tokens(src: string): Tok[] {
  const out: Tok[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < src.length) {
    const at = TOKEN.lastIndex;
    const m = TOKEN.exec(src);
    if (!m || m.index !== at) {
      const ch = String.fromCodePoint(src.codePointAt(at)!);
      throw new ExprError({ k: 'x_char', ch, at: py_at(src, at) }, at);
    }
    const end = TOKEN.lastIndex;
    if (m[1] !== undefined) continue;
    if (m[2] !== undefined) out.push({ kind: 'num', text: m[2], start: at, end });
    else if (m[3] !== undefined) out.push({ kind: 'str', text: m[3], start: at, end });
    else if (m[4] !== undefined) out.push({ kind: KEYWORDS.has(m[4]) ? 'kw' : 'name', text: m[4], start: at, end });
    else out.push({ kind: 'op', text: m[5], start: at, end });
  }
  out.push({ kind: 'end', text: '', start: src.length, end: src.length });
  return out;
}

/** the tokens for highlighting: never throws (an unknown character is a token of its own) */
export function highlight_tokens(src: string): { kind: TokKind | 'bad' | 'ws'; text: string; start: number }[] {
  const out: { kind: TokKind | 'bad' | 'ws'; text: string; start: number }[] = [];
  const re = new RegExp(TOKEN.source, 'y');
  let at = 0;
  while (at < src.length) {
    re.lastIndex = at;
    const m = re.exec(src);
    if (!m || m.index !== at) {
      // an unclosed string runs to the end; anything else is one bad character
      const q = src[at];
      if (q === "'" || q === '"') { out.push({ kind: 'str', text: src.slice(at), start: at }); break; }
      const ch = String.fromCodePoint(src.codePointAt(at)!);
      out.push({ kind: 'bad', text: ch, start: at });
      at += ch.length;
      continue;
    }
    const text = m[0];
    const kind: TokKind | 'ws' = m[1] !== undefined ? 'ws' : m[2] !== undefined ? 'num' : m[3] !== undefined ? 'str'
      : m[4] !== undefined ? (KEYWORDS.has(m[4]) ? 'kw' : 'name') : 'op';
    out.push({ kind, text, start: at });
    at = re.lastIndex;
  }
  return out;
}

const unquote = (s: string) => s.slice(1, -1).replace(/\\(.)/g, '$1');

class Parser {
  toks: Tok[];
  i = 0;
  depth = 0;
  constructor(src: string) { this.toks = tokens(src); }
  peek(): Tok { return this.toks[this.i]; }
  take(): Tok { return this.toks[this.i++]; }
  is(kind: TokKind, text: string) { const t = this.peek(); return t.kind === kind && t.text === text; }
  nest() { if (++this.depth > MAX_DEPTH) throw new ExprError({ k: 'x_deep' }, this.peek().start); }
  expect(text: string) {
    const t = this.take();
    if (t.text !== text || (t.kind !== 'op' && t.kind !== 'kw')) throw new ExprError({ k: 'x_expected', want: text, found: t.text }, t.start);
  }
  parse(): Node {
    const n = this.or();
    const t = this.peek();
    if (t.kind !== 'end') throw new ExprError({ k: 'x_unexpected', found: t.text }, t.start);
    return n;
  }
  or(): Node { let n = this.and(); while (this.is('kw', 'or')) { this.take(); n = ['or', n, this.and()]; } return n; }
  and(): Node { let n = this.not(); while (this.is('kw', 'and')) { this.take(); n = ['and', n, this.not()]; } return n; }
  not(): Node {
    if (this.is('kw', 'not')) { this.take(); this.nest(); const n: Node = ['not', this.not()]; this.depth--; return n; }
    return this.compare();
  }
  compare(): Node {
    let n = this.sum();
    const t = this.peek();
    if (t.kind === 'op' && COMPARE.has(t.text)) {
      this.take();
      n = ['bin', t.text, n, this.sum()];
      const t2 = this.peek();
      if (t2.kind === 'op' && COMPARE.has(t2.text)) throw new ExprError({ k: 'x_chain' }, t2.start);
    }
    return n;
  }
  sum(): Node {
    let n = this.product();
    while (this.peek().kind === 'op' && (this.peek().text === '+' || this.peek().text === '-')) { const op = this.take().text; n = ['bin', op, n, this.product()]; }
    return n;
  }
  product(): Node {
    let n = this.unary();
    while (this.peek().kind === 'op' && ['*', '/', '%'].includes(this.peek().text)) { const op = this.take().text; n = ['bin', op, n, this.unary()]; }
    return n;
  }
  unary(): Node {
    if (this.is('op', '-')) { this.take(); this.nest(); const n: Node = ['neg', this.unary()]; this.depth--; return n; }
    return this.power();
  }
  power(): Node {
    let n = this.postfix();
    if (this.is('op', '^')) { this.take(); this.nest(); n = ['bin', '^', n, this.unary()]; this.depth--; }
    return n;
  }
  postfix(): Node {
    let n = this.primary();
    while (this.is('op', '.')) {
      this.take();
      const t = this.take();
      if (t.kind !== 'name') throw new ExprError({ k: 'x_field_name', found: t.text }, t.start);
      n = n[0] === 'var' ? ['var', n[1], [...n[2], t.text]] : ['field', n, t.text];
    }
    return n;
  }
  primary(): Node {
    const t = this.take();
    if (t.kind === 'num') return ['num', Number(t.text)];
    if (t.kind === 'str') return ['str', unquote(t.text)];
    if (t.kind === 'kw' && (t.text === 'true' || t.text === 'false' || t.text === 'nil')) return ['const', t.text === 'nil' ? null : t.text === 'true'];
    if (t.kind === 'name') {
      if (this.is('op', '(')) {
        this.take();
        this.nest();
        const args: Node[] = [];
        if (!this.is('op', ')')) {
          args.push(this.or());
          while (this.is('op', ',')) { this.take(); args.push(this.or()); }
        }
        this.expect(')');
        this.depth--;
        return ['call', t.text, args];
      }
      return ['var', t.text, []];
    }
    if (t.kind === 'op' && t.text === '(') { this.nest(); const n = this.or(); this.expect(')'); this.depth--; return n; }
    throw new ExprError({ k: 'x_unexpected', found: t.text }, t.start);
  }
}

const cache = new Map<string, Node>();

/** The expression's syntax tree (a number or true/false stands for itself); ExprError if it doesn't parse. */
export function parse(src: unknown): Node {
  if (typeof src === 'number') return ['num', src];
  if (typeof src === 'boolean') return ['const', src];
  if (typeof src !== 'string') throw new ExprError({ k: 'x_not_string' });
  const hit = cache.get(src);
  if (hit) return hit;
  let n = 0;
  for (const _ of src) n++;
  if (n > MAX_LENGTH) throw new ExprError({ k: 'x_long', max: MAX_LENGTH });
  if (!src.trim()) throw new ExprError({ k: 'x_empty' });
  const node = new Parser(src).parse();
  if (cache.size > 2000) cache.clear();
  cache.set(src, node);
  return node;
}

// ------------------------------------------------------------------ values
export const truthy = (v: unknown) => v !== null && v !== undefined && v !== false;
const num = (v: unknown): v is number => typeof v === 'number';

function lua_mod(a: number, b: number) { return b === 0 ? NaN : a - Math.floor(a / b) * b; }

function same(a: unknown, b: unknown) {
  if (num(a) && num(b)) return a === b;
  if ((a ?? null) === null && (b ?? null) === null) return true;
  return a === b;
}

function arith(op: string, a: unknown, b: unknown): unknown {
  if (!num(a) || !num(b)) return null;
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '%': return lua_mod(a, b);
    case '^': return Math.pow(a, b);
    default: return null;
  }
}

function compare(op: string, a: unknown, b: unknown): unknown {
  if (op === '==') return same(a, b);
  if (op === '!=') return !same(a, b);
  if (!num(a) || !num(b)) return null;
  return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
}

const nums = (f: (...a: number[]) => number) => (...a: unknown[]) => (a.every(num) ? f(...(a as number[])) : null);

/** name: [min args, max args, function]; pure, the same in the engine and the game */
export const PURE_FUNCTIONS: Record<string, [number, number, (...a: unknown[]) => unknown]> = {
  min: [1, 16, nums(Math.min)],
  max: [1, 16, nums(Math.max)],
  floor: [1, 1, nums(Math.floor)],
  ceil: [1, 1, nums(Math.ceil)],
  abs: [1, 1, nums(Math.abs)],
  round: [1, 1, nums((x) => Math.floor(x + 0.5))],
  clamp: [3, 3, nums((x, lo, hi) => Math.max(lo, Math.min(hi, x)))],
};
export const LAZY_FUNCTIONS: Record<string, [number, number]> = { if: [3, 3] };

export function evaluate(n: Node, env: Env): unknown {
  switch (n[0]) {
    case 'num': case 'str': case 'const': return n[1];
    case 'var': return env.lookup(n[1], n[2]);
    case 'field': { const base = evaluate(n[1], env); return base === null || base === undefined ? null : env.field(base, n[2]); }
    case 'and': { const a = evaluate(n[1], env); return truthy(a) ? evaluate(n[2], env) : a; }
    case 'or': { const a = evaluate(n[1], env); return truthy(a) ? a : evaluate(n[2], env); }
    case 'not': return !truthy(evaluate(n[1], env));
    case 'neg': { const v = evaluate(n[1], env); return num(v) ? -v : null; }
    case 'bin': {
      const a = evaluate(n[2], env), b = evaluate(n[3], env);
      return COMPARE.has(n[1]) ? compare(n[1], a, b) : arith(n[1], a, b);
    }
    case 'call': {
      const [, name, args] = n;
      if (name === 'if') return truthy(evaluate(args[0], env)) ? evaluate(args[1], env) : evaluate(args[2], env);
      const values = args.map((a) => evaluate(a, env));
      if (PURE_FUNCTIONS[name]) return PURE_FUNCTIONS[name][2](...values);
      return env.call(name, values);
    }
  }
}

/** Evaluate an expression's source; nil (null) when it doesn't parse. */
export function value_of(src: unknown, env: Env): unknown {
  try { return evaluate(parse(src), env); } catch { return null; }
}

// ------------------------------------------------------------------ checking
/** What an expression may name where it is written: its roots (with the fields each has, or null for
 * any), the roots that are a thing themselves (a card: usable without a field), the context's functions
 * (name: [min args, max args]) and whether it may draw random numbers. */
export interface Scope {
  roots: Map<string, Set<string> | null>;
  refs: Set<string>;
  functions: Map<string, [number, number]>;
  impure: Set<string>;
  allow_impure: boolean;
}

export function make_scope(roots: Record<string, readonly string[] | null>, functions: Record<string, readonly [number, number]>,
  impure: Iterable<string> = [], allow_impure = true, refs: Iterable<string> = []): Scope {
  return {
    roots: new Map(Object.entries(roots).map(([k, v]) => [k, v === null ? null : new Set(v)])),
    refs: new Set(refs),
    functions: new Map(Object.entries(functions).map(([k, v]) => [k, [v[0], v[1]]])),
    impure: new Set(impure),
    allow_impure,
  };
}

const sorted = (s: Iterable<string>) => [...s].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** What is wrong with the expression in this scope (empty: nothing). */
export function check(node: Node, scope: Scope): Msg[] {
  const errors: Msg[] = [];
  const walk = (n: Node): void => {
    switch (n[0]) {
      case 'var': {
        const [, root, path] = n;
        if (!scope.roots.has(root)) { errors.push({ k: 'x_unknown_name', name: root }); return; }
        const fields = scope.roots.get(root)!;
        if (fields !== null) {
          if (!path.length && fields.size && !scope.refs.has(root)) errors.push({ k: 'x_needs_field', root, fields: sorted(fields) });
          else if (path.length && !fields.has(path[0])) errors.push({ k: 'x_no_field', root, field: path[0], fields: sorted(fields) });
        }
        return;
      }
      case 'field': walk(n[1]); return;
      case 'and': case 'or': walk(n[1]); walk(n[2]); return;
      case 'not': case 'neg': walk(n[1]); return;
      case 'bin': walk(n[2]); walk(n[3]); return;
      case 'call': {
        const [, name, args] = n;
        let lo: number, hi: number;
        if (PURE_FUNCTIONS[name]) [lo, hi] = PURE_FUNCTIONS[name];
        else if (LAZY_FUNCTIONS[name]) [lo, hi] = LAZY_FUNCTIONS[name];
        else if (scope.functions.has(name)) {
          [lo, hi] = scope.functions.get(name)!;
          if (scope.impure.has(name) && !scope.allow_impure) errors.push({ k: 'x_impure', fn: name });
        } else {
          errors.push({ k: 'x_unknown_function', fn: name });
          [lo, hi] = [0, args.length];
        }
        if (!(lo <= args.length && args.length <= hi)) errors.push({ k: 'x_arguments', fn: name, lo, hi });
        for (const a of args) walk(a);
        return;
      }
      default: return;
    }
  };
  walk(node);
  return errors;
}

/** The fields of `root` the expression reads (`self.mult` -> {'mult'}). */
export function names_used(node: Node, root: string): Set<string> {
  const out = new Set<string>();
  const walk = (n: Node): void => {
    switch (n[0]) {
      case 'var': if (n[1] === root && n[2].length) out.add(n[2][0]); return;
      case 'field': walk(n[1]); return;
      case 'and': case 'or': walk(n[1]); walk(n[2]); return;
      case 'not': case 'neg': walk(n[1]); return;
      case 'bin': walk(n[2]); walk(n[3]); return;
      case 'call': n[2].forEach(walk); return;
      default: return;
    }
  };
  walk(node);
  return out;
}

/** The source with `root.old` renamed `root.new` (a config value renamed); unparsable sources are left as they are. */
export function rename_field(src: string, root: string, from: string, to: string): string {
  let toks: Tok[];
  try { toks = tokens(src); } catch { return src; }
  let out = '';
  let last = 0;
  for (let i = 0; i + 2 < toks.length; i++) {
    const [a, dot, b] = [toks[i], toks[i + 1], toks[i + 2]];
    const prev = toks[i - 1];
    if (a.kind === 'name' && a.text === root && dot.text === '.' && b.kind === 'name' && b.text === from && !(prev && prev.text === '.')) {
      out += src.slice(last, b.start) + to;
      last = b.end;
    }
  }
  return out + src.slice(last);
}
