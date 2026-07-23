import { describe, it, expect } from 'vitest';
import { generateRank, rankBetween, rankBefore, rankAfter } from '../src/shared/lexorank.js';

describe('LexoRank Algorithm', () => {
  it('generateRank returns default midpoint rank', () => {
    expect(generateRank()).toBe('m');
  });

  it('rankBefore generates rank lexicographically smaller than input', () => {
    expect(rankBefore('m')).toBe('l');
    expect(rankBefore('b')).toBe('a');
    const beforeA = rankBefore('a');
    expect(beforeA < 'a').toBe(true);
    expect(beforeA).toBe('0a');
  });

  it('rankAfter generates rank lexicographically larger than input', () => {
    expect(rankAfter('m')).toBe('n');
    expect(rankAfter('z')).toBe('zm');
  });

  it('rankBetween generates rank between two values', () => {
    const mid = rankBetween('a', 'c');
    expect(mid > 'a').toBe(true);
    expect(mid < 'c').toBe(true);
    expect(mid).toBe('b');
  });
});
