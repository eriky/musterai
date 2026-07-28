// File: tests/connect-credentials.test.ts
//
// MUS-27 acceptance criterion: the credentials file is created with mode
// 0600. Also covers the per-server keying `muster login`/`logout` rely on.

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'muster-creds-test-'));
const originalHome = process.env.HOME;

// os.homedir() reads $HOME on POSIX at call time, so redirecting it before
// importing the module under test is enough to isolate the real ~/.muster.
process.env.HOME = TEST_HOME;

const { getCredential, setCredential, removeCredential, listServers, credentialsPath, normalizeServerUrl } =
  await import('../src/connect/credentials.js');

describe('MUS-27: credentials.json', () => {
  afterEach(() => {
    const file = credentialsPath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  afterAll(() => {
    process.env.HOME = originalHome;
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  it('is created with mode 0600', () => {
    setCredential('https://muster.example.com', { token: 'muster_pat_x_y', token_id: 'tok-1', created_at: new Date().toISOString() });
    const stat = fs.statSync(credentialsPath());
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('round-trips a credential by server URL', () => {
    setCredential('https://muster.example.com', { token: 'muster_pat_x_y', token_id: 'tok-1', created_at: new Date().toISOString() });
    const cred = getCredential('https://muster.example.com');
    expect(cred?.token).toBe('muster_pat_x_y');
  });

  it('normalizes a trailing slash so it matches the same server', () => {
    setCredential('https://muster.example.com', { token: 'muster_pat_x_y', token_id: null, created_at: new Date().toISOString() });
    expect(getCredential('https://muster.example.com/')?.token).toBe('muster_pat_x_y');
    expect(normalizeServerUrl('https://muster.example.com/')).toBe('https://muster.example.com');
  });

  it('keeps credentials for more than one server independently', () => {
    setCredential('https://a.example.com', { token: 'token-a', token_id: null, created_at: new Date().toISOString() });
    setCredential('https://b.example.com', { token: 'token-b', token_id: null, created_at: new Date().toISOString() });
    expect(listServers().sort()).toEqual(['https://a.example.com', 'https://b.example.com']);
    expect(getCredential('https://a.example.com')?.token).toBe('token-a');
    expect(getCredential('https://b.example.com')?.token).toBe('token-b');
  });

  it('removes a credential without disturbing others', () => {
    setCredential('https://a.example.com', { token: 'token-a', token_id: null, created_at: new Date().toISOString() });
    setCredential('https://b.example.com', { token: 'token-b', token_id: null, created_at: new Date().toISOString() });
    removeCredential('https://a.example.com');
    expect(getCredential('https://a.example.com')).toBeNull();
    expect(getCredential('https://b.example.com')?.token).toBe('token-b');
  });

  it('returns null for a server with no saved credential', () => {
    expect(getCredential('https://never-logged-in.example.com')).toBeNull();
  });
});
