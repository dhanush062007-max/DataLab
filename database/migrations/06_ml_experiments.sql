-- Migration: 06_ml_experiments.sql
-- Purpose: Adds feature_importances column to ml_experiments for Phase 2.3 Advanced ML

ALTER TABLE public.ml_experiments 
ADD COLUMN IF NOT EXISTS feature_importances JSONB DEFAULT '{}'::jsonb;
