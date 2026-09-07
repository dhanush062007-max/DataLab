-- Add active_version_id to datasets to track the current cleaned version
ALTER TABLE public.datasets
ADD COLUMN IF NOT EXISTS active_version_id UUID REFERENCES public.dataset_versions(id) ON DELETE SET NULL;

-- Add version_id to dataset_records to allow non-destructive data cleaning
ALTER TABLE public.dataset_records
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES public.dataset_versions(id) ON DELETE CASCADE;

-- Add an index for faster lookups by version
CREATE INDEX IF NOT EXISTS idx_dataset_records_version_id ON public.dataset_records(version_id);
