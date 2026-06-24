-- Migration to add crawled_at column to pages table
-- Since the table already contains rows, we add the column with a default value of CURRENT_TIMESTAMP so that it is populated for existing pages.

ALTER TABLE pages ADD COLUMN crawled_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Safe migration check: If the embeddings table has data, abort the migration.
DO $$
DECLARE
    has_data boolean := false;
BEGIN
    -- Check if table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'embeddings'
    ) THEN
        -- Check if table contains data
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM embeddings)' INTO has_data;
        
        IF has_data THEN
            RAISE EXCEPTION 'Safety check failed: The embeddings table contains data. Drop the table manually to migrate to pgvector.';
        ELSE
            -- Safe to drop and recreate since it is empty
            DROP TABLE IF EXISTS embeddings CASCADE;
        END IF;
    END IF;
END;
$$;

-- Create the new embeddings table with native pgvector support
CREATE TABLE IF NOT EXISTS embeddings (
    id BIGSERIAL PRIMARY KEY,
    chunk_id BIGINT UNIQUE NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_embeddings_chunk FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_embedding_chunk_id ON embeddings(chunk_id);

-- Convert content columns from OID to TEXT if they were created as OIDs under Hibernate's @Lob annotation
-- =========================================================================
-- VERIFICATION QUERIES (Run these to inspect the DB state)
-- =========================================================================
-- 1. Verify database contents: Check whether content contains numeric OID values
--    SELECT id, content FROM chunks LIMIT 20;
--
-- 2. Verify Large Objects exist: Confirm whether actual text content is returned for a sample OID
--    SELECT convert_from(lo_get(17691), 'UTF8');

-- =========================================================================
-- PRE-MIGRATION BACKUP (Recommended for rollback support)
-- =========================================================================
-- Run these statements to back up your tables before running the updates:
-- CREATE TABLE IF NOT EXISTS backup_chunks AS SELECT * FROM chunks;
-- CREATE TABLE IF NOT EXISTS backup_pages AS SELECT * FROM pages;

-- =========================================================================
-- SAFE MIGRATION EXECUTION
-- =========================================================================
-- This script replaces numeric OID strings inside the TEXT content columns with their actual text data.
-- Only targets numeric strings (~ '^[0-9]+$') and checks if they point to valid large objects (lo_get is not null).

-- Update chunks table
UPDATE chunks
SET content = convert_from(lo_get(content::oid), 'UTF8')
WHERE content ~ '^[0-9]+$' AND lo_get(content::oid) IS NOT NULL;

-- Update pages table
UPDATE pages
SET content = convert_from(lo_get(content::oid), 'UTF8')
WHERE content ~ '^[0-9]+$' AND lo_get(content::oid) IS NOT NULL;

-- =========================================================================
-- ROLLBACK STRATEGY (If you need to restore the tables to their pre-migration state)
-- =========================================================================
-- Run these statements if you need to restore original data from the backups:
-- UPDATE chunks c SET content = b.content FROM backup_chunks b WHERE c.id = b.id;
-- UPDATE pages p SET content = b.content FROM backup_pages b WHERE p.id = b.id;
--
-- After verified, you can drop the backup tables:
-- DROP TABLE IF EXISTS backup_chunks;
-- DROP TABLE IF EXISTS backup_pages;
