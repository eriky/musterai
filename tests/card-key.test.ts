// File: tests/card-key.test.ts
import { describe, it, expect } from 'vitest';
import { deriveKeyPrefix, formatCardKey } from '../src/shared/card-key.js';

describe('deriveKeyPrefix', () => {
  it('builds an acronym from a multi-word name', () => {
    expect(deriveKeyPrefix('Collaborative Agent Platform')).toBe('CAP');
    expect(deriveKeyPrefix('Python Land')).toBe('PL');
  });

  it('takes the first three letters of a single-word name', () => {
    expect(deriveKeyPrefix('Muster')).toBe('MUS');
  });

  it('caps multi-word acronyms at four letters', () => {
    expect(deriveKeyPrefix('A Very Long Project Name Indeed')).toBe('AVLP');
  });

  it('strips punctuation and ignores empty words', () => {
    expect(deriveKeyPrefix('  Foo -- Bar!! ')).toBe('FB');
  });

  it('pads a single-letter name so the prefix stays at least two characters', () => {
    expect(deriveKeyPrefix('P')).toBe('PX');
  });

  it('falls back to PRJ for a name with no letters or digits', () => {
    expect(deriveKeyPrefix('!!!')).toBe('PRJ');
  });

  it('avoids collisions with already-taken prefixes', () => {
    const taken = new Set(['MUS']);
    expect(deriveKeyPrefix('Muster', taken)).toBe('MUS2');

    taken.add('MUS2');
    expect(deriveKeyPrefix('Muster', taken)).toBe('MUS3');
  });
});

describe('formatCardKey', () => {
  it('joins prefix and sequence with a dash', () => {
    expect(formatCardKey('MUS', 42)).toBe('MUS-42');
  });
});
