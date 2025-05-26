-- Drop the old create_trace function to resolve function overloading conflict
-- The old function had 12 parameters, the new one has 14 parameters
DROP FUNCTION IF EXISTS public.create_trace(
    uuid,  -- p_user_id
    text,  -- p_commit_sha
    text,  -- p_branch
    text,  -- p_scenario
    numeric,  -- p_duration_ms
    text,  -- p_blob_path
    numeric,  -- p_file_size_bytes
    text,  -- p_profile_type
    text,  -- p_notes
    uuid,  -- p_folder_id
    text,  -- p_upload_source
    boolean  -- p_make_public
);

-- The new function with image paths (14 parameters) will remain
-- It already has DEFAULT NULL for the image path parameters,
-- so existing calls will continue to work seamlessly
