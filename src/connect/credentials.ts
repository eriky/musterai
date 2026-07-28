// File: src/connect/credentials.ts
//
// `muster login` stores a bearer token at ~/.muster/credentials.json, mode
// 0600, keyed by server URL so one user can be connected to more than one
// server. Design doc §7.2 / §8.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface StoredCredential {
  token: string;
  /** api_token.id upstream — lets `muster logout` revoke server-side without re-deriving it from the token's prefix. */
  token_id: string | null;
  created_at: string;
}

interface CredentialsFile {
  servers: Record<string, StoredCredential>;
}

export function credentialsPath(): string {
  return path.join(os.homedir(), '.muster', 'credentials.json');
}

/** Canonical form used as the lookup key — strips a trailing slash so "https://x.com" and "https://x.com/" collide. */
export function normalizeServerUrl(server: string): string {
  return server.trim().replace(/\/+$/, '');
}

function readFile(): CredentialsFile {
  const file = credentialsPath();
  if (!fs.existsSync(file)) return { servers: {} };
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return { servers: parsed.servers || {} };
  } catch {
    return { servers: {} };
  }
}

/** Writes the file with mode 0600 regardless of umask or the file's prior mode. */
function writeFile(data: CredentialsFile): void {
  const file = credentialsPath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

export function getCredential(server: string): StoredCredential | null {
  const data = readFile();
  return data.servers[normalizeServerUrl(server)] || null;
}

export function setCredential(server: string, credential: StoredCredential): void {
  const data = readFile();
  data.servers[normalizeServerUrl(server)] = credential;
  writeFile(data);
}

export function removeCredential(server: string): void {
  const data = readFile();
  delete data.servers[normalizeServerUrl(server)];
  writeFile(data);
}

export function listServers(): string[] {
  return Object.keys(readFile().servers);
}
