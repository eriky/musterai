// File: src/api/middleware/rate-limiter.ts
//
// In-memory sliding-window rate limiter for failed bearer-token attempts,
// keyed by client IP (MUS-24 scope: "Rate-limit failed bearer attempts per IP").
//
// This guards the token-verification path itself, not general API traffic.
// A single process, in-memory counter is sufficient here — Muster runs as a
// single Node process against a single SQLite file, so there is no multi-instance
// case to coordinate across.

const WINDOW_MS = 60_000;
const MAX_FAILURES_PER_WINDOW = 10;
const LOCKOUT_MS = 60_000;

interface IpState {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

const state = new Map<string, IpState>();

/** Opportunistic cleanup so the map doesn't grow unbounded under scanning traffic. */
function sweep(now: number): void {
  for (const [ip, s] of state) {
    if (s.lockedUntil < now && now - s.windowStart > WINDOW_MS) {
      state.delete(ip);
    }
  }
}

/**
 * Returns the number of milliseconds the caller must wait before retrying,
 * or 0 if the IP is not currently locked out.
 */
export function getRetryAfterMs(ip: string): number {
  const now = Date.now();
  const s = state.get(ip);
  if (!s) return 0;
  if (s.lockedUntil > now) return s.lockedUntil - now;
  return 0;
}

/** Record a failed bearer-token verification attempt for this IP. */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  if (state.size > 10_000) sweep(now);

  let s = state.get(ip);
  if (!s || now - s.windowStart > WINDOW_MS) {
    s = { failures: 0, windowStart: now, lockedUntil: 0 };
    state.set(ip, s);
  }

  s.failures += 1;
  if (s.failures >= MAX_FAILURES_PER_WINDOW) {
    s.lockedUntil = now + LOCKOUT_MS;
  }
}

/** Clear failure history for this IP — call on a successful verification. */
export function recordSuccessfulAttempt(ip: string): void {
  state.delete(ip);
}

/** Test-only: reset all rate-limiter state between test runs. */
export function resetRateLimiterState(): void {
  state.clear();
}
