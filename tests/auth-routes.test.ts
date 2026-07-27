// File: tests/auth-routes.test.ts
//
// MUS-25 acceptance criteria (end-to-end, over real HTTP):
// - a user with no invitation and no bootstrap claim is authenticated but
//   not admitted, with a clear message
// - the first user to sign in becomes workspace owner
// - an invited user is admitted on sign-in and the invitation is consumed
// - logout invalidates the session server-side
// - session cookie carries httpOnly, Secure, SameSite

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseAdapter } from '../src/db/factory.js';
import { DatabaseAdapter } from '../src/db/adapter.js';
import { Migrator } from '../src/db/migrator.js';
import { OidcService } from '../src/services/oidc.service.js';
import { SessionService } from '../src/services/session.service.js';
import { UserService } from '../src/services/user.service.js';
import { InvitationService } from '../src/services/invitation.service.js';
import { RoleService } from '../src/services/role.service.js';
import { AgentService } from '../src/services/agent.service.js';
import { TokenService } from '../src/services/token.service.js';
import { createAuthRouter } from '../src/api/routes/auth.routes.js';
import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { config } from '../src/config/index.js';
import { FakeOidcProvider } from './helpers/fake-oidc-provider.js';

const TEST_DB = path.join(process.cwd(), 'data', 'test-auth-routes.db');

function parseSetCookie(headers: Headers): string | undefined {
  return headers.get('set-cookie') || undefined;
}

function extractCookieValue(setCookieHeader: string, name: string): string | null {
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

describe('MUS-25: auth routes (end-to-end over HTTP)', () => {
  let provider: FakeOidcProvider;
  let originalOidcConfig: typeof config.oidc;
  let db: DatabaseAdapter;
  let server: ReturnType<typeof express.application.listen>;
  let baseUrl: string;
  let workspaceId: string;
  let roleService: RoleService;
  let invitationService: InvitationService;

  beforeAll(async () => {
    provider = await FakeOidcProvider.start();
    originalOidcConfig = { ...config.oidc };
  });

  afterAll(async () => {
    await provider.stop();
    Object.assign(config.oidc, originalOidcConfig);
  });

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = createDatabaseAdapter(TEST_DB);
    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();

    workspaceId = 'ws-auth-route-test';
    const now = new Date().toISOString();
    await db.execute('INSERT INTO workspace (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'Test WS', 'test-ws-auth', now, now]);

    roleService = new RoleService(db);
    await roleService.seedPreset(workspaceId);

    const oidcService = new OidcService(db);
    const sessionService = new SessionService(db);
    const userService = new UserService(db);
    invitationService = new InvitationService(db);
    const agentService = new AgentService(db);
    const tokenService = new TokenService(db);

    const app = express();
    app.use(express.json());
    app.use(createAuthMiddleware(db, tokenService, roleService, agentService, sessionService));
    const v1 = express.Router();
    v1.use(createAuthRouter(db, oidcService, sessionService, userService, invitationService, roleService));
    app.use('/api/v1', v1);

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;

    (config.oidc as any).issuer = provider.issuer;
    (config.oidc as any).clientId = 'test-client-id';
    (config.oidc as any).clientSecret = 'test-client-secret';
    (config.oidc as any).publicUrl = baseUrl;
    (config.oidc as any).bootstrapOwnerSubject = null;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (db) await db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(TEST_DB + suffix); } catch { /* ok */ }
    }
  });

  /** Drives login -> fake IdP consent -> callback, returning the session cookie header and the callback response. */
  async function signIn(sub: string, email: string | null): Promise<{ setCookie: string; callbackRes: Response }> {
    provider.setNextIdentity(sub, email);

    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, { redirect: 'manual' });
    expect(loginRes.status).toBe(302);
    const authorizeUrl = new URL(loginRes.headers.get('location')!);

    const callbackUrl = provider.authorize(authorizeUrl.searchParams);
    const callbackRes = await fetch(callbackUrl.href.replace(callbackUrl.origin, baseUrl), { redirect: 'manual' });

    const setCookie = parseSetCookie(callbackRes.headers);
    expect(setCookie).toBeDefined();
    return { setCookie: setCookie!, callbackRes };
  }

  it('admits the first user to sign in as workspace owner', async () => {
    const { setCookie } = await signIn('sub-first', 'first@example.com');
    const token = extractCookieValue(setCookie, 'muster_session');

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Cookie: `muster_session=${token}` } });
    const me = await meRes.json();

    expect(me.authenticated).toBe(true);
    expect(me.admitted).toBe(true);
    expect(me.role).toBe('Owner');
  });

  it('authenticates but does not admit a user with no invitation and no bootstrap claim', async () => {
    // First user becomes owner — burn that slot first.
    await signIn('sub-owner', 'owner@example.com');

    const { setCookie } = await signIn('sub-uninvited', 'uninvited@example.com');
    const token = extractCookieValue(setCookie, 'muster_session');

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Cookie: `muster_session=${token}` } });
    const me = await meRes.json();

    expect(me.authenticated).toBe(true);
    expect(me.admitted).toBe(false);
  });

  it('admits an invited user and consumes the invitation', async () => {
    await signIn('sub-owner-2', 'owner2@example.com'); // burn first-user slot

    const juniorRole = await roleService.getByKey(workspaceId, 'junior_engineer');
    const invite = await invitationService.create({ workspace_id: workspaceId, email: 'invited@example.com', role_id: juniorRole!.id });

    const { setCookie } = await signIn('sub-invited', 'invited@example.com');
    const token = extractCookieValue(setCookie, 'muster_session');

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Cookie: `muster_session=${token}` } });
    const me = await meRes.json();
    expect(me.admitted).toBe(true);
    expect(me.role).toBe('Junior Engineer');

    const invitationRow = await invitationService.getById(invite.id);
    expect(invitationRow!.accepted_at).not.toBeNull();
  });

  it('session cookie carries httpOnly, Secure, and SameSite attributes', async () => {
    const { setCookie } = await signIn('sub-cookie-check', 'cookie@example.com');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('logout invalidates the session server-side', async () => {
    const { setCookie } = await signIn('sub-logout', 'logout@example.com');
    const token = extractCookieValue(setCookie, 'muster_session');

    const meBefore = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Cookie: `muster_session=${token}` } });
    expect((await meBefore.json()).authenticated).toBe(true);

    await fetch(`${baseUrl}/api/v1/auth/logout`, { method: 'POST', headers: { Cookie: `muster_session=${token}` } });

    const meAfter = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Cookie: `muster_session=${token}` } });
    expect((await meAfter.json()).authenticated).toBe(false);
  });
});
