// File: src/shared/lexorank.ts

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const START_CHAR = 'a';
const END_CHAR = 'z';

export function generateRank(): string {
  return 'm';
}

function getMidChar(c1: string, c2: string): string {
  const i1 = ALPHABET.indexOf(c1);
  const i2 = ALPHABET.indexOf(c2);
  const midIndex = Math.floor((i1 + i2) / 2);
  return ALPHABET[midIndex];
}

export function rankBetween(before: string | null, after: string | null): string {
  if (!before && !after) {
    return generateRank();
  }
  if (!before && after) {
    return rankBefore(after);
  }
  if (before && !after) {
    return rankAfter(before);
  }

  // both before and after are provided
  const str1 = before!;
  const str2 = after!;
  let rank = '';
  let i = 0;

  while (true) {
    const char1 = i < str1.length ? str1[i] : START_CHAR;
    const char2 = i < str2.length ? str2[i] : END_CHAR;

    if (char1 === char2) {
      rank += char1;
      i++;
      continue;
    }

    const i1 = ALPHABET.indexOf(char1);
    const i2 = ALPHABET.indexOf(char2);

    if (i2 - i1 > 1) {
      const mid = getMidChar(char1, char2);
      rank += mid;
      break;
    } else {
      rank += char1;
      i++;
      // We need to keep going and append something in the middle
      // Effectively this is like getting a rank after str1 padded.
      return rank + rankAfter(str1.substring(i));
    }
  }

  return rank;
}

export function rankAfter(rank: string): string {
  let newRank = '';
  for (let i = 0; i < rank.length; i++) {
    const char = rank[i];
    if (char === END_CHAR) {
      newRank += char;
    } else {
      const charIndex = ALPHABET.indexOf(char);
      newRank += ALPHABET[charIndex + 1];
      return newRank;
    }
  }
  return newRank + 'm';
}

export function rankBefore(rank: string): string {
  for (let i = rank.length - 1; i >= 0; i--) {
    const char = rank[i];
    const charIndex = ALPHABET.indexOf(char);
    if (charIndex > 0) {
      return rank.substring(0, i) + ALPHABET[charIndex - 1];
    }
  }
  return '0' + rank;
}
