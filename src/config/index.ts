// File: src/config/index.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

export const config = {
  port: parseInt(process.env.CAP_PORT || '3000', 10),
  host: process.env.CAP_HOST || 'localhost',
  db: {
    type: process.env.CAP_DB_TYPE || 'sqlite',
    path: process.env.CAP_DB_PATH || path.join(projectRoot, 'data/cap.db'),
  },
  attachmentsDir: process.env.CAP_ATTACHMENTS_DIR || path.join(projectRoot, 'data/attachments'),
  publicDir: path.join(projectRoot, 'public'),
};
