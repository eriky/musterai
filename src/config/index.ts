// File: src/config/index.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

export const config = {
  port: parseInt(process.env.MUSTER_PORT || '3000', 10),
  host: process.env.MUSTER_HOST || 'localhost',
  db: {
    type: process.env.MUSTER_DB_TYPE || 'sqlite',
    path: process.env.MUSTER_DB_PATH || path.join(projectRoot, 'data/muster.db'),
  },
  attachmentsDir: process.env.MUSTER_ATTACHMENTS_DIR || path.join(projectRoot, 'data/attachments'),
  publicDir: path.join(projectRoot, 'public'),
};
