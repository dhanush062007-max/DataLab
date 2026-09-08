-- Enable RLS on collection_forms
ALTER TABLE public.collection_forms ENABLE ROW LEVEL SECURITY;

-- 1. Allow everyone (including anonymous users) to view public, active forms
CREATE POLICY "Public forms are viewable by everyone."
ON public.collection_forms FOR SELECT
USING (visibility = 'public' AND is_active = true);

-- 2. Allow users to manage forms for datasets they own
CREATE POLICY "Users can manage forms for their own datasets."
ON public.collection_forms FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.datasets
    WHERE datasets.id = collection_forms.dataset_id
    AND datasets.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.datasets
    WHERE datasets.id = collection_forms.dataset_id
    AND datasets.owner_id = auth.uid()
  )
);
