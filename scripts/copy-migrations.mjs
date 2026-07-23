// File: scripts/copy-migrations.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src', 'db', 'migrations');
const dist = path.join(__dirname, '..', 'dist', 'db', 'migrations');

if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}

const sqlFiles = fs.readdirSync(src).filter(f => f.endsWith('.sql'));
for (const file of sqlFiles) {
  fs.copyFileSync(path.join(src, file), path.join(dist, file));
}

console.log(`Copied ${sqlFiles.length} migration file(s) to dist/db/migrations/`);
