// File: src/index.ts
//
// Direct entry point for `npm run dev` / `npm start` / `node dist/index.js`.
// Equivalent to `muster serve` — see src/cli.ts for the full serve/connect/
// login/logout dispatcher. Kept as a thin wrapper so this exact invocation
// keeps working unchanged.

import { startServer } from './server.js';

function parseDbOption(): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--db' || arg === '--db-name' || arg === '--database' || arg === '-d') {
      return argv[i + 1];
    }
    if (arg.startsWith('--db=') || arg.startsWith('--db-name=') || arg.startsWith('--database=')) {
      return arg.split('=')[1];
    }
  }
  return undefined;
}

startServer({ db: parseDbOption() }).catch(console.error);
