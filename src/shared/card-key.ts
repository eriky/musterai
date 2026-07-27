// File: src/shared/card-key.ts

/**
 * Derives a JIRA-style key prefix from a project name, e.g.
 * "Collaborative Agent Platform" -> "CAP", "Muster" -> "MUS".
 * Multi-word names use one initial per word (up to 4); single-word
 * names use their first three letters. Falls back to "PRJ" if the
 * name has no letters/digits at all.
 */
export function deriveKeyPrefix(name: string, taken: Set<string> = new Set()): string {
  const words = name
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  let base: string;
  if (words.length >= 2) {
    base = words
      .slice(0, 4)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  } else {
    base = (words[0] || '').toUpperCase().slice(0, 3);
  }

  base = base.replace(/[^A-Z0-9]/g, '');
  if (!base) base = 'PRJ';
  if (base.length < 2) base = base.padEnd(2, 'X');

  if (!taken.has(base)) return base;

  let suffix = 2;
  let candidate = `${base}${suffix}`;
  while (taken.has(candidate)) {
    suffix++;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

export function formatCardKey(prefix: string, seq: number): string {
  return `${prefix}-${seq}`;
}
