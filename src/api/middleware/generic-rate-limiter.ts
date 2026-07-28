// File: src/api/middleware/generic-rate-limiter.ts
//
// Fixed-window rate limiting for general traffic shaping (MUS-30) — distinct
// from rate-limiter.ts, which is specifically the failed-bearer-attempt
// lockout (MUS-24). This one guards raw request volume on endpoints that
// are expensive, public, or both: /oauth/register, /oauth/token, /mcp.

import { Request, Response, NextFunction } from 'express';

interface WindowState {
  count: number;
  windowStart: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Defaults to the client IP. Pass a keyFn to rate-limit per-principal instead (e.g. for /mcp, after auth has resolved). */
  keyFn?: (req: Request) => string;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const state = new Map<string, WindowState>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const key = options.keyFn ? options.keyFn(req) : (req.ip || req.socket.remoteAddress || 'unknown');
    const now = Date.now();

    let s = state.get(key);
    if (!s || now - s.windowStart > options.windowMs) {
      s = { count: 0, windowStart: now };
      state.set(key, s);
    }
    s.count += 1;

    if (s.count > options.max) {
      const retryAfterMs = options.windowMs - (now - s.windowStart);
      res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000).toString());
      res.status(429).json({
        error: 'rate_limited',
        message: options.message || 'Too many requests. Try again later.',
      });
      return;
    }

    // Opportunistic cleanup so the map doesn't grow unbounded under scanning traffic.
    if (state.size > 50_000) {
      for (const [k, v] of state) {
        if (now - v.windowStart > options.windowMs) state.delete(k);
      }
    }

    next();
  };
}
