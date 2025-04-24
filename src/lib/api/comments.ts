import { ApiError } from "@/types";

import { TraceComment } from "@/types";

import { ApiResponse } from "@/types";

import { NewTraceComment, TraceCommentWithAuthor } from "./types";

import { supabase } from "@/integrations/supabase/client";
import { PostgrestError } from "@supabase/supabase-js";

  // Get comments for a specific trace
  export async function getTraceComments(traceId: string): Promise<ApiResponse<TraceCommentWithAuthor[]>> {
    try {
      const { data, error } = await supabase
        .from('trace_comments')
        .select<string, TraceCommentWithAuthor>(`
          id,
          trace_id,
          user_id,
          content,
          created_at,
          updated_at,
          parent_comment_id,
          trace_timestamp_ms,
          comment_type,
          comment_identifier,
          author: user_profiles ( id, username, avatar_url, first_name, last_name )
        `)
        .eq('trace_id', traceId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsWithAuthor = data as TraceCommentWithAuthor[]; 
      
      return { data: commentsWithAuthor, error: null };
    } catch (error) {
      console.error(`Error fetching comments for trace ${traceId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to fetch comments",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }

  // Create a new comment for a trace
  export async function createTraceComment(
    commentData: NewTraceComment & { trace_id: string },
    userId: string
  ): Promise<ApiResponse<TraceComment>> {
    try {
      if (!userId) throw new Error("User ID required to comment.");

      const { data, error } = await supabase
        .from('trace_comments')
        .insert({
          trace_id: commentData.trace_id,
          content: commentData.content,
          parent_comment_id: commentData.parent_comment_id,
          trace_timestamp_ms: commentData.trace_timestamp_ms,
          comment_type: commentData.comment_type,
          comment_identifier: commentData.comment_identifier,
          user_id: userId,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (!data) throw new Error("Comment created but data not returned.");

      return { data: data as TraceComment, error: null };
    } catch (error) {
      console.error('Error creating trace comment:', error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to create comment",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }