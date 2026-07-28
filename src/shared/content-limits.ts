// File: src/shared/content-limits.ts
//
// Explicit caps on user-supplied body sizes (MUS-30, design doc §13).
// The request-level express.json({ limit }) in server.ts bounds the whole
// payload; these bound the individual free-text fields within it, since a
// single request can otherwise carry one enormous field well under the
// request cap and still be a meaningful cost against a single-connection
// SQLite (large TEXT columns, larger WAL writes, larger full-table scans
// on every read that doesn't project the column away).

import { ValidationError } from './errors.js';

/** ~2M characters — generous for even an unusually long design doc, well short of the 5MB request cap. */
export const DOCUMENT_CONTENT_MAX_CHARS = 2_000_000;
/** Card descriptions and comments are conversational, not documents. */
export const CARD_TEXT_MAX_CHARS = 200_000;

export function assertMaxLength(value: string | null | undefined, max: number, fieldName: string): void {
  if (value && value.length > max) {
    throw new ValidationError(`${fieldName} exceeds the maximum length of ${max.toLocaleString()} characters (got ${value.length.toLocaleString()}).`);
  }
}
