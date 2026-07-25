-- Migration 006: Add status and blocked_reason to card table
ALTER TABLE card ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE card ADD COLUMN blocked_reason TEXT;
