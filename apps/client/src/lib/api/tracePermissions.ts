import type { ApiError } from "@/types";

import { supabase } from "@/integrations/supabase/client";
import type { ApiResponse } from "@/types";
import type { TracePermissionRow, TracePermissionWithUser, TraceRole } from "./types";
import type { PostgrestError } from "@supabase/supabase-js";

export async function getTracePermissions(traceId: string): Promise<ApiResponse<TracePermissionWithUser[]>> {
    try {
      const { data, error } = await supabase
        .from('trace_permissions')
        .select(`
          id,
          trace_id,
          role,
          created_at,
          updated_at,
          user: user_profiles ( id, username, avatar_url, first_name, last_name )
        `)
        .eq('trace_id', traceId);

      if (error) throw error;

      // Type assertion might be needed depending on how Supabase returns the joined data
      const permissions = data as unknown as TracePermissionWithUser[];
      return { data: permissions, error: null };
    } catch (error) {
      console.error(`Error fetching permissions for trace ${traceId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to fetch permissions",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }

  // Add a permission for a specific user
  export async function addTracePermission(
    traceId: string,
    userId: string,
    role: TraceRole
  ): Promise<ApiResponse<TracePermissionRow>> {
    try {
      const { data, error } = await supabase
        .from('trace_permissions')
        .insert({ trace_id: traceId, user_id: userId, role: role })
        .select()
        .single();

      if (error) throw error;
      return { data: data as TracePermissionRow, error: null };
    } catch (error) {
      console.error(`Error adding permission for user ${userId} to trace ${traceId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to add permission",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }

  // Update an existing permission's role
  export async function updateTracePermission(
    permissionId: string,
    role: TraceRole
  ): Promise<ApiResponse<TracePermissionRow>> {
    try {
      const { data, error } = await supabase
        .from('trace_permissions')
        .update({ role: role, updated_at: new Date().toISOString() })
        .eq('id', permissionId)
        .select()
        .single();

      if (error) throw error;
      return { data: data as TracePermissionRow, error: null };
    } catch (error) {
      console.error(`Error updating permission ${permissionId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to update permission",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }

  // Remove a specific permission (by permission ID)
  export async function removeTracePermission(permissionId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('trace_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      console.error(`Error removing permission ${permissionId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to remove permission",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }

  // Set public access (upsert: create or update)
  export async function setPublicTraceAccess(
    traceId: string,
    role: TraceRole | null // null to remove public access
  ): Promise<ApiResponse<TracePermissionRow | null>> {
    try {
      if (role) {
        // Upsert public viewer permission
        const { data, error } = await supabase
          .from('trace_permissions')
          .upsert(
            { trace_id: traceId, user_id: null, role: role },
            { onConflict: 'trace_id, user_id' } // Specify conflict target
          )
          .select()
          .single();
        if (error) throw error;
        return { data: data as TracePermissionRow, error: null };
      } else {
        // Delete public permission if role is null
        const { error } = await supabase
          .from('trace_permissions')
          .delete()
          .eq('trace_id', traceId)
          .is('user_id', null); // Ensure we only delete the public one
        if (error) throw error;
        return { data: null, error: null };
      }
    } catch (error) {
      console.error(`Error setting public access for trace ${traceId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to set public access",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }
