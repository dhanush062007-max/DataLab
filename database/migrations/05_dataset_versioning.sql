-- Migration: 05_dataset_versioning.sql
-- Purpose: Adds versioning support to datasets and records for Phase 2.1 Data Intelligence

-- 1. Add active_version_id to datasets
ALTER TABLE public.datasets 
ADD COLUMN IF NOT EXISTS active_version_id UUID REFERENCES public.dataset_versions(id) ON DELETE SET NULL;

-- 2. Add version_id to dataset_records
ALTER TABLE public.dataset_records
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES public.dataset_versions(id) ON DELETE CASCADE;

-- 3. Create index for faster queries on version_id
CREATE INDEX IF NOT EXISTS idx_dataset_records_version_id ON public.dataset_records(version_id);
