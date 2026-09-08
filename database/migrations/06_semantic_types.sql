-- Migration 06: Add Semantic Types and ML Configs to Columns

-- 1. Semantic Type Enum
CREATE TYPE column_semantic_type AS ENUM (
    'INTEGER', 
    'DECIMAL', 
    'BOOLEAN', 
    'CATEGORY', 
    'TAGS', 
    'SINGLE_CHOICE', 
    'ORDINAL_CHOICE', 
    'MULTIPLE_CHOICE', 
    'DATE', 
    'DATETIME', 
    'SHORT_TEXT', 
    'LONG_TEXT', 
    'IDENTIFIER', 
    'TARGET',
    'UNKNOWN'
);

-- 2. ML Role Enum
CREATE TYPE column_ml_role AS ENUM (
    'FEATURE', 
    'TARGET', 
    'IGNORE'
);

-- 3. Encoding Type Enum
CREATE TYPE column_encoding_type AS ENUM (
    'NUMERIC_SCALED', 
    'ONE_HOT', 
    'MULTI_HOT', 
    'ORDINAL', 
    'TFIDF', 
    'EMBEDDING', 
    'NONE'
);

-- 4. Add columns to dataset_columns
ALTER TABLE public.dataset_columns 
ADD COLUMN IF NOT EXISTS semantic_type column_semantic_type DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS ml_role column_ml_role DEFAULT 'FEATURE',
ADD COLUMN IF NOT EXISTS encoding_type column_encoding_type DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS option_order JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS nlp_config JSONB DEFAULT '{}'::jsonb;
