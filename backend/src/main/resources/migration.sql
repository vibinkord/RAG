-- Migration to add crawled_at column to pages table
-- Since the table already contains rows, we add the column with a default value of CURRENT_TIMESTAMP so that it is populated for existing pages.

ALTER TABLE pages ADD COLUMN crawled_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
