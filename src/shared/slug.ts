/** Convert a human-readable name into a stable URL segment. */
export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'untitled';
}

/** Pick the first available slug, suffixing collisions with -2, -3, ... . */
export function deriveSlug(value: string, taken: Set<string> = new Set()): string {
  const base = slugify(value);
  if (!taken.has(base)) return base;

  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}
