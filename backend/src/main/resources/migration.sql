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
DO $$
DECLARE
    v_chunk_type text;
    v_page_type text;
BEGIN
    -- Check type of chunks.content
    SELECT data_type INTO v_chunk_type 
    FROM information_schema.columns 
    WHERE table_name = 'chunks' AND column_name = 'content';
    
    IF v_chunk_type = 'oid' OR v_chunk_type = 'USER-DEFINED' THEN
        ALTER TABLE chunks ADD COLUMN temp_content TEXT;
        UPDATE chunks SET temp_content = convert_from(lo_get(content::oid), 'UTF8') WHERE content IS NOT NULL;
        ALTER TABLE chunks DROP COLUMN content;
        ALTER TABLE chunks RENAME COLUMN temp_content TO content;
        ALTER TABLE chunks ALTER COLUMN content SET NOT NULL;
        RAISE NOTICE 'Converted chunks.content from OID to TEXT';
    END IF;

    -- Check type of pages.content
    SELECT data_type INTO v_page_type 
    FROM information_schema.columns 
    WHERE table_name = 'pages' AND column_name = 'content';
    
    IF v_page_type = 'oid' OR v_page_type = 'USER-DEFINED' THEN
        ALTER TABLE pages ADD COLUMN temp_content TEXT;
        UPDATE pages SET temp_content = convert_from(lo_get(content::oid), 'UTF8') WHERE content IS NOT NULL;
        ALTER TABLE pages DROP COLUMN content;
        ALTER TABLE pages RENAME COLUMN temp_content TO content;
        RAISE NOTICE 'Converted pages.content from OID to TEXT';
    END IF;
END;
$$;
