-- Migration: 07_optimize_records_indexes.sql
-- Purpose: Adds composite indexes to fix 504 Gateway Timeout during chunked API pagination and frontend sorting

-- 1. Index for Python Backend Chunked Pagination (order by id)
CREATE INDEX IF NOT EXISTS idx_dataset_records_pagination 
ON public.dataset_records (dataset_id, version_id, id);

-- 2. Index for Frontend Sample Fetching (order by created_at DESC)
CREATE INDEX IF NOT EXISTS idx_dataset_records_recent 
ON public.dataset_records (dataset_id, version_id, created_at DESC);
