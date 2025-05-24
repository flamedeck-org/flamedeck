

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."trace_role" AS ENUM (
    'viewer',
    'editor',
    'owner'
);


ALTER TYPE "public"."trace_role" OWNER TO "postgres";


CREATE TYPE "public"."trace_with_owner" AS (
	"id" "uuid",
	"user_id" "uuid",
	"uploaded_at" timestamp with time zone,
	"commit_sha" "text",
	"branch" "text",
	"scenario" "text",
	"device_model" "text",
	"duration_ms" integer,
	"blob_path" "text",
	"file_size_bytes" bigint,
	"notes" "text",
	"profile_type" "text",
	"owner" "jsonb",
	"folder_id" "uuid"
);


ALTER TYPE "public"."trace_with_owner" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_owner_permission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.trace_permissions (trace_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_owner_permission"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_trace_permission"("p_trace_id" "uuid", "p_user_id" "uuid", "min_role" "public"."trace_role") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  user_role public.trace_role;
  public_role public.trace_role;
  has_permission boolean := false;
BEGIN
  -- Check for specific user permission
  SELECT role INTO user_role
  FROM public.trace_permissions
  WHERE trace_id = p_trace_id AND user_id = p_user_id;

  -- Check for public permission
  SELECT role INTO public_role
  FROM public.trace_permissions
  WHERE trace_id = p_trace_id AND user_id IS NULL;

  -- Define role hierarchy (owner > editor > viewer) and check against minimum required role
  -- Check specific user role first
  IF user_role IS NOT NULL THEN
    IF min_role = 'owner' AND user_role = 'owner' THEN
      has_permission := true;
    ELSIF min_role = 'editor' AND (user_role = 'editor' OR user_role = 'owner') THEN
      has_permission := true;
    ELSIF min_role = 'viewer' AND (user_role = 'viewer' OR user_role = 'editor' OR user_role = 'owner') THEN
      has_permission := true;
    END IF;
  END IF;

  -- If no specific permission grants access, check public role
  IF NOT has_permission AND public_role IS NOT NULL THEN
     IF min_role = 'viewer' AND (public_role = 'viewer' OR public_role = 'editor' OR public_role = 'owner') THEN
       -- Note: We only check for 'viewer' level public access as 'editor'/'owner' shouldn't typically be public roles.
       -- Adjust this logic if public editors are needed, but be cautious.
       -- The owner_must_be_specific_user constraint prevents public 'owner'.
       has_permission := true;
     -- Add similar checks here if public 'editor' access is desired
     -- ELSIF min_role = 'editor' AND (public_role = 'editor' OR public_role = 'owner') THEN
     --   has_permission := true;
     END IF;
  END IF;

  RETURN has_permission;
END;
$$;


ALTER FUNCTION "public"."check_trace_permission"("p_trace_id" "uuid", "p_user_id" "uuid", "min_role" "public"."trace_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_api_key"("p_description" "text", "p_scopes" "text"[]) RETURNS TABLE("api_key_id" "uuid", "api_key_plaintext" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_caller_user_id UUID := auth.uid();
    v_plaintext_key TEXT;
    v_hashed_key TEXT;
    v_key_id UUID;
BEGIN
    -- Set search_path INSIDE the function for the SECURITY DEFINER context
    -- Include pg_catalog (built-ins), public (for INSERT target), and extensions (for pgcrypto)
    SET search_path = pg_catalog, public, extensions;

    -- Check if the caller is authenticated
    IF v_caller_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to create an API key.';
    END IF;

    -- 1. Generate the plaintext key (rely on internal search_path finding it in 'extensions')
    v_plaintext_key := 'sk_' || encode(gen_random_bytes(32), 'hex');

    -- 2. Hash the key (rely on internal search_path finding it in 'extensions')
    v_hashed_key := crypt(v_plaintext_key, gen_salt('bf'));

    -- 3. Insert into the api_keys table (which is in 'public')
    INSERT INTO public.api_keys (user_id, description, scopes, key_hash, is_active)
    VALUES (v_caller_user_id, p_description, p_scopes, v_hashed_key, true)
    RETURNING id INTO v_key_id;

    -- 4. Return the new key ID and the PLAINTEXT key
    RETURN QUERY SELECT v_key_id, v_plaintext_key;

EXCEPTION
    WHEN unique_violation THEN
        RAISE WARNING 'Unique constraint violation during key generation/insertion.';
        RAISE; -- Re-raise
    WHEN others THEN
        RAISE WARNING 'Error in create_api_key for user %: %', v_caller_user_id, SQLERRM;
        RAISE;
END;
$$;


ALTER FUNCTION "public"."create_api_key"("p_description" "text", "p_scopes" "text"[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."traces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "commit_sha" "text",
    "branch" "text",
    "scenario" "text",
    "duration_ms" integer,
    "blob_path" "text" NOT NULL,
    "file_size_bytes" bigint,
    "notes" "text",
    "profile_type" "text",
    "folder_id" "uuid",
    "updated_at" timestamp with time zone,
    "upload_source" "text" DEFAULT 'web'::"text" NOT NULL,
    "metadata" "jsonb",
    "expires_at" timestamp with time zone,
    CONSTRAINT "traces_upload_source_check" CHECK (("upload_source" = ANY (ARRAY['api'::"text", 'web'::"text"])))
);


ALTER TABLE "public"."traces" OWNER TO "postgres";


COMMENT ON COLUMN "public"."traces"."updated_at" IS 'Timestamp of the last modification to the trace record';



COMMENT ON COLUMN "public"."traces"."upload_source" IS 'Indicates whether the trace was uploaded via the API or the web UI.';



COMMENT ON COLUMN "public"."traces"."expires_at" IS 'Timestamp when the trace should be automatically deleted (for retention policies). NULL means no expiration.';



CREATE OR REPLACE FUNCTION "public"."create_trace"("p_user_id" "uuid", "p_commit_sha" "text", "p_branch" "text", "p_scenario" "text", "p_duration_ms" numeric, "p_blob_path" "text", "p_file_size_bytes" numeric, "p_profile_type" "text", "p_notes" "text", "p_folder_id" "uuid", "p_upload_source" "text", "p_make_public" boolean) RETURNS "public"."traces"
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
        upload_source
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
        p_upload_source
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


ALTER FUNCTION "public"."create_trace"("p_user_id" "uuid", "p_commit_sha" "text", "p_branch" "text", "p_scenario" "text", "p_duration_ms" numeric, "p_blob_path" "text", "p_file_size_bytes" numeric, "p_profile_type" "text", "p_notes" "text", "p_folder_id" "uuid", "p_upload_source" "text", "p_make_public" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_folder_contents_by_ids"("p_folder_ids_to_delete" "uuid"[], "p_trace_ids_to_delete" "uuid"[], "p_original_folder_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_original_owner_id uuid;
    v_caller_uid uuid := auth.uid(); -- Get the ID of the user MAKING the call
BEGIN
    -- Check 1: Verify the CALLER owns the ORIGINAL top-level folder.
    SELECT user_id INTO v_original_owner_id FROM public.folders WHERE id = p_original_folder_id;

    IF NOT FOUND THEN
         RAISE EXCEPTION 'Original folder % not found during final delete confirmation.', p_original_folder_id USING ERRCODE = 'PGRST';
    END IF;

    -- Compare the folder owner against the CALLER'S ID
    IF v_original_owner_id != v_caller_uid THEN
        RAISE EXCEPTION 'Permission denied: User % is not the owner of original folder %.', v_caller_uid, p_original_folder_id USING ERRCODE = 'PGRST';
    END IF;

    -- Proceed with deletion only if the check passes

    -- Delete Traces first
    IF p_trace_ids_to_delete IS NOT NULL AND array_length(p_trace_ids_to_delete, 1) > 0 THEN
        DELETE FROM public.traces WHERE id = ANY(p_trace_ids_to_delete);
    END IF;

    -- Delete Folders
    IF p_folder_ids_to_delete IS NOT NULL AND array_length(p_folder_ids_to_delete, 1) > 0 THEN
        DELETE FROM public.folders WHERE id = ANY(p_folder_ids_to_delete);
    END IF;
END;
$$;


ALTER FUNCTION "public"."delete_folder_contents_by_ids"("p_folder_ids_to_delete" "uuid"[], "p_trace_ids_to_delete" "uuid"[], "p_original_folder_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_folder_contents_by_ids"("p_folder_ids_to_delete" "uuid"[], "p_trace_ids_to_delete" "uuid"[], "p_original_folder_id" "uuid") IS 'Deletes specified folders and traces by ID after verifying caller owns the original parent folder. Meant to be called after get_recursive_folder_contents. Uses SECURITY DEFINER.';



CREATE OR REPLACE FUNCTION "public"."delete_old_ai_continuations"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.ai_chat_continuations
  WHERE created_at < now() - interval '15 minutes';
END;
$$;


ALTER FUNCTION "public"."delete_old_ai_continuations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_trace_limits_and_set_expiration"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  plan_retention_days INTEGER;
  plan_monthly_upload_limit INTEGER;
  plan_total_trace_limit INTEGER; -- <<< Variable for total limit
  current_uploads_used INTEGER;
  current_total_traces BIGINT; -- <<< Variable for current trace count (use BIGINT for safety)
  v_subscription_id UUID;
  v_current_period_end TIMESTAMPTZ;
  v_user_id UUID := NEW.user_id; -- Get user_id from inserted row
BEGIN
  -- Fetch subscription details AND plan limits
  SELECT
    p.retention_days,
    p.monthly_upload_limit,
    p.total_trace_limit, -- <<< Fetch total limit from plan
    us.monthly_uploads_used,
    us.id,
    us.current_period_end
  INTO
    plan_retention_days,
    plan_monthly_upload_limit,
    plan_total_trace_limit, -- <<< Store total limit
    current_uploads_used,
    v_subscription_id,
    v_current_period_end
  FROM user_subscriptions us
  JOIN subscription_plans p ON us.plan_id = p.id
  WHERE us.user_id = v_user_id
  AND us.status IN ('active', 'trialing', 'free')
  LIMIT 1;

  -- Handle missing subscription (same as before)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User subscription not found (ID: %). Cannot insert trace.', v_user_id
      USING ERRCODE = 'P0001';
  END IF;


  -- --- Perform Monthly Upload Limit Check ---
  IF plan_monthly_upload_limit IS NOT NULL THEN
      IF NOW() > v_current_period_end THEN
          RAISE WARNING '[Limit Check] Subscription period ended for user % during trace insert. Resetting monthly count.', v_user_id;
          current_uploads_used := 0;
          UPDATE user_subscriptions SET monthly_uploads_used = 0 WHERE id = v_subscription_id;
      END IF;

      IF current_uploads_used >= plan_monthly_upload_limit THEN
          RAISE EXCEPTION 'Monthly upload limit (%) reached for user %.', plan_monthly_upload_limit, v_user_id
              USING HINT = 'Upgrade your plan or wait until the next cycle.',
                    ERRCODE = 'P0002'; -- Monthly limit exceeded
      END IF;
  END IF;
  -- --- End Monthly Upload Limit Check ---


  -- --- Perform Total Trace Limit Check ---
  IF plan_total_trace_limit IS NOT NULL THEN
      -- Get the current count of traces for this user
      SELECT count(*)
      INTO current_total_traces
      FROM traces
      WHERE user_id = v_user_id;

      RAISE NOTICE '[Limit Check] User %: Current total traces = %, Plan total limit = %', v_user_id, current_total_traces, plan_total_trace_limit;

      IF current_total_traces >= plan_total_trace_limit THEN
           RAISE EXCEPTION 'Total trace storage limit (%) reached for user %.', plan_total_trace_limit, v_user_id
              USING HINT = 'Delete older traces or upgrade your plan.',
                    ERRCODE = 'P0003'; -- <<< New error code for Total limit exceeded
      END IF;
  END IF;
  -- --- End Total Trace Limit Check ---


  -- --- Set Expiration Date ---
  IF plan_retention_days IS NOT NULL THEN
    NEW.expires_at := NOW() + (plan_retention_days * interval '1 day');
  ELSE
    NEW.expires_at := NULL;
  END IF;
  -- --- End Set Expiration Date ---

  -- If all checks passed, allow the insert
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_trace_limits_and_set_expiration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_sessions_for_trace"("in_trace_id" "text") RETURNS TABLE("sessionId" "text", "startedAt" "text", "messageCount" bigint)
    LANGUAGE "sql" STABLE
    AS $_$
SELECT
    cm.session_id::TEXT AS "sessionId",         -- Cast UUID to TEXT
    MIN(cm.created_at)::TEXT AS "startedAt",    -- Cast TIMESTAMPTZ to TEXT (ISO 8601 string)
    COUNT(cm.id) AS "messageCount"
FROM
    public.chat_messages cm
WHERE
    cm.user_id = auth.uid()       -- Use Supabase's auth.uid() function
    AND cm.trace_id = $1::UUID  -- Use $1 for the in_trace_id parameter
GROUP BY
    cm.session_id
ORDER BY
    MIN(cm.created_at) DESC; -- Order by the actual timestamp before casting
$_$;


ALTER FUNCTION "public"."get_chat_sessions_for_trace"("in_trace_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_sessions_for_trace"("in_user_id" "text", "in_trace_id" "text") RETURNS TABLE("sessionId" "text", "startedAt" "text", "messageCount" bigint)
    LANGUAGE "sql" STABLE
    AS $_$
SELECT
    cm.session_id::TEXT AS "sessionId",         -- Cast UUID to TEXT
    MIN(cm.created_at)::TEXT AS "startedAt",    -- Cast TIMESTAMPTZ to TEXT (ISO 8601 string)
    COUNT(cm.id) AS "messageCount"
FROM
    public.chat_messages cm
WHERE
    cm.user_id = $1::UUID       -- Use $1 for the first parameter
    AND cm.trace_id = $2::UUID  -- Use $2 for the second parameter
GROUP BY
    cm.session_id
ORDER BY
    MIN(cm.created_at) DESC; -- Order by the actual timestamp before casting
$_$;


ALTER FUNCTION "public"."get_chat_sessions_for_trace"("in_user_id" "text", "in_trace_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_folder_view_data"("p_user_id" "uuid", "p_folder_id" "uuid" DEFAULT NULL::"uuid", "p_page" integer DEFAULT 0, "p_limit" integer DEFAULT 10, "p_search_query" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    v_path jsonb;
    v_current_folder jsonb;
    v_child_folders jsonb;
    v_child_traces jsonb;
    v_offset integer;
    v_search_term text;
BEGIN
    -- Calculate offset for trace pagination
    v_offset := p_page * p_limit;
    -- Prepare search term for ILIKE (handle null/empty search query)
    v_search_term := NULL;
    IF p_search_query IS NOT NULL AND trim(p_search_query) != '' THEN
        v_search_term := '%' || trim(p_search_query) || '%';
    END IF;

    -- 1. Fetch Ancestor Path (Breadcrumbs) using Recursive CTE
    -- Relies on RLS on 'folders' table to restrict access
    WITH RECURSIVE folder_path AS (
        -- Anchor member: Select the starting folder
        SELECT id, name, parent_folder_id, 1 as level -- Add level for potential ordering later if needed
        FROM folders
        WHERE id = p_folder_id
          AND p_folder_id IS NOT NULL -- Only run if not root

        UNION ALL

        -- Recursive member: Select the parent of the previous level
        SELECT f.id, f.name, f.parent_folder_id, fp.level + 1
        FROM folders f
        JOIN folder_path fp ON f.id = fp.parent_folder_id
        -- RLS implicitly handles user access here
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY level ASC), '[]'::jsonb)
    -- Order by level ASC puts the direct parent first, root last in the array.
    -- Client will still need to reverse this to get Root -> Parent -> Current
    INTO v_path
    FROM folder_path;


    -- 2. Fetch Current Folder Details
    -- Relies on RLS on 'folders' table
    SELECT COALESCE(jsonb_build_object('id', id, 'name', name, 'parent_folder_id', parent_folder_id, 'created_at', created_at, 'updated_at', updated_at), 'null'::jsonb)
    INTO v_current_folder
    FROM folders
    WHERE id = p_folder_id; -- RLS handles user access

    -- 3. Fetch Child Folders
    -- Applies search to name if v_search_term is not NULL
    -- Filters by parent_folder_id if not searching
    -- Relies on RLS on 'folders' table
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'created_at', created_at, 'updated_at', updated_at) ORDER BY name ASC), '[]'::jsonb)
    INTO v_child_folders
    FROM folders f -- Alias added for clarity
    WHERE
        (
            -- If searching: Match folder name globally (or scope if needed)
            v_search_term IS NOT NULL AND f.name ILIKE v_search_term
            -- RLS ensures user can only see folders they have access to that match the name
            -- NOTE: As discussed, this searches ALL folders the user can see by name.
            -- To scope search ONLY within the *current* p_folder_id, add this condition:
            -- AND ( (p_folder_id IS NULL AND f.parent_folder_id IS NULL) OR (f.parent_folder_id = p_folder_id) )
        )
        OR
        (
            -- If not searching: Match parent folder ID
            v_search_term IS NULL AND
            ( (p_folder_id IS NULL AND f.parent_folder_id IS NULL) OR (f.parent_folder_id = p_folder_id) )
            -- RLS ensures user can only see child folders they have access to in the target parent
        );


    -- 4. Fetch Child Traces (Paginated)
    -- Uses p_user_id for explicit ownership/permission checks as per trace access logic
    -- Applies search OR folder filtering
    SELECT COALESCE(jsonb_agg(t_agg.trace_data ORDER BY t_agg.uploaded_at DESC), '[]'::jsonb)
    INTO v_child_traces
    FROM (
        SELECT
            jsonb_build_object(
                'id', t.id, 'user_id', t.user_id, 'uploaded_at', t.uploaded_at, 'commit_sha', t.commit_sha,
                'branch', t.branch, 'scenario', t.scenario, 'metadata', t.metadata, 'duration_ms', t.duration_ms,
                'blob_path', t.blob_path, 'file_size_bytes', t.file_size_bytes, 'notes', t.notes, 'profile_type', t.profile_type,
                'folder_id', t.folder_id,
                'updated_at', t.updated_at,
                'expires_at', t.expires_at,
                'owner', jsonb_build_object(
                    'id', up.id, 'username', up.username, 'avatar_url', up.avatar_url,
                    'first_name', up.first_name, 'last_name', up.last_name
                )
            ) as trace_data,
            t.uploaded_at, -- Keep for secondary sort
            t.updated_at  -- Keep for primary sort
        FROM traces t
        LEFT JOIN user_profiles up ON t.user_id = up.id
        WHERE
            -- Explicit Access Check (User owns OR has permission)
            (t.user_id = p_user_id OR EXISTS (
                SELECT 1 FROM trace_permissions tp WHERE tp.trace_id = t.id AND tp.user_id = p_user_id
            ))
            -- Combined Folder/Search Logic
            AND (
                ( v_search_term IS NULL -- If NOT searching
                  AND ( (p_folder_id IS NULL AND t.folder_id IS NULL) OR (t.folder_id = p_folder_id) ) -- Match folder
                ) OR
                ( v_search_term IS NOT NULL -- If searching
                  -- Match any searchable field
                  AND ( t.scenario ILIKE v_search_term OR t.notes ILIKE v_search_term OR t.branch ILIKE v_search_term OR t.commit_sha ILIKE v_search_term )
                )
            )
        -- RLS on 'traces' and 'trace_permissions' provides the base security layer
        ORDER BY t.updated_at DESC NULLS LAST, t.uploaded_at DESC 
        LIMIT p_limit
        OFFSET v_offset
    ) t_agg;

    -- 5. Combine results into a single JSON object (No totalTraceCount)
    RETURN jsonb_build_object(
        'path', v_path,
        'currentFolder', v_current_folder,
        'childFolders', v_child_folders,
        'childTraces', v_child_traces
    );

END;$$;


ALTER FUNCTION "public"."get_folder_view_data"("p_user_id" "uuid", "p_folder_id" "uuid", "p_page" integer, "p_limit" integer, "p_search_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_trace_details"("trace_uuid" "uuid") RETURNS TABLE("id" "uuid", "blob_path" "text")
    LANGUAGE "sql" STABLE
    AS $$
  -- Select only id and blob_path from traces.
  -- RLS policies for the 'anon' role MUST allow this select.
  SELECT
    t.id,
    t.blob_path
  FROM public.traces t
  WHERE t.id = trace_uuid;
$$;


ALTER FUNCTION "public"."get_public_trace_details"("trace_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recursive_folder_contents"("folder_id_to_check" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_owner_id uuid;
  v_caller_uid uuid := auth.uid(); -- Get the ID of the user MAKING the call
  v_folder_ids uuid[];
  v_trace_ids uuid[];
  v_blob_paths text[];
  result jsonb;
BEGIN
  -- 1. Verify the CALLER owns the top-level folder
  SELECT user_id INTO v_owner_id FROM public.folders WHERE id = folder_id_to_check;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Folder not found: %', folder_id_to_check USING ERRCODE = 'PGRST', HINT = 'Check folder ID';
  END IF;

  -- Compare the folder owner against the CALLER'S ID
  IF v_owner_id != v_caller_uid THEN
    RAISE EXCEPTION 'Permission denied: User % is not the owner of folder %', v_caller_uid, folder_id_to_check USING ERRCODE = 'PGRST', HINT = 'Permission denied on target folder';
  END IF;

  -- 2. Find all descendant folders (including the starting one)
  WITH RECURSIVE descendant_folders AS (
    SELECT id FROM public.folders WHERE id = folder_id_to_check
    UNION ALL
    SELECT f.id FROM public.folders f
    INNER JOIN descendant_folders df ON f.parent_folder_id = df.id
  )
  SELECT array_agg(id) INTO v_folder_ids FROM descendant_folders;

  -- 3. Find ACCESSIBLE traces within these folders and their blob paths
  SELECT
    array_agg(t.id),
    array_agg(t.blob_path) FILTER (WHERE t.blob_path IS NOT NULL)
  INTO
    v_trace_ids,
    v_blob_paths
  FROM public.traces t
  WHERE
    t.folder_id = ANY(v_folder_ids)
    -- Check access against the CALLER'S ID (auth.uid())
    AND (
      t.user_id = v_caller_uid -- Caller owns the trace
      OR EXISTS ( -- Or caller has explicit permission
          SELECT 1
          FROM public.trace_permissions tp
          WHERE tp.trace_id = t.id AND tp.user_id = v_caller_uid
      )
    );

  -- Ensure arrays are initialized as empty '{}'
  v_folder_ids := COALESCE(v_folder_ids, '{}');
  v_trace_ids := COALESCE(v_trace_ids, '{}');
  v_blob_paths := COALESCE(v_blob_paths, '{}');

  -- 4. Build the JSON result object
  result := jsonb_build_object(
    'folder_ids', v_folder_ids,
    'trace_ids', v_trace_ids,
    'blob_paths', v_blob_paths
  );

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_recursive_folder_contents"("folder_id_to_check" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_recursive_folder_contents"("folder_id_to_check" "uuid") IS 'Checks caller''s permission on a folder and returns IDs/paths of all recursive contents (folders, accessible traces). Does not delete.';



CREATE OR REPLACE FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer) RETURNS SETOF "public"."trace_with_owner"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    t.uploaded_at,
    t.commit_sha,
    t.branch,
    t.scenario,
    t.metadata,
    t.duration_ms,
    t.blob_path,
    t.file_size_bytes,
    t.notes,
    t.profile_type,
    -- Fetch owner details as JSONB, handle null owner
    CASE 
        WHEN up.id IS NOT NULL THEN jsonb_build_object(
            'id', up.id, 
            'username', up.username, 
            'avatar_url', up.avatar_url, 
            'first_name', up.first_name, 
            'last_name', up.last_name
        ) 
        ELSE null 
    END as owner
  FROM traces t
  LEFT JOIN user_profiles up ON t.user_id = up.id -- Join to get owner info
  WHERE 
    t.user_id = p_user_id -- User is the owner
    OR EXISTS ( -- Or user has an explicit permission
       SELECT 1 FROM trace_permissions tp 
       WHERE tp.trace_id = t.id AND tp.user_id = p_user_id
    )
  ORDER BY t.uploaded_at DESC
  OFFSET p_offset
  LIMIT p_limit;
END;$$;


ALTER FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer, "p_search_query" "text", "p_folder_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "uploaded_at" timestamp with time zone, "commit_sha" "text", "branch" "text", "scenario" "text", "device_model" "text", "duration_ms" integer, "blob_path" "text", "file_size_bytes" bigint, "notes" "text", "profile_type" "text", "owner" "jsonb", "folder_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$BEGIN
  RETURN QUERY
  SELECT
    t.id, t.user_id, t.uploaded_at, t.commit_sha, t.branch, t.scenario, t.metadata,
    t.duration_ms, t.blob_path, t.file_size_bytes, t.notes, t.profile_type,
    jsonb_build_object(
        'id', up.id, 'username', up.username, 'avatar_url', up.avatar_url,
        'first_name', up.first_name, 'last_name', up.last_name
    ) AS owner,
    t.folder_id,
    t.updated_at
  FROM traces t
  LEFT JOIN user_profiles up ON t.user_id = up.id
  WHERE
    -- 1. Access Check (user owns or has permission)
    (
      t.user_id = p_user_id
      OR EXISTS (
          SELECT 1 FROM trace_permissions tp
          WHERE tp.trace_id = t.id AND tp.user_id = p_user_id
      )
    )
    -- 2. Combined Folder and Search Logic
    AND (
        -- Condition A: Apply FOLDER filtering when NOT searching
        ( (p_search_query IS NULL OR p_search_query = '') -- Check if NOT searching
          AND
          ( (p_folder_id IS NULL AND t.folder_id IS NULL) -- Match root folder
            OR
            (p_folder_id IS NOT NULL AND t.folder_id = p_folder_id) -- Match specific folder
          )
        )
        OR
        -- Condition B: Apply SEARCH filtering when searching (ignore folder)
        ( (p_search_query IS NOT NULL AND p_search_query != '') -- Check IF searching
          AND
          ( -- Actual search conditions
            t.scenario ILIKE ('%' || p_search_query || '%') OR
            t.notes ILIKE ('%' || p_search_query || '%') OR
            t.branch ILIKE ('%' || p_search_query || '%') OR
            t.commit_sha ILIKE ('%' || p_search_query || '%')
          )
        )
    )
   -- Consider ordering by updated_at primarily
  ORDER BY t.updated_at DESC NULLS LAST, t.uploaded_at DESC
  LIMIT p_limit OFFSET p_offset;
END;$$;


ALTER FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer, "p_search_query" "text", "p_folder_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_count INT;
BEGIN
  SELECT count(*)
  INTO total_count
  FROM traces t
  WHERE 
    t.user_id = p_user_id -- User is the owner
    OR EXISTS ( -- Or user has an explicit permission
      SELECT 1 FROM trace_permissions tp 
      WHERE tp.trace_id = t.id AND tp.user_id = p_user_id
    );
  RETURN total_count;
END;
$$;


ALTER FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid", "p_search_query" "text", "p_folder_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    total_count integer;
BEGIN
  SELECT count(*)
  INTO total_count
  FROM traces t
  WHERE
    -- 1. Access Check (user owns or has permission)
    (
      t.user_id = p_user_id
      OR EXISTS (
          SELECT 1 FROM trace_permissions tp
          WHERE tp.trace_id = t.id AND tp.user_id = p_user_id
      )
    )
    -- 2. Combined Folder and Search Logic
    AND (
        -- Condition A: Apply FOLDER filtering when NOT searching
        ( (p_search_query IS NULL OR p_search_query = '') -- Check if NOT searching
          AND
          ( (p_folder_id IS NULL AND t.folder_id IS NULL) -- Match root folder
            OR
            (p_folder_id IS NOT NULL AND t.folder_id = p_folder_id) -- Match specific folder
          )
        )
        OR
        -- Condition B: Apply SEARCH filtering when searching (ignore folder)
        ( (p_search_query IS NOT NULL AND p_search_query != '') -- Check IF searching
          AND
          ( -- Actual search conditions
            t.scenario ILIKE ('%' || p_search_query || '%') OR
            t.notes ILIKE ('%' || p_search_query || '%') OR
            t.branch ILIKE ('%' || p_search_query || '%') OR
            t.commit_sha ILIKE ('%' || p_search_query || '%')
          )
        )
    );
  RETURN total_count;
END;
$$;


ALTER FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid", "p_search_query" "text", "p_folder_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_active_subscription"() RETURNS TABLE("user_id" "uuid", "plan_id" "uuid", "stripe_subscription_id" "text", "status" "text", "current_period_start" timestamp with time zone, "current_period_end" timestamp with time zone, "cancel_at_period_end" boolean, "plan_name" "text", "price_monthly" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    us.user_id,
    us.plan_id,
    us.stripe_subscription_id,
    us.status,
    us.current_period_start,
    us.current_period_end,
    us.cancel_at_period_end,
    sp.name as plan_name,
    sp.price_monthly
  FROM
    public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE
    us.user_id = auth.uid () AND us.status IN ('active', 'trialing'); -- Only fetch active or trialing subscriptions
END;
$$;


ALTER FUNCTION "public"."get_user_active_subscription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_subscription_usage"("p_user_id" "uuid") RETURNS TABLE("monthly_uploads_used" integer, "monthly_upload_limit" integer, "current_period_end" timestamp with time zone, "plan_name" "text", "total_trace_limit" integer, "current_total_traces" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    us.monthly_uploads_used,
    p.monthly_upload_limit,
    us.current_period_end,
    p.name as plan_name,
    p.total_trace_limit,
    (SELECT count(*) FROM public.traces WHERE traces.user_id = us.user_id) as current_total_traces
  FROM
    public.user_subscriptions us
  JOIN
    public.subscription_plans p ON us.plan_id = p.id
  WHERE
    us.user_id = p_user_id
    AND us.status IN ('active', 'trialing', 'free') -- Includes 'free' status
  ORDER BY
    us.updated_at DESC -- Prefer the most recently updated record if multiple match
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_subscription_usage"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$DECLARE
  free_plan_id UUID;
  start_date TIMESTAMPTZ := NOW();
  end_date TIMESTAMPTZ := NOW() + interval '1 month'; -- Define the first monthly period
  full_name TEXT;
  extracted_first_name TEXT;
  extracted_last_name TEXT;
BEGIN
  -- 1. Insert into user_profiles
  -- Extract full name from GitHub if available
  full_name := NEW.raw_user_meta_data ->> 'name';

  -- Attempt to split full_name into first and last names
  -- This is a simple split, might need refinement for complex names
  IF full_name IS NOT NULL AND full_name ~ ' ' THEN
    extracted_first_name := split_part(full_name, ' ', 1);
    extracted_last_name := substring(full_name from position(' ' in full_name) + 1);
  ELSE
    extracted_first_name := full_name; -- If no space, assume full name is first name
    extracted_last_name := NULL;
  END IF;

  INSERT INTO public.user_profiles (id, first_name, last_name, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'given_name',  -- Google
      extracted_first_name                     -- GitHub (from 'name')
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'family_name', -- Google
      extracted_last_name                      -- GitHub (from 'name')
    ),
    NULL,      -- Dont set the username from data as it might cause a failure
    COALESCE(
      NEW.raw_user_meta_data ->> 'picture',     -- Google
      NEW.raw_user_meta_data ->> 'avatar_url'  -- GitHub
    )
  );

  -- 2. Create the default 'free' subscription
  -- Find the UUID of the 'free' plan
  SELECT id INTO free_plan_id FROM subscription_plans WHERE name = 'free' LIMIT 1;

  -- If the free plan exists, insert the subscription record
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end, monthly_uploads_used)
    VALUES (
      NEW.id,                  -- The user_id from the newly inserted user in auth.users
      free_plan_id,            -- The UUID of the 'free' plan
      'free',                  -- Initial status
      start_date,              -- Start of the first monthly limit cycle
      end_date,                -- End of the first monthly limit cycle
      0                        -- Start with 0 uploads used
    );
  ELSE
     -- Optional: Raise an error or log if the 'free' plan wasn't found
     RAISE WARNING 'Default "free" subscription plan not found for user %', NEW.id;
  END IF;

  -- Return NEW for the trigger
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
      -- Set the updated_at column to the current time in UTC
      NEW.updated_at = timezone('utc', now());
      RETURN NEW; -- Return the modified row
    END;
    $$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_lifetime_chat_analyses"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  UPDATE public.user_profiles
  SET lifetime_chat_analyses_count = lifetime_chat_analyses_count + 1
  WHERE id = p_user_id;
$$;


ALTER FUNCTION "public"."increment_lifetime_chat_analyses"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_monthly_chat_sessions"("p_user_subscription_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  UPDATE public.user_subscriptions
  SET monthly_chat_sessions_count = monthly_chat_sessions_count + 1
  WHERE id = p_user_subscription_id;
$$;


ALTER FUNCTION "public"."increment_monthly_chat_sessions"("p_user_subscription_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_trace_upload_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  plan_monthly_upload_limit INTEGER;
  v_subscription_id UUID;
  v_user_id UUID := NEW.user_id;
BEGIN
  -- RAISE NOTICE messages removed for production
  -- You can add them back temporarily if needed for further debugging

  -- Check if the user's plan has a monthly limit
  SELECT
    p.monthly_upload_limit,
    us.id
  INTO
    plan_monthly_upload_limit,
    v_subscription_id
  FROM public.user_subscriptions us -- Use explicit schema qualification
  JOIN public.subscription_plans p ON us.plan_id = p.id
  WHERE us.user_id = v_user_id
  AND us.status IN ('active', 'trialing', 'free')
  LIMIT 1;

  -- Only increment if the plan HAS a defined monthly limit AND a subscription exists
  IF plan_monthly_upload_limit IS NOT NULL AND v_subscription_id IS NOT NULL THEN
    -- Increment the counter
    UPDATE public.user_subscriptions -- Use explicit schema qualification
    SET monthly_uploads_used = monthly_uploads_used + 1
    WHERE id = v_subscription_id;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."increment_trace_upload_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_expired_monthly_limits"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE
    public.user_subscriptions us
  SET
    -- Reset monthly_uploads_used if the plan has a monthly upload limit
    monthly_uploads_used = CASE
                             WHEN p.monthly_upload_limit IS NOT NULL THEN 0
                             ELSE us.monthly_uploads_used  -- Otherwise, keep its current value
                           END,
    -- Reset monthly_chat_sessions_count if the plan's chat session period is 'monthly'
    monthly_chat_sessions_count = CASE
                                    WHEN p.chat_sessions_period = 'monthly' THEN 0
                                    ELSE us.monthly_chat_sessions_count -- Otherwise, keep its current value
                                  END,
    -- Update period start and end dates
    current_period_start = us.current_period_end,
    current_period_end = us.current_period_end + interval '1 month'
  FROM
    public.subscription_plans p
  WHERE
    us.plan_id = p.id  -- Join user_subscriptions with subscription_plans
    AND us.status IN ('active', 'free') -- Apply to active or free status subscriptions (as per your original logic)
    AND us.current_period_end <= NOW() -- Only for subscriptions whose current period has ended
    -- Ensure we only process subscriptions linked to plans that have at least one relevant monthly limit
    AND (p.monthly_upload_limit IS NOT NULL OR p.chat_sessions_period = 'monthly');
END;
$$;


ALTER FUNCTION "public"."reset_expired_monthly_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_api_key"("p_key_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Ensure the user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to revoke an API key';
    END IF;

    -- Update the API key
    UPDATE public.api_keys -- Explicitly schema-qualify if needed, though search_path should handle it
    SET is_active = false
    WHERE id = p_key_id AND user_id = auth.uid();

    -- Check if the update was successful
    IF NOT FOUND THEN
        -- This means either the key_id doesn't exist or it doesn't belong to the user
        RAISE EXCEPTION 'API key not found or permission denied';
    END IF;
END;
$$;


ALTER FUNCTION "public"."revoke_api_key"("p_key_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_trace_expiration"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_plan_name TEXT;
  plan_retention_days INTEGER; -- Variable to store retention days from the plan
  free_plan_name TEXT := 'free'; -- Use 'free' as the identifier
BEGIN
  -- Check the subscription plan and retention days of the user inserting the trace
  SELECT
    p.name,
    p.retention_days
  INTO
    user_plan_name,
    plan_retention_days
  FROM user_subscriptions us
  JOIN subscription_plans p ON us.plan_id = p.id
  WHERE us.user_id = NEW.user_id -- user_id of the trace being inserted
  AND us.status IN ('active', 'trialing', 'free') -- Consider relevant statuses
  LIMIT 1;

  -- If the user is on the free plan AND the plan has a specific retention period defined
  IF user_plan_name = free_plan_name AND plan_retention_days IS NOT NULL THEN
    -- Set expires_at based on the fetched retention_days
    NEW.expires_at := NOW() + (plan_retention_days * interval '1 day');
  ELSE
    -- Otherwise (not on free plan, or free plan has NULL retention), ensure expires_at is NULL
    NEW.expires_at := NULL;
  END IF;

  -- Return the (potentially modified) row to be inserted
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_trace_expiration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_api_key"("p_plaintext_key" "text") RETURNS TABLE("o_user_id" "uuid", "o_is_valid" boolean, "o_scopes" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
DECLARE
    v_key_record RECORD;
BEGIN
    -- Find the key record based on the plaintext key comparison
    SELECT ak.user_id, ak.is_active, ak.scopes
    INTO v_key_record
    FROM public.api_keys ak -- Use alias 'ak'
    WHERE ak.key_hash = crypt(p_plaintext_key, ak.key_hash); -- Compare plaintext against hash

    -- If a matching, active key was found
    IF FOUND AND v_key_record.is_active THEN
        -- Update last_used_at using table name qualification
        UPDATE public.api_keys
        SET last_used_at = now()
        WHERE public.api_keys.key_hash = crypt(p_plaintext_key, public.api_keys.key_hash) -- Qualify column
          AND public.api_keys.user_id = v_key_record.user_id                             -- Qualify column
          AND public.api_keys.is_active = true;                                            -- Qualify column

        -- Return results using the record variable
        RETURN QUERY SELECT v_key_record.user_id, TRUE, v_key_record.scopes;
    ELSE
        -- No match found or key is inactive
        RETURN QUERY SELECT NULL::UUID, FALSE, ARRAY[]::TEXT[];
    END IF;

END;
$$;


ALTER FUNCTION "public"."verify_api_key"("p_plaintext_key" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "key_hash" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "scopes" "text"[] DEFAULT ARRAY['trace:upload'::"text"] NOT NULL
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."api_keys" IS 'Stores API keys (hashed) for user programmatic access.';



COMMENT ON COLUMN "public"."api_keys"."user_id" IS 'The user associated with this API key.';



COMMENT ON COLUMN "public"."api_keys"."key_hash" IS 'Cryptographic hash (e.g., bcrypt) of the actual API key.';



COMMENT ON COLUMN "public"."api_keys"."scopes" IS 'List of allowed actions/scopes for this key (e.g., trace:upload, trace:list)';



CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "trace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "turn_number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sender" "text" NOT NULL,
    "content_text" "text",
    "content_image_url" "text",
    "tool_name" "text",
    "tool_call_id" "text",
    "tool_status" "text",
    "metadata" "jsonb",
    "tool_calls_json" "jsonb",
    CONSTRAINT "chat_messages_sender_check" CHECK (("sender" = ANY (ARRAY['user'::"text", 'model'::"text", 'tool_request'::"text", 'tool_result'::"text", 'tool_error'::"text", 'system_event'::"text"]))),
    CONSTRAINT "chat_messages_tool_status_check" CHECK ((("tool_status" IS NULL) OR ("tool_status" = ANY (ARRAY['success'::"text", 'success_with_warning'::"text", 'error'::"text"]))))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."chat_messages"."trace_id" IS 'Links to the trace this chat is about.';



COMMENT ON COLUMN "public"."chat_messages"."user_id" IS 'Links to the user who initiated/owns this chat.';



COMMENT ON COLUMN "public"."chat_messages"."session_id" IS 'Groups messages within a distinct chat session for a trace by a user.';



COMMENT ON COLUMN "public"."chat_messages"."turn_number" IS 'Sequential number for messages within a session for ordering.';



COMMENT ON COLUMN "public"."chat_messages"."sender" IS 'Indicates the origin of the message (user, model, tool_*, system_event).';



COMMENT ON COLUMN "public"."chat_messages"."content_text" IS 'Textual content of the message.';



COMMENT ON COLUMN "public"."chat_messages"."content_image_url" IS 'Public URL of an image associated with the message (e.g., from a tool result).';



COMMENT ON COLUMN "public"."chat_messages"."tool_name" IS 'Name of the tool if the message relates to a tool.';



COMMENT ON COLUMN "public"."chat_messages"."tool_call_id" IS 'Unique ID for a specific tool invocation, linking requests and results/errors.';



COMMENT ON COLUMN "public"."chat_messages"."tool_status" IS 'Status of a tool operation (success, success_with_warning, error).';



COMMENT ON COLUMN "public"."chat_messages"."metadata" IS 'Any additional structured metadata for the message.';



CREATE SEQUENCE IF NOT EXISTS "public"."chat_messages_turn_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."chat_messages_turn_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."chat_messages_turn_number_seq" OWNED BY "public"."chat_messages"."turn_number";



CREATE TABLE IF NOT EXISTS "public"."folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_folder_id" "uuid",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "folders_name_check" CHECK ((("char_length"("name") > 0) AND ("char_length"("name") <= 255)))
);


ALTER TABLE "public"."folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "price_monthly" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "retention_days" integer,
    "monthly_upload_limit" integer,
    "total_trace_limit" integer,
    "allow_public_sharing" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "chat_messages_per_session" integer,
    "chat_sessions_limit" integer,
    "chat_sessions_period" "text",
    "stripe_price_id" "text",
    CONSTRAINT "check_chat_sessions_period" CHECK ((("chat_sessions_period" IS NULL) OR ("chat_sessions_period" = ANY (ARRAY['lifetime'::"text", 'monthly'::"text"]))))
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subscription_plans"."retention_days" IS 'Number of days traces are retained. NULL means infinite retention.';



COMMENT ON COLUMN "public"."subscription_plans"."monthly_upload_limit" IS 'Maximum number of traces a user can upload per month. NULL means no specific monthly limit.';



COMMENT ON COLUMN "public"."subscription_plans"."total_trace_limit" IS 'Maximum total number of traces a user can store. NULL means no total limit.';



COMMENT ON COLUMN "public"."subscription_plans"."allow_public_sharing" IS 'Whether users on this plan can create publicly accessible trace links.';



COMMENT ON COLUMN "public"."subscription_plans"."stripe_price_id" IS 'Stripe Price ID for this plan.';



CREATE TABLE IF NOT EXISTS "public"."trace_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trace_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "parent_comment_id" "uuid",
    "content" "text" NOT NULL,
    "trace_timestamp_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "comment_type" "text" NOT NULL,
    "comment_identifier" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_edited" boolean DEFAULT false,
    "last_edited_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    CONSTRAINT "comment_identifier_nullability_by_comment_type" CHECK (((("comment_type" = 'overview'::"text") AND ("comment_identifier" IS NULL)) OR (("comment_type" <> 'overview'::"text") AND ("comment_identifier" IS NOT NULL)))),
    CONSTRAINT "trace_comments_content_check" CHECK (("char_length"("content") > 0)),
    CONSTRAINT "valid_comment_comment_type" CHECK (("comment_type" = ANY (ARRAY['overview'::"text", 'chrono'::"text", 'left_heavy'::"text", 'sandwich'::"text"])))
);


ALTER TABLE "public"."trace_comments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trace_comments"."trace_id" IS 'Link to the trace this comment belongs to.';



COMMENT ON COLUMN "public"."trace_comments"."user_id" IS 'Link to the user who wrote the comment.';



COMMENT ON COLUMN "public"."trace_comments"."parent_comment_id" IS 'If not NULL, this comment is a reply to the referenced comment.';



COMMENT ON COLUMN "public"."trace_comments"."content" IS 'The text content of the comment.';



COMMENT ON COLUMN "public"."trace_comments"."trace_timestamp_ms" IS 'Optional timestamp in the trace (ms) this comment refers to.';



CREATE TABLE IF NOT EXISTS "public"."trace_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trace_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "role" "public"."trace_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "owner_must_be_specific_user" CHECK ((("role" <> 'owner'::"public"."trace_role") OR ("user_id" IS NOT NULL)))
);


ALTER TABLE "public"."trace_permissions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trace_permissions"."user_id" IS 'NULL indicates public permission';



COMMENT ON CONSTRAINT "owner_must_be_specific_user" ON "public"."trace_permissions" IS 'The ''owner'' role cannot be assigned publicly (user_id must not be NULL).';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "lifetime_chat_analyses_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "user_profiles_avatar_url_check" CHECK (("avatar_url" ~* '^https?://'::"text")),
    CONSTRAINT "user_profiles_username_check" CHECK (("char_length"("username") >= 3)),
    CONSTRAINT "username_format" CHECK (("username" ~ '^[a-zA-Z0-9_]+$'::"text")),
    CONSTRAINT "username_length" CHECK ((("char_length"("username") >= 3) AND ("char_length"("username") <= 30)))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS 'Stores public profile information for users.';



COMMENT ON COLUMN "public"."user_profiles"."id" IS 'References the internal Supabase auth user.';



COMMENT ON COLUMN "public"."user_profiles"."username" IS 'Public display name for the user.';



COMMENT ON COLUMN "public"."user_profiles"."avatar_url" IS 'URL to the user''s public avatar image.';



COMMENT ON COLUMN "public"."user_profiles"."updated_at" IS 'Timestamp of the last profile update.';



COMMENT ON COLUMN "public"."user_profiles"."first_name" IS 'User''s first name, potentially from OAuth.';



COMMENT ON COLUMN "public"."user_profiles"."last_name" IS 'User''s last name, potentially from OAuth.';



CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "current_period_start" timestamp with time zone NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "monthly_uploads_used" integer DEFAULT 0 NOT NULL,
    "payment_provider" "text",
    "stripe_subscription_id" "text",
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "canceled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "monthly_chat_sessions_count" integer DEFAULT 0 NOT NULL,
    "stripe_customer_id" "text",
    CONSTRAINT "user_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'canceled'::"text", 'past_due'::"text", 'trialing'::"text", 'free'::"text"])))
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_subscriptions"."status" IS 'Subscription status (active, canceled, past_due, trialing, free).';



COMMENT ON COLUMN "public"."user_subscriptions"."current_period_start" IS 'Start date of the current billing/limit cycle.';



COMMENT ON COLUMN "public"."user_subscriptions"."current_period_end" IS 'End date of the current billing/limit cycle.';



COMMENT ON COLUMN "public"."user_subscriptions"."monthly_uploads_used" IS 'Number of uploads used in the current cycle (for plans with monthly limits).';



COMMENT ON COLUMN "public"."user_subscriptions"."stripe_subscription_id" IS 'Stripe Subscription ID for this user''s active subscription.';



COMMENT ON COLUMN "public"."user_subscriptions"."stripe_customer_id" IS 'Stripe Customer ID for the user.';



ALTER TABLE ONLY "public"."chat_messages" ALTER COLUMN "turn_number" SET DEFAULT "nextval"('"public"."chat_messages_turn_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trace_comments"
    ADD CONSTRAINT "trace_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trace_permissions"
    ADD CONSTRAINT "trace_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."traces"
    ADD CONSTRAINT "traces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trace_permissions"
    ADD CONSTRAINT "unique_permission_per_user_or_public" UNIQUE ("trace_id", "user_id");



COMMENT ON CONSTRAINT "unique_permission_per_user_or_public" ON "public"."trace_permissions" IS 'Ensures only one permission entry per user per trace, or one public entry per trace.';



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "uq_turn_per_session" UNIQUE ("trace_id", "user_id", "session_id", "turn_number");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_api_keys_is_active" ON "public"."api_keys" USING "btree" ("is_active");



CREATE INDEX "idx_api_keys_scopes" ON "public"."api_keys" USING "gin" ("scopes");



CREATE INDEX "idx_api_keys_user_id" ON "public"."api_keys" USING "btree" ("user_id");



CREATE INDEX "idx_chat_messages_tool_call_id" ON "public"."chat_messages" USING "btree" ("tool_call_id") WHERE ("tool_call_id" IS NOT NULL);



CREATE INDEX "idx_chat_messages_trace_user_session" ON "public"."chat_messages" USING "btree" ("trace_id", "user_id", "session_id", "created_at" DESC);



CREATE INDEX "idx_chat_messages_trace_user_session_created_at" ON "public"."chat_messages" USING "btree" ("trace_id", "user_id", "session_id", "created_at" DESC);



CREATE INDEX "idx_folders_parent_folder_id" ON "public"."folders" USING "btree" ("parent_folder_id");



CREATE INDEX "idx_folders_user_id" ON "public"."folders" USING "btree" ("user_id");



CREATE INDEX "idx_subscription_plans_name" ON "public"."subscription_plans" USING "btree" ("name");



CREATE INDEX "idx_trace_comments_comment_type_identifier" ON "public"."trace_comments" USING "btree" ("trace_id", "comment_type", "comment_identifier");



CREATE INDEX "idx_trace_comments_parent_comment_id" ON "public"."trace_comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_trace_comments_trace_id" ON "public"."trace_comments" USING "btree" ("trace_id");



CREATE INDEX "idx_trace_comments_user_id" ON "public"."trace_comments" USING "btree" ("user_id");



CREATE INDEX "idx_trace_permissions_trace_id" ON "public"."trace_permissions" USING "btree" ("trace_id");



CREATE INDEX "idx_trace_permissions_trace_id_user_id" ON "public"."trace_permissions" USING "btree" ("trace_id", "user_id");



CREATE INDEX "idx_trace_permissions_user_id" ON "public"."trace_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_trace_permissions_user_trace" ON "public"."trace_permissions" USING "btree" ("user_id", "trace_id");



CREATE INDEX "idx_traces_branch_gin_trgm" ON "public"."traces" USING "gin" ("branch" "public"."gin_trgm_ops");



CREATE INDEX "idx_traces_commit_sha_gin_trgm" ON "public"."traces" USING "gin" ("commit_sha" "public"."gin_trgm_ops");



CREATE INDEX "idx_traces_folder_id" ON "public"."traces" USING "btree" ("folder_id");



CREATE INDEX "idx_traces_notes_gin_trgm" ON "public"."traces" USING "gin" ("notes" "public"."gin_trgm_ops");



CREATE INDEX "idx_traces_scenario_gin_trgm" ON "public"."traces" USING "gin" ("scenario" "public"."gin_trgm_ops");



CREATE INDEX "idx_traces_user_id" ON "public"."traces" USING "btree" ("user_id");



CREATE INDEX "idx_user_subscriptions_plan_id" ON "public"."user_subscriptions" USING "btree" ("plan_id");



CREATE INDEX "idx_user_subscriptions_status" ON "public"."user_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_user_subscriptions_user_id" ON "public"."user_subscriptions" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "after_trace_insert_increment_count" AFTER INSERT ON "public"."traces" FOR EACH ROW EXECUTE FUNCTION "public"."increment_trace_upload_count"();



CREATE OR REPLACE TRIGGER "before_trace_insert_enforce_limits" BEFORE INSERT ON "public"."traces" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_trace_limits_and_set_expiration"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."trace_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "on_trace_update" BEFORE UPDATE ON "public"."traces" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_folders_timestamp" BEFORE UPDATE ON "public"."folders" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_add_owner_permission" AFTER INSERT ON "public"."traces" FOR EACH ROW EXECUTE FUNCTION "public"."add_owner_permission"();



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trace_comments"
    ADD CONSTRAINT "trace_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."trace_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trace_comments"
    ADD CONSTRAINT "trace_comments_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trace_comments"
    ADD CONSTRAINT "trace_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trace_permissions"
    ADD CONSTRAINT "trace_permissions_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trace_permissions"
    ADD CONSTRAINT "trace_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."traces"
    ADD CONSTRAINT "traces_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."traces"
    ADD CONSTRAINT "traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Allow anonymous read access to public permission entries" ON "public"."trace_permissions" FOR SELECT TO "anon" USING (("user_id" IS NULL));



CREATE POLICY "Allow anonymous read access to public traces" ON "public"."traces" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."trace_permissions" "tp"
  WHERE (("tp"."trace_id" = "traces"."id") AND ("tp"."user_id" IS NULL)))));



CREATE POLICY "Allow authenticated read access" ON "public"."trace_comments" FOR SELECT TO "authenticated" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read access" ON "public"."user_profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow comment author to update" ON "public"."trace_comments" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND "public"."check_trace_permission"("trace_id", "auth"."uid"(), 'editor'::"public"."trace_role"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."check_trace_permission"("trace_id", "auth"."uid"(), 'editor'::"public"."trace_role")));



CREATE POLICY "Allow delete for comment author or trace owner" ON "public"."trace_comments" FOR DELETE USING (((("user_id" = "auth"."uid"()) AND "public"."check_trace_permission"("trace_id", "auth"."uid"(), 'editor'::"public"."trace_role")) OR "public"."check_trace_permission"("trace_id", "auth"."uid"(), 'owner'::"public"."trace_role")));



CREATE POLICY "Allow delete for owners" ON "public"."traces" FOR DELETE USING ("public"."check_trace_permission"("id", "auth"."uid"(), 'owner'::"public"."trace_role"));



CREATE POLICY "Allow editor or self to read permissions" ON "public"."trace_permissions" FOR SELECT USING (("public"."check_trace_permission"("trace_id", "auth"."uid"(), 'editor'::"public"."trace_role") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Allow editor to manage permissions (delete)" ON "public"."trace_permissions" FOR DELETE USING (("public"."check_trace_permission"("trace_id", "auth"."uid"(), 'editor'::"public"."trace_role") AND ("role" <> 'owner'::"public"."trace_role")));



CREATE POLICY "Allow editor to manage permissions (insert)" ON "public"."trace_permissions" FOR INSERT WITH CHECK (("public"."check_trace_permission"("trace_id", "auth"."uid"(), 'editor'::"public"."trace_role") AND ("role" <> 'owner'::"public"."trace_role") AND (("user_id" IS NOT NULL) OR ("role" <> 'owner'::"public"."trace_role"))));



CREATE POLICY "Allow editor to manage permissions (update)" ON "public"."trace_permissions" FOR UPDATE USING (("public"."check_trace_permission"("trace_id", "auth"."uid"(), 'editor'::"public"."trace_role") AND ("role" <> 'owner'::"public"."trace_role"))) WITH CHECK (("public"."check_trace_permission"("trace_id", "auth"."uid"(), 'editor'::"public"."trace_role") AND ("role" <> 'owner'::"public"."trace_role") AND ("user_id" <> ( SELECT "trace_permissions_1"."user_id"
   FROM "public"."trace_permissions" "trace_permissions_1"
  WHERE (("trace_permissions_1"."trace_id" = "trace_permissions_1"."trace_id") AND ("trace_permissions_1"."role" = 'owner'::"public"."trace_role"))
 LIMIT 1))));



CREATE POLICY "Allow individual delete access" ON "public"."trace_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual insert access" ON "public"."trace_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual insert access" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Allow individual update access" ON "public"."trace_comments" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual update access" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Allow insert for authenticated users" ON "public"."traces" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow insert for editors and owners" ON "public"."trace_comments" FOR INSERT WITH CHECK (("public"."check_trace_permission"("trace_id", "auth"."uid"(), 'viewer'::"public"."trace_role") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Allow public read access to plans" ON "public"."subscription_plans" FOR SELECT USING (true);



CREATE POLICY "Allow read access based on permissions" ON "public"."traces" FOR SELECT USING ("public"."check_trace_permission"("id", "auth"."uid"(), 'viewer'::"public"."trace_role"));



CREATE POLICY "Allow read access based on trace permissions" ON "public"."trace_comments" FOR SELECT TO "authenticated" USING ("public"."check_trace_permission"("trace_id", "auth"."uid"(), 'viewer'::"public"."trace_role"));



CREATE POLICY "Allow update for editors and owners" ON "public"."traces" FOR UPDATE USING ("public"."check_trace_permission"("id", "auth"."uid"(), 'editor'::"public"."trace_role"));



CREATE POLICY "Allow user to read their own subscription" ON "public"."user_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to insert their own chat messages" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to insert their own comments" ON "public"."trace_comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own folders" ON "public"."folders" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to see their own folders" ON "public"."folders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to select their own chat messages" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to update their own comments" ON "public"."trace_comments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own traces" ON "public"."traces" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own traces" ON "public"."traces" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own traces" ON "public"."traces" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own API keys" ON "public"."api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own traces" ON "public"."traces" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trace_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trace_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."traces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";












GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";
































































































































































































GRANT ALL ON FUNCTION "public"."add_owner_permission"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_owner_permission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_owner_permission"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_trace_permission"("p_trace_id" "uuid", "p_user_id" "uuid", "min_role" "public"."trace_role") TO "anon";
GRANT ALL ON FUNCTION "public"."check_trace_permission"("p_trace_id" "uuid", "p_user_id" "uuid", "min_role" "public"."trace_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_trace_permission"("p_trace_id" "uuid", "p_user_id" "uuid", "min_role" "public"."trace_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_api_key"("p_description" "text", "p_scopes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_api_key"("p_description" "text", "p_scopes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_api_key"("p_description" "text", "p_scopes" "text"[]) TO "service_role";



GRANT ALL ON TABLE "public"."traces" TO "anon";
GRANT ALL ON TABLE "public"."traces" TO "authenticated";
GRANT ALL ON TABLE "public"."traces" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_trace"("p_user_id" "uuid", "p_commit_sha" "text", "p_branch" "text", "p_scenario" "text", "p_duration_ms" numeric, "p_blob_path" "text", "p_file_size_bytes" numeric, "p_profile_type" "text", "p_notes" "text", "p_folder_id" "uuid", "p_upload_source" "text", "p_make_public" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_trace"("p_user_id" "uuid", "p_commit_sha" "text", "p_branch" "text", "p_scenario" "text", "p_duration_ms" numeric, "p_blob_path" "text", "p_file_size_bytes" numeric, "p_profile_type" "text", "p_notes" "text", "p_folder_id" "uuid", "p_upload_source" "text", "p_make_public" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_trace"("p_user_id" "uuid", "p_commit_sha" "text", "p_branch" "text", "p_scenario" "text", "p_duration_ms" numeric, "p_blob_path" "text", "p_file_size_bytes" numeric, "p_profile_type" "text", "p_notes" "text", "p_folder_id" "uuid", "p_upload_source" "text", "p_make_public" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_folder_contents_by_ids"("p_folder_ids_to_delete" "uuid"[], "p_trace_ids_to_delete" "uuid"[], "p_original_folder_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_folder_contents_by_ids"("p_folder_ids_to_delete" "uuid"[], "p_trace_ids_to_delete" "uuid"[], "p_original_folder_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_folder_contents_by_ids"("p_folder_ids_to_delete" "uuid"[], "p_trace_ids_to_delete" "uuid"[], "p_original_folder_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_old_ai_continuations"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_old_ai_continuations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_old_ai_continuations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_trace_limits_and_set_expiration"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_trace_limits_and_set_expiration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_trace_limits_and_set_expiration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_sessions_for_trace"("in_trace_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_sessions_for_trace"("in_trace_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_sessions_for_trace"("in_trace_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_sessions_for_trace"("in_user_id" "text", "in_trace_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_sessions_for_trace"("in_user_id" "text", "in_trace_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_sessions_for_trace"("in_user_id" "text", "in_trace_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_folder_view_data"("p_user_id" "uuid", "p_folder_id" "uuid", "p_page" integer, "p_limit" integer, "p_search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_folder_view_data"("p_user_id" "uuid", "p_folder_id" "uuid", "p_page" integer, "p_limit" integer, "p_search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_folder_view_data"("p_user_id" "uuid", "p_folder_id" "uuid", "p_page" integer, "p_limit" integer, "p_search_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_trace_details"("trace_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_trace_details"("trace_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_trace_details"("trace_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recursive_folder_contents"("folder_id_to_check" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_recursive_folder_contents"("folder_id_to_check" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recursive_folder_contents"("folder_id_to_check" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer, "p_search_query" "text", "p_folder_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer, "p_search_query" "text", "p_folder_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accessible_traces"("p_user_id" "uuid", "p_offset" integer, "p_limit" integer, "p_search_query" "text", "p_folder_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid", "p_search_query" "text", "p_folder_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid", "p_search_query" "text", "p_folder_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accessible_traces_count"("p_user_id" "uuid", "p_search_query" "text", "p_folder_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_active_subscription"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_active_subscription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_active_subscription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_subscription_usage"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_subscription_usage"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_subscription_usage"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_lifetime_chat_analyses"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_lifetime_chat_analyses"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_lifetime_chat_analyses"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_monthly_chat_sessions"("p_user_subscription_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_monthly_chat_sessions"("p_user_subscription_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_monthly_chat_sessions"("p_user_subscription_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_trace_upload_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_trace_upload_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_trace_upload_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_expired_monthly_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_expired_monthly_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_expired_monthly_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_api_key"("p_key_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_api_key"("p_key_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_api_key"("p_key_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_trace_expiration"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_trace_expiration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_trace_expiration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_api_key"("p_plaintext_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_api_key"("p_plaintext_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_api_key"("p_plaintext_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."api_keys" TO "authenticated";



GRANT SELECT("description") ON TABLE "public"."api_keys" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."api_keys" TO "authenticated";



GRANT SELECT("last_used_at") ON TABLE "public"."api_keys" TO "authenticated";



GRANT SELECT("is_active") ON TABLE "public"."api_keys" TO "authenticated";



GRANT SELECT("scopes") ON TABLE "public"."api_keys" TO "authenticated";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."chat_messages_turn_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chat_messages_turn_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chat_messages_turn_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."folders" TO "anon";
GRANT ALL ON TABLE "public"."folders" TO "authenticated";
GRANT ALL ON TABLE "public"."folders" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."trace_comments" TO "anon";
GRANT ALL ON TABLE "public"."trace_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."trace_comments" TO "service_role";



GRANT ALL ON TABLE "public"."trace_permissions" TO "anon";
GRANT ALL ON TABLE "public"."trace_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."trace_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
