-- File: src/db/migrations/011-epic-cards.sql
-- Epic cards: a lightweight flag marking a card as a container for related
-- work, so it renders distinctly on the board. Membership (which cards
-- belong to an epic) reuses the existing card_link relation graph via new
-- 'parent_of' / 'child_of' relation types — relation_type is unconstrained
-- TEXT (see 007-card-links.sql), so no schema change is needed for those.
ALTER TABLE card ADD COLUMN is_epic INTEGER NOT NULL DEFAULT 0;
