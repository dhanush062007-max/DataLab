-- Migration: 04_semantic_types.sql
-- Purpose: Adds semantic type intelligence fields to dataset_columns for DataLab V2.

-- 1. Create the new ENUM types
CREATE TYPE column_semantic_type AS ENUM ('INTEGER', 'DECIMAL', 'BOOLEAN', 'CATEGORY', 'TAGS', 'SINGLE_CHOICE', 'ORDINAL_CHOICE', 'MULTIPLE_CHOICE', 'DATE', 'DATETIME', 'SHORT_TEXT', 'LONG_TEXT', 'IDENTIFIER', 'EMAIL', 'URL', 'UNKNOWN');
CREATE TYPE column_ml_role AS ENUM ('FEATURE', 'TARGET', 'IGNORE', 'IDENTIFIER');

-- 2. Add columns to dataset_columns
ALTER TABLE public.dataset_columns 
ADD COLUMN IF NOT EXISTS semantic_type column_semantic_type DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS ml_role column_ml_role DEFAULT 'FEATURE',
ADD COLUMN IF NOT EXISTS semantic_confidence DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS encoding_type TEXT DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
