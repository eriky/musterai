// File: src/config/index.ts
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

function detectAuthMode(): 'open' | 'enforced' {
  const envMode = process.env.MUSTER_AUTH_MODE;
  if (envMode === 'open' || envMode === 'enforced') return envMode;

  // Default: enforced when binding to anything other than 127.0.0.1 / localhost
  const host = process.env.MUSTER_HOST || 'localhost';
  if (host === 'localhost' || host === '127.0.0.1') return 'open';
  return 'enforced';
}

const port = parseInt(process.env.MUSTER_PORT || '3000', 10);

export const config = {
  port,
  host: process.env.MUSTER_HOST || 'localhost',
  auth: {
    mode: detectAuthMode() as 'open' | 'enforced',
  },
  db: {
    /** 'sqlite' (default, zero-config) or 'postgres' — see docs/deployment.md. */
    type: (process.env.MUSTER_DB_TYPE || 'sqlite') as 'sqlite' | 'postgres',
    path: process.env.MUSTER_DB_PATH || path.join(projectRoot, 'data/muster.db'),
    /** e.g. postgres://user:pass@host:5432/muster — required when type is 'postgres'. */
    url: process.env.MUSTER_DATABASE_URL || null,
  },
  attachmentsDir: process.env.MUSTER_ATTACHMENTS_DIR || path.join(projectRoot, 'data/attachments'),
  publicDir: path.join(projectRoot, 'public'),
  oidc: {
    issuer: process.env.MUSTER_OIDC_ISSUER || null,
    clientId: process.env.MUSTER_OIDC_CLIENT_ID || null,
    clientSecret: process.env.MUSTER_OIDC_CLIENT_SECRET || null,
    publicUrl: process.env.MUSTER_PUBLIC_URL || `http://localhost:${port}`,
    /** OIDC `sub` claim pinned in advance as the workspace owner, bypassing invitation admission. */
    bootstrapOwnerSubject: process.env.MUSTER_BOOTSTRAP_OWNER_SUBJECT || null,
  },
};

/** True when enough OIDC configuration is present to enable the auth routes. */
export function isOidcConfigured(): boolean {
  return !!(config.oidc.issuer && config.oidc.clientId && config.oidc.clientSecret);
}