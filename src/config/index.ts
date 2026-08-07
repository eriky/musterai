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

export function resolveDbPath(dbOption?: string): { path: string; url: string | null } {
  const dbType = (process.env.MUSTER_DB_TYPE || 'sqlite') as 'sqlite' | 'postgres';
  const initialUrl = process.env.MUSTER_DATABASE_URL || null;

  const targetOption = dbOption || process.env.MUSTER_DB_NAME;

  if (!targetOption) {
    if (process.env.MUSTER_DB_PATH) {
      return { path: process.env.MUSTER_DB_PATH, url: initialUrl };
    }
    return { path: path.join(projectRoot, 'data/muster.db'), url: initialUrl };
  }

  if (dbType === 'postgres') {
    if (!initialUrl) {
      return { path: path.join(projectRoot, 'data/muster.db'), url: null };
    }
    try {
      const parsedUrl = new URL(initialUrl);
      parsedUrl.pathname = `/${targetOption.replace(/^\//, '')}`;
      return { path: path.join(projectRoot, 'data/muster.db'), url: parsedUrl.toString() };
    } catch {
      return { path: path.join(projectRoot, 'data/muster.db'), url: initialUrl };
    }
  }

  if (path.isAbsolute(targetOption)) {
    return { path: path.resolve(targetOption), url: initialUrl };
  }

  if (targetOption.includes('/') || targetOption.includes('\\')) {
    return { path: path.resolve(process.cwd(), targetOption), url: initialUrl };
  }

  let fileName = targetOption;
  if (!/\.(db|sqlite|sqlite3)$/i.test(fileName)) {
    fileName = `${fileName}.db`;
  }

  return { path: path.join(projectRoot, 'data', fileName), url: initialUrl };
}

const port = parseInt(process.env.MUSTER_PORT || '3000', 10);
const initialDb = resolveDbPath();

export const config = {
  port,
  host: process.env.MUSTER_HOST || 'localhost',
  auth: {
    mode: detectAuthMode() as 'open' | 'enforced',
  },
  db: {
    /** 'sqlite' (default, zero-config) or 'postgres' — see docs/deployment.md. */
    type: (process.env.MUSTER_DB_TYPE || 'sqlite') as 'sqlite' | 'postgres',
    path: initialDb.path,
    /** e.g. postgres://user:pass@host:5432/muster — required when type is 'postgres'. */
    url: initialDb.url,
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

export function setDatabaseOverride(dbOption?: string): void {
  const resolved = resolveDbPath(dbOption);
  config.db.path = resolved.path;
  config.db.url = resolved.url;
}

/** True when enough OIDC configuration is present to enable the auth routes. */
export function isOidcConfigured(): boolean {
  return !!(config.oidc.issuer && config.oidc.clientId && config.oidc.clientSecret);
}