/**
 * card-links.helper.ts
 *
 * Pure helper functions for card-to-card link canonicalization.
 * Extracted from CardService.linkCard() to keep the service focused on
 * persistence and event emission.
 *
 * Rules:
 *  - 'blocked_by' is an inverse view: stored as 'blocks' with source/dest swapped.
 *  - 'child_of'   is an inverse view: stored as 'parent_of' with source/dest swapped.
 *  - 'relates_to' and 'duplicates' are symmetric: the lower ULID is always source
 *    so that A→B and B→A produce the same INSERT OR IGNORE row.
 */

import { CardLinkRelationType, StoredCardLinkType } from '../../shared/types.js';

export interface CanonicalLink {
  sourceCardId: string;
  destCardId: string;
  storedType: StoredCardLinkType;
}

/**
 * Convert a caller-facing relation type + caller's card IDs into the
 * canonical storage representation (source, destination, storedType).
 *
 * @param cardId       The card the caller is operating on.
 * @param targetCardId The other card in the relationship.
 * @param relationType The relationship type from the caller's perspective.
 * @throws {Error} if cardId === targetCardId.
 */
export function canonicalizeCardLink(
  cardId: string,
  targetCardId: string,
  relationType: CardLinkRelationType
): CanonicalLink {
  if (cardId === targetCardId) {
    throw new Error('A card cannot be linked to itself');
  }

  let sourceCardId = cardId;
  let destCardId = targetCardId;

  // Inverse-view types: rewrite to canonical form before storing.
  let storedType: StoredCardLinkType =
    relationType === 'blocked_by' ? 'blocks' :
    relationType === 'child_of'   ? 'parent_of' :
    relationType;

  if (relationType === 'blocked_by' || relationType === 'child_of') {
    // Swap source and destination so the blocker/parent is always the source.
    sourceCardId = targetCardId;
    destCardId = cardId;
  } else if (storedType === 'relates_to' || storedType === 'duplicates') {
    // Symmetric relations: canonicalize direction by lexicographic order so
    // A→B and B→A collapse to a single INSERT OR IGNORE row.
    if (sourceCardId > destCardId) {
      [sourceCardId, destCardId] = [destCardId, sourceCardId];
    }
  }

  return { sourceCardId, destCardId, storedType };
}
