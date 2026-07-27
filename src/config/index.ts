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

export const config = {
  port: parseInt(process.env.MUSTER_PORT || '3000', 10),
  host: process.env.MUSTER_HOST || 'localhost',
  auth: {
    mode: detectAuthMode() as 'open' | 'enforced',
  },
  db: {
    type: process.env.MUSTER_DB_TYPE || 'sqlite',
    path: process.env.MUSTER_DB_PATH || path.join(projectRoot, 'data/muster.db'),
  },
  attachmentsDir: process.env.MUSTER_ATTACHMENTS_DIR || path.join(projectRoot, 'data/attachments'),
  publicDir: path.join(projectRoot, 'public'),
};