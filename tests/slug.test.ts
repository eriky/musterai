import { describe, expect, it } from 'vitest';
import { deriveSlug, slugify } from '../src/shared/slug.js';

describe('URL slugs', () => {
  it('normalizes names into readable URL segments', () => {
    expect(slugify('  Dévelopment Board  ')).toBe('development-board');
    expect(slugify('***')).toBe('untitled');
  });

  it('suffixes collisions deterministically', () => {
    const taken = new Set(['release-board', 'release-board-2']);
    expect(deriveSlug('Release Board', taken)).toBe('release-board-3');
  });
});
