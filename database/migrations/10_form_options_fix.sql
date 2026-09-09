-- Update function to include options in columns schema
CREATE OR REPLACE FUNCTION public.get_form_schema(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dataset_id UUID;
    v_is_active BOOLEAN;
    v_rate_limit JSONB;
    v_visibility VARCHAR;
    v_dataset_name TEXT;
    v_dataset_description TEXT;
    v_columns JSONB;
    v_result JSONB;
BEGIN
    -- Validate token
    SELECT dataset_id, is_active, rate_limit_settings, visibility INTO v_dataset_id, v_is_active, v_rate_limit, v_visibility
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
            'position', position,
            'semantic_type', semantic_type,
            'options', options
        ) ORDER BY position
    ) INTO v_columns
    FROM public.dataset_columns
    WHERE dataset_id = v_dataset_id;

    -- Build response
    v_result := jsonb_build_object(
        'dataset_id', v_dataset_id,
        'name', v_dataset_name,
        'description', v_dataset_description,
        'rate_limit_settings', v_rate_limit,
        'visibility', v_visibility,
        'columns', COALESCE(v_columns, '[]'::jsonb)
    );

    RETURN v_result;
END;
$$;
