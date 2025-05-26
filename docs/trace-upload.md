# Trace Upload Architecture

This document outlines the architecture of the trace file upload process in the Flamedeck application.

## Overview

The trace upload system is designed to handle file uploads from both the web client and external API clients. It processes various performance profiling formats, converts them into a standardized Speedscope format, generates flamegraph preview images, and stores them securely with appropriate access controls.

## Components

### 1. Client-Side Upload (Web App)

-   **UI**: The Flamedeck web application (`apps/client`) provides a user interface for selecting and uploading trace files.
-   **Request**: Uses `FormData` to send the file and associated metadata (scenario, notes, commit SHA, branch, folder ID, public/private status) to the `upload-trace` Supabase Edge Function.
-   **Authentication**: Authenticates using the user's active session (JWT Bearer token).

### 2. API Upload

-   **Endpoint**: External clients can upload traces via a `POST` request to the same `upload-trace` Edge Function.
-   **Request**: The request body should contain the raw trace file (binary data). Metadata is passed as URL query parameters (`fileName`, `scenario`, etc.).
-   **Authentication**: Authenticates using an API key (`x-api-key` header) with `trace:upload` scope.

### 3. Supabase Edge Function: `upload-trace`

Located at `supabase/functions/upload-trace/index.ts`, this is the core of the upload process.

#### Key Steps:

1.  **CORS Handling**: Responds to `OPTIONS` requests for CORS preflight.
2.  **Authentication**:
    *   Calls `authenticateUnifiedRequest` which attempts session-based authentication first.
    *   If session auth fails or is not applicable (no Bearer token), it attempts API key authentication using `authenticateRequest` (from `_shared/auth.ts`).
    *   Determines `userId` and `uploadSource` ('web' or 'api').
3.  **Input Parsing & Validation**:
    *   Parses the request based on `Content-Type`.
        *   `multipart/form-data`: Extracts file and metadata for web uploads.
        *   Binary body + query params: For API uploads.
    *   Validates metadata using Zod schemas (`apiQueryParamsSchema`, `webFormDataSchema`).
4.  **File Processing (`processTraceFile`)**:
    *   Uses `packages/speedscope-import` to parse the uploaded file buffer. This package supports multiple profile formats (e.g., pprof, Chrome CPU profiles, Speedscope JSON).
    *   Converts the imported profile into a `ProfileGroup` object.
    *   Calculates the total duration of the trace.
    *   Exports the `ProfileGroup` to a serializable Speedscope JSON string.
    *   **Returns**:
        *   `compressedBuffer`: The Speedscope JSON string, gzipped for storage.
        *   `compressedSize`: Size of the compressed data.
        *   `durationMs`: Trace duration.
        *   `profileType`: Detected profile format.
        *   `profileJsonString`: The raw (uncompressed) Speedscope JSON string (used for image generation).
5.  **Storage Upload (`uploadToStorage`)**:
    *   Uploads the `compressedBuffer` to the `traces` Supabase Storage bucket.
    *   Files are stored with a path like `YYYY/MM/DD/<uuid>-<original_filename>.gz`.
    *   Sets `Content-Encoding: gzip` and appropriate cache control headers.
    *   **Returns**: The full storage path (e.g., `traces/2023/10/26/uuid-profile.json.gz`).
6.  **Database Record Creation (RPC: `create_trace`)**:
    *   Calls the `create_trace` PostgreSQL function via RPC.
    *   **Parameters passed to `create_trace`**:
        *   `p_user_id`: Authenticated user's ID.
        *   `p_blob_path`: Path from the storage upload.
        *   `p_upload_source`: 'web' or 'api'.
        *   `p_make_public`: Boolean indicating if a public permission should be created.
        *   Trace metadata: `commit_sha`, `branch`, `scenario`, `duration_ms`, `file_size_bytes`, `profile_type`, `notes`, `folder_id`.
        *   `p_light_image_path`: Initially `NULL`.
        *   `p_dark_image_path`: Initially `NULL`.
    *   The `create_trace` function inserts a new record into the `public.traces` table.
    *   If `p_make_public` is true, it also inserts a public 'viewer' permission into `public.trace_permissions`.
    *   **Returns**: The newly created trace record, including its `id`.
7.  **Flamegraph Image Generation (Asynchronous)**:
    *   After the trace record is successfully created and its `id` is available:
    *   Calls `generateFlamegraphImages` (from `_shared/image-generator.ts`) with the `traceId` and the raw `profileJsonString`.
    *   **`generateFlamegraphImages`**:
        *   Checks for `FLAMECHART_SERVER_URL` environment variable.
        *   Makes `POST` requests (in parallel for light and dark modes) to the Flamechart Server (`/api/v1/render?mode=<light|dark>&width=1200&height=800`).
            *   The request body is the `profileJsonString` (Speedscope format).
            *   `Content-Type` is `text/plain`.
        *   The Flamechart Server returns a PNG image buffer.
        *   Uploads the generated light and dark PNG image buffers to the `flamegraph-images` Supabase Storage bucket using `uploadImageToStorage`.
            *   Images are stored at paths like `<traceId>/light.png` and `<traceId>/dark.png`.
            *   `Content-Type` is `image/png`.
    *   If image generation is successful, the `upload-trace` function updates the previously created trace record in the `public.traces` table with the `light_image_path` and `dark_image_path`.
    *   Image generation failures do not fail the entire upload request; the trace is still created without preview images.
8.  **Response**:
    *   Returns a `201 Created` status with the JSON representation of the created trace record (including image paths if updated successfully).
    *   Returns appropriate error responses (`400`, `401`, `405`, `500`) for failures at various stages.

### 4. Database (`public.traces` table)

The `traces` table stores metadata about each uploaded trace, including:
*   `id` (UUID, primary key)
*   `user_id` (owner)
*   `uploaded_at`, `updated_at`
*   `commit_sha`, `branch`, `scenario`
*   `duration_ms`
*   `blob_path` (path to the gzipped Speedscope file in the `traces` storage bucket)
*   `file_size_bytes` (size of the compressed file)
*   `notes`
*   `profile_type`
*   `folder_id`
*   `upload_source`
*   `light_image_path` (text, path to light mode PNG in `flamegraph-images` bucket)
*   `dark_image_path` (text, path to dark mode PNG in `flamegraph-images` bucket)

### 5. Storage Buckets

*   **`traces`**:
    *   Stores the gzipped Speedscope JSON files.
    *   RLS protected: Access is granted based on `public.trace_permissions`.
*   **`flamegraph-images`**:
    *   Stores PNG preview images for flamegraphs (light and dark mode).
    *   RLS protected: Access is granted based on the associated trace's permissions via RLS policies that join `storage.objects` with `public.traces` and `public.trace_permissions`.

### 6. Flamechart Server (`apps/flamechart-server`)

*   A separate server application responsible for rendering flamegraph images.
*   Exposes an API endpoint (e.g., `/api/v1/render`) that accepts a Speedscope JSON payload (as text) and rendering parameters (mode, width, height).
*   Uses `packages/flamechart-to-png` to generate the PNG image.
*   The URL of this server is configured in the Supabase Edge Function via the `FLAMECHART_SERVER_URL` environment variable.

## Data Flow Summary

1.  **Client/API** → `upload-trace` Edge Function (File + Metadata)
2.  `upload-trace` → **Speedscope Import Lib** (Parse & Convert)
3.  `upload-trace` → **Supabase Storage (`traces` bucket)** (Store Compressed Profile)
4.  `upload-trace` → **Supabase DB (RPC `create_trace`)** (Create Trace Record)
5.  `upload-trace` → `image-generator.ts` (using `profileJsonString` from step 2)
    *   `image-generator.ts` → **Flamechart Server** (Render Light PNG)
    *   `image-generator.ts` → **Flamechart Server** (Render Dark PNG)
    *   `image-generator.ts` → **Supabase Storage (`flamegraph-images` bucket)** (Store Light PNG)
    *   `image-generator.ts` → **Supabase Storage (`flamegraph-images` bucket)** (Store Dark PNG)
6.  `upload-trace` → **Supabase DB** (Update Trace Record with Image Paths)
7.  `upload-trace` → **Client/API** (Return Trace Record JSON)

## Security Considerations

*   **Authentication**: All uploads require valid authentication (session or API key).
*   **Authorization**: API keys can be scoped to allow only trace uploads.
*   **RLS Policies**:
    *   Trace data in the `traces` table is protected by RLS, ensuring users can only access traces they own or have been granted permission to.
    *   Trace files in the `traces` storage bucket are protected by RLS policies linked to `trace_permissions`.
    *   Flamegraph images in the `flamegraph-images` storage bucket are protected by RLS policies that check permissions on the *associated trace*. This means image visibility is automatically synced with trace visibility.
*   **Input Validation**: Zod schemas validate metadata to prevent malformed requests.
*   **File Processing**: The `speedscope-import` library handles various file formats; robustness against malformed or malicious files is important.
*   **Flamechart Server**: This server should ideally be firewalled or secured to only accept requests from the Supabase Edge Function IP range if possible, or use a shared secret/API key for its `/api/v1/render` endpoint if exposed publicly.

This architecture provides a robust and secure system for uploading, processing, and storing performance traces with associated preview images. 