// File: tests/cookies.test.ts
//
// MUS-25 acceptance criteria: "Session cookie carries httpOnly, Secure and SameSite."

import { describe, it, expect } from 'vitest';
import { parseCookies, serializeCookie, clearCookieHeader } from '../src/shared/cookies.js';

describe('MUS-25: cookie serialization', () => {
  it('serializes a session cookie with httpOnly, Secure, and SameSite by default', () => {
    const header = serializeCookie('muster_session', 'abc123', { maxAgeSeconds: 3600 });
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('muster_session=abc123');
    expect(header).toContain('Max-Age=3600');
  });

  it('round-trips a parsed cookie value', () => {
    const cookies = parseCookies('muster_session=abc123; other=xyz');
    expect(cookies.muster_session).toBe('abc123');
    expect(cookies.other).toBe('xyz');
  });

  it('handles a missing cookie header gracefully', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it('clearCookieHeader immediately expires the cookie', () => {
    const header = clearCookieHeader('muster_session');
    expect(header).toContain('Max-Age=0');
  });
});
