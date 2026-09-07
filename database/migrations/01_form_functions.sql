-- 1. Function to fetch public form schema safely
CREATE OR REPLACE FUNCTION public.get_form_schema(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dataset_id UUID;
    v_is_active BOOLEAN;
    v_dataset_name TEXT;
    v_dataset_description TEXT;
    v_columns JSONB;
    v_result JSONB;
BEGIN
    -- Validate token
    SELECT dataset_id, is_active INTO v_dataset_id, v_is_active
    FROM public.collection_forms
    WHERE token = p_token;

    IF v_dataset_id IS NULL THEN
        RAISE EXCEPTION 'Invalid form token';
    END IF;

    IF NOT v_is_active THEN
        RAISE EXCEPTION 'This form is currently inactive';
    END IF;

    -- Get dataset details
    SELECT name, description INTO v_dataset_name, v_dataset_description
    FROM public.datasets
    WHERE id = v_dataset_id;

    -- Get columns schema
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'column_name', column_name,
            'display_name', display_name,
            'data_type', data_type,
            'required', required,
            'validation_rules', validation_rules,
            'position', position
        ) ORDER BY position
    ) INTO v_columns
    FROM public.dataset_columns
    WHERE dataset_id = v_dataset_id;

    -- Build response
    v_result := jsonb_build_object(
        'dataset_id', v_dataset_id,
        'name', v_dataset_name,
        'description', v_dataset_description,
        'columns', COALESCE(v_columns, '[]'::jsonb)
    );

    RETURN v_result;
END;
$$;

-- 2. Function to submit public form safely
CREATE OR REPLACE FUNCTION public.submit_form_response(p_token TEXT, p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dataset_id UUID;
    v_is_active BOOLEAN;
    v_record_id UUID;
BEGIN
    -- Validate token
    SELECT dataset_id, is_active INTO v_dataset_id, v_is_active
    FROM public.collection_forms
    WHERE token = p_token;

    IF v_dataset_id IS NULL THEN
        RAISE EXCEPTION 'Invalid form token';
    END IF;

    IF NOT v_is_active THEN
        RAISE EXCEPTION 'This form is currently inactive';
    END IF;

    -- Insert record
    INSERT INTO public.dataset_records (dataset_id, data)
    VALUES (v_dataset_id, p_data)
    RETURNING id INTO v_record_id;

    -- Increment row count
    UPDATE public.datasets
    SET row_count = row_count + 1,
        updated_at = NOW()
    WHERE id = v_dataset_id;

    RETURN jsonb_build_object('success', true, 'record_id', v_record_id);
END;
$$;
