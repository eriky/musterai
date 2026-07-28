// File: tests/rate-limiter.test.ts
//
// MUS-24 scope requirement: "Rate-limit failed bearer attempts per IP."

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRetryAfterMs,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  resetRateLimiterState,
} from '../src/api/middleware/rate-limiter.js';

describe('MUS-24: bearer-attempt rate limiter', () => {
  beforeEach(() => {
    resetRateLimiterState();
  });

  it('allows attempts under the failure threshold', () => {
    const ip = '10.0.0.1';
    for (let i = 0; i < 9; i++) recordFailedAttempt(ip);
    expect(getRetryAfterMs(ip)).toBe(0);
  });

  it('locks out an IP after the failure threshold is reached', () => {
    const ip = '10.0.0.2';
    for (let i = 0; i < 10; i++) recordFailedAttempt(ip);
    expect(getRetryAfterMs(ip)).toBeGreaterThan(0);
  });

  it('does not lock out unrelated IPs', () => {
    const attacker = '10.0.0.3';
    const bystander = '10.0.0.4';
    for (let i = 0; i < 10; i++) recordFailedAttempt(attacker);
    expect(getRetryAfterMs(attacker)).toBeGreaterThan(0);
    expect(getRetryAfterMs(bystander)).toBe(0);
  });

  it('clears failure history for an IP on a successful attempt', () => {
    const ip = '10.0.0.5';
    for (let i = 0; i < 9; i++) recordFailedAttempt(ip);
    recordSuccessfulAttempt(ip);
    for (let i = 0; i < 9; i++) recordFailedAttempt(ip);
    // Still under threshold because success reset the counter in between
    expect(getRetryAfterMs(ip)).toBe(0);
  });
});
