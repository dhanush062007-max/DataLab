-- Statistical Tests Table
CREATE TABLE public.statistical_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    test_type VARCHAR NOT NULL,
    variable_a VARCHAR NOT NULL,
    variable_b VARCHAR,
    group_by VARCHAR,
    test_statistic FLOAT,
    p_value FLOAT,
    degrees_of_freedom FLOAT,
    interpretation TEXT,
    raw_results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.statistical_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own statistical tests" ON public.statistical_tests 
FOR ALL USING (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid())) WITH CHECK (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid()));
