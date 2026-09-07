-- ML Experiments Table
CREATE TABLE public.ml_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    model_name VARCHAR NOT NULL,
    algorithm VARCHAR NOT NULL,
    target_column VARCHAR NOT NULL,
    feature_columns JSONB NOT NULL,
    metrics JSONB,
    feature_importances JSONB,
    status VARCHAR DEFAULT 'TRAINING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ml_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own ML experiments" ON public.ml_experiments 
FOR ALL USING (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid())) WITH CHECK (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid()));
