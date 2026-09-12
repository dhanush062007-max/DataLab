-- RPC Function to search entire dataset records for a specific keyword in milliseconds
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION search_dataset_records(p_dataset_id uuid, p_term text)
RETURNS TABLE (data jsonb) AS $$
BEGIN
    RETURN QUERY
    SELECT dr.data
    FROM dataset_records dr
    WHERE dr.dataset_id = p_dataset_id
    AND dr.data::text ILIKE '%' || p_term || '%'
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
