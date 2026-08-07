// File: tests/connect-proxy.test.ts
//
// MUS-27 acceptance criteria:
// - a local request without the loopback token is refused
// - the SSE stream is not buffered — chunks arrive as the upstream writes them
// - a full request round-trips through the proxy with the upstream bearer
//   token attached and the local token stripped
// - upstream unreachable produces a visible, named error

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Request, Response } from 'express';
import type { AddressInfo } from 'node:net';
import { createConnectApp } from '../src/connect/proxy.js';

async function listen(app: express.Express): Promise<{ server: ReturnType<typeof express.application.listen>; baseUrl: string }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

describe('MUS-27: muster connect proxy', () => {
  const LOCAL_TOKEN = 'local-test-token';
  const UPSTREAM_TOKEN = 'muster_pat_abcd1234_deadbeef';

  let upstreamServer: ReturnType<typeof express.application.listen> | null = null;
  let upstreamUrl = '';
  let proxyServer: ReturnType<typeof express.application.listen> | null = null;
  let proxyUrl = '';

  afterEach(async () => {
    if (proxyServer) await new Promise<void>((resolve) => proxyServer!.close(() => resolve()));
    if (upstreamServer) await new Promise<void>((resolve) => upstreamServer!.close(() => resolve()));
    proxyServer = null;
    upstreamServer = null;
  });

  async function startProxy(targetUrl: string) {
    const app = createConnectApp({
      upstreamUrl: targetUrl,
      upstreamToken: UPSTREAM_TOKEN,
      localToken: LOCAL_TOKEN,
      publicDir: '/nonexistent-public-dir-for-tests',
    });
    const { server, baseUrl } = await listen(app);
    proxyServer = server;
    proxyUrl = baseUrl;
  }

  it('refuses a local /api request without the loopback token', async () => {
    const upstream = express();
    upstream.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
    const up = await listen(upstream);
    upstreamServer = up.server;
    upstreamUrl = up.baseUrl;
    await startProxy(upstreamUrl);

    const res = await fetch(`${proxyUrl}/api/v1/health`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('accepts the loopback token via Authorization header and forwards the upstream bearer token', async () => {
    let receivedAuth: string | undefined;
    const upstream = express();
    upstream.get('/api/v1/whoami', (req, res) => {
      receivedAuth = req.headers.authorization;
      res.json({ ok: true });
    });
    const up = await listen(upstream);
    upstreamServer = up.server;
    upstreamUrl = up.baseUrl;
    await startProxy(upstreamUrl);

    const res = await fetch(`${proxyUrl}/api/v1/whoami`, {
      headers: { Authorization: `Bearer ${LOCAL_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // The local token must never reach the upstream — only the stored PAT does.
    expect(receivedAuth).toBe(`Bearer ${UPSTREAM_TOKEN}`);
  });

  it('accepts the loopback token via ?local_token= for EventSource, which cannot set headers', async () => {
    const upstream = express();
    upstream.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
    const up = await listen(upstream);
    upstreamServer = up.server;
    upstreamUrl = up.baseUrl;
    await startProxy(upstreamUrl);

    const res = await fetch(`${proxyUrl}/api/v1/health?local_token=${LOCAL_TOKEN}`);
    expect(res.status).toBe(200);
  });

  it('streams an SSE response without buffering — chunks arrive as the upstream writes them, not all at once at the end', async () => {
    const upstream = express();
    upstream.get('/api/v1/stream', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.flushHeaders();
      let n = 0;
      const interval = setInterval(() => {
        n++;
        res.write(`data: chunk-${n}\n\n`);
        if (n === 3) {
          clearInterval(interval);
          res.end();
        }
      }, 60);
    });
    const up = await listen(upstream);
    upstreamServer = up.server;
    upstreamUrl = up.baseUrl;
    await startProxy(upstreamUrl);

    const res = await fetch(`${proxyUrl}/api/v1/stream`, {
      headers: { Authorization: `Bearer ${LOCAL_TOKEN}` },
    });
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const chunkTimestamps: number[] = [];
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunkTimestamps.push(Date.now());
      full += decoder.decode(value, { stream: true });
    }

    expect(full).toContain('chunk-1');
    expect(full).toContain('chunk-2');
    expect(full).toContain('chunk-3');
    // A buffering proxy would deliver everything in one chunk once the
    // upstream finally closes the connection — i.e. a single read. Getting
    // more than one read means bytes crossed the proxy as they were written.
    expect(chunkTimestamps.length).toBeGreaterThan(1);
  });

  it('returns a named, visible error when the upstream is unreachable', async () => {
    // Nothing listens on this port.
    await startProxy('http://127.0.0.1:1');

    const res = await fetch(`${proxyUrl}/api/v1/health`, {
      headers: { Authorization: `Bearer ${LOCAL_TOKEN}` },
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('upstream_unreachable');
    expect(body.message).toContain('http://127.0.0.1:1');
  });
});
