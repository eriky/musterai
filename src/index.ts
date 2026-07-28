// File: src/index.ts
//
// Direct entry point for `npm run dev` / `npm start` / `node dist/index.js`.
// Equivalent to `muster serve` — see src/cli.ts for the full serve/connect/
// login/logout dispatcher. Kept as a thin wrapper so this exact invocation
// keeps working unchanged.

import { startServer } from './server.js';

startServer().catch(console.error);
