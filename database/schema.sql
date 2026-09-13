-- DataLab Initial Schema Migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Extends auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to automatically create profile for new auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Datasets Table
CREATE TYPE dataset_source_type AS ENUM ('CSV', 'EXCEL', 'MANUAL', 'FORM');
CREATE TYPE dataset_status AS ENUM ('PENDING', 'READY', 'ERROR');

CREATE TABLE public.datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    source_type dataset_source_type DEFAULT 'MANUAL',
    status dataset_status DEFAULT 'PENDING',
    row_count INTEGER DEFAULT 0,
    column_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Dataset Columns Table
CREATE TYPE column_data_type AS ENUM ('INTEGER', 'DECIMAL', 'TEXT', 'CATEGORY', 'BOOLEAN', 'DATE', 'DATETIME', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE');
CREATE TYPE column_semantic_type AS ENUM ('INTEGER', 'DECIMAL', 'BOOLEAN', 'CATEGORY', 'TAGS', 'SINGLE_CHOICE', 'ORDINAL_CHOICE', 'MULTIPLE_CHOICE', 'DATE', 'DATETIME', 'SHORT_TEXT', 'LONG_TEXT', 'IDENTIFIER', 'EMAIL', 'URL', 'UNKNOWN');
CREATE TYPE column_ml_role AS ENUM ('FEATURE', 'TARGET', 'IGNORE', 'IDENTIFIER');

CREATE TABLE public.dataset_columns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    data_type column_data_type DEFAULT 'TEXT',
    semantic_type column_semantic_type DEFAULT 'UNKNOWN',
    ml_role column_ml_role DEFAULT 'FEATURE',
    semantic_confidence DECIMAL(5,2) DEFAULT 0.0,
    encoding_type TEXT DEFAULT 'NONE',
    options JSONB DEFAULT '[]'::jsonb,
    required BOOLEAN DEFAULT false,
    validation_rules JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dataset_id, column_name)
);

-- 4. Dataset Records Table
-- Using JSONB to store flexible record data for horizontal scalability
CREATE TABLE public.dataset_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dataset_records_dataset_id ON public.dataset_records(dataset_id);
-- Indexing the JSONB column for faster lookups inside records
CREATE INDEX idx_dataset_records_data ON public.dataset_records USING GIN (data);

-- 5. Dataset Versions Table (for Data Cleaning operations)
CREATE TABLE public.dataset_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    source_version_id UUID REFERENCES public.dataset_versions(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Collection Forms Table
CREATE TABLE public.collection_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    rate_limit_settings JSONB DEFAULT '{"max_per_minute": 5}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Jobs Table (For Background Processing)
CREATE TYPE job_type AS ENUM ('IMPORT', 'CLEANING', 'EDA', 'ML', 'REPORT', 'EXPORT');
CREATE TYPE job_status AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
    type job_type NOT NULL,
    status job_status DEFAULT 'QUEUED',
    metadata JSONB DEFAULT '{}'::jsonb,
    result JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT
);

-- 8. ML Experiments Table
CREATE TYPE ml_problem_type AS ENUM ('CLASSIFICATION', 'REGRESSION', 'CLUSTERING');
CREATE TYPE ml_experiment_status AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE public.ml_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    version_id UUID REFERENCES public.dataset_versions(id) ON DELETE SET NULL,
    target TEXT,
    features JSONB NOT NULL,
    problem_type ml_problem_type NOT NULL,
    algorithm TEXT NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb,
    feature_importances JSONB DEFAULT '{}'::jsonb,
    status ml_experiment_status DEFAULT 'QUEUED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 9. Assistant Logs Table (For AI Training)
CREATE TABLE public.assistant_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Setup

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Datasets Policies
CREATE POLICY "Users can view their own datasets" ON public.datasets FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert their own datasets" ON public.datasets FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own datasets" ON public.datasets FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete their own datasets" ON public.datasets FOR DELETE USING (auth.uid() = owner_id);

-- Dataset Columns Policies
CREATE POLICY "Users can access columns for their datasets" ON public.dataset_columns 
FOR ALL USING (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid()));

-- Dataset Records Policies
CREATE POLICY "Users can access records for their datasets" ON public.dataset_records 
FOR ALL USING (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid()));

-- Service Role (Backend API) bypasses RLS implicitly if configured correctly, 
-- but explicitly allowing public form submissions via token involves edge functions or a secure API endpoint. 
-- The backend FastAPI using SERVICE_ROLE key will handle form submissions safely.

-- Dataset Versions Policies
CREATE POLICY "Users can access versions for their datasets" ON public.dataset_versions 
FOR ALL USING (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid()));

-- Collection Forms Policies
CREATE POLICY "Users can access collection forms for their datasets" ON public.collection_forms 
FOR ALL USING (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid()));

-- Jobs Policies
CREATE POLICY "Users can access their own jobs" ON public.jobs FOR ALL USING (auth.uid() = user_id);

-- ML Experiments Policies
CREATE POLICY "Users can access their own ML experiments" ON public.ml_experiments 
FOR ALL USING (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid()));
CREATE POLICY "Users can access experiments for their datasets" ON public.ml_experiments 
FOR ALL USING (dataset_id IN (SELECT id FROM public.datasets WHERE owner_id = auth.uid()));

-- Assistant Logs Policies
CREATE POLICY "Users can insert their own assistant logs" ON public.assistant_logs 
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own assistant logs" ON public.assistant_logs 
FOR SELECT USING (auth.uid() = user_id);

-- Phase 2.1 Dataset Versioning Extensions
ALTER TABLE public.datasets ADD COLUMN active_version_id UUID REFERENCES public.dataset_versions(id) ON DELETE SET NULL;
ALTER TABLE public.dataset_records ADD COLUMN version_id UUID REFERENCES public.dataset_versions(id) ON DELETE CASCADE;
CREATE INDEX idx_dataset_records_version_id ON public.dataset_records(version_id);
