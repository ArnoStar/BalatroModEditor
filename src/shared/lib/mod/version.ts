// A mod's version: major.minor.patch. A published version is followed only by a higher one.

export function version_key(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v ?? '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

/** a is higher than b */
export function newer(a: string, b: string): boolean {
  const [x, y] = [version_key(a), version_key(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

export function bump(version: string, part: 'patch' | 'minor' | 'major'): string {
  const [a, b, c] = /^\d+\.\d+\.\d+$/.test(version ?? '') ? version_key(version) : [1, 0, 0];
  return part === 'major' ? `${a + 1}.0.0` : part === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`;
}
