-- Update create_trace function to accept image path parameters
CREATE OR REPLACE FUNCTION "public"."create_trace"(
    "p_user_id" "uuid", 
    "p_commit_sha" "text", 
    "p_branch" "text", 
    "p_scenario" "text", 
    "p_duration_ms" numeric, 
    "p_blob_path" "text", 
    "p_file_size_bytes" numeric, 
    "p_profile_type" "text", 
    "p_notes" "text", 
    "p_folder_id" "uuid", 
    "p_upload_source" "text", 
    "p_make_public" boolean,
    "p_light_image_path" text DEFAULT NULL,
    "p_dark_image_path" text DEFAULT NULL
) RETURNS "public"."traces"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_trace_id uuid;
    inserted_trace traces%ROWTYPE;
BEGIN
    -- Insert into traces table
    INSERT INTO public.traces (
        user_id,
        commit_sha,
        branch,
        scenario,
        duration_ms,
        blob_path,
        file_size_bytes,
        profile_type,
        notes,
        uploaded_at,
        folder_id,
        upload_source,
        light_image_path,
        dark_image_path
    )
    VALUES (
        p_user_id,
        p_commit_sha,
        p_branch,
        p_scenario,
        p_duration_ms,
        p_blob_path,
        p_file_size_bytes,
        p_profile_type,
        p_notes,
        NOW(),
        p_folder_id,
        p_upload_source,
        p_light_image_path,
        p_dark_image_path
    )
    RETURNING id INTO new_trace_id;

    -- If p_make_public is true, insert into trace_permissions
    IF p_make_public THEN
        INSERT INTO public.trace_permissions (
            trace_id,
            user_id, -- Assuming NULL user_id means public
            role,
            created_at,
            updated_at
        )
        VALUES (
            new_trace_id,
            NULL, 
            'viewer',
            NOW(),
            NOW()
        );
    END IF;

    -- Select the newly inserted trace to return it
    SELECT * INTO inserted_trace FROM public.traces WHERE id = new_trace_id;
    RETURN inserted_trace;

EXCEPTION
    WHEN OTHERS THEN
        -- It's good practice to log the specific error
        RAISE WARNING 'Error in create_trace: SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
        RAISE; -- Re-raise the exception
END;
$$;

ALTER FUNCTION "public"."create_trace"(
    "p_user_id" "uuid", 
    "p_commit_sha" "text", 
    "p_branch" "text", 
    "p_scenario" "text", 
    "p_duration_ms" numeric, 
    "p_blob_path" "text", 
    "p_file_size_bytes" numeric, 
    "p_profile_type" "text", 
    "p_notes" "text", 
    "p_folder_id" "uuid", 
    "p_upload_source" "text", 
    "p_make_public" boolean,
    "p_light_image_path" text,
    "p_dark_image_path" text
) OWNER TO "postgres";
