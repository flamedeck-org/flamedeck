import type { ApiError } from '@/types';

import type { TraceComment } from '@/types';

import type { ApiResponse } from '@/types';

import type { NewTraceComment, TraceCommentWithAuthor } from './types';

import { supabase } from '@/integrations/supabase/client';
import type { PostgrestError } from '@supabase/supabase-js';

// Get comments for a specific trace
export async function getTraceComments(
  traceId: string
): Promise<ApiResponse<TraceCommentWithAuthor[]>> {
  try {
    const { data, error } = await supabase
      .from('trace_comments')
      .select<string, TraceCommentWithAuthor>(
        `
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
          is_edited,
          last_edited_at,
          is_deleted,
          author: user_profiles ( id, username, avatar_url, first_name, last_name )
        `
      )
      .eq('trace_id', traceId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const commentsWithAuthor = data as TraceCommentWithAuthor[];

    return { data: commentsWithAuthor, error: null };
  } catch (error) {
    console.error(`Error fetching comments for trace ${traceId}:`, error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Failed to fetch comments',
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
    if (!userId) throw new Error('User ID required to comment.');

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
    if (!data) throw new Error('Comment created but data not returned.');

    return { data: data as TraceComment, error: null };
  } catch (error) {
    console.error('Error creating trace comment:', error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Failed to create comment',
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}

// Update an existing comment
export async function updateTraceComment(
  commentId: string,
  newContent: string
): Promise<ApiResponse<TraceComment>> {
  try {
    const { data, error } = await supabase
      .from('trace_comments')
      .update({
        content: newContent,
        is_edited: true,
        last_edited_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Comment updated but data not returned.');

    // You might need RLS policies in Supabase to ensure users can only update their own comments

    return { data: data as TraceComment, error: null };
  } catch (error) {
    console.error(`Error updating comment ${commentId}:`, error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Failed to update comment',
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}

// Mark a comment as deleted (soft delete)
export async function deleteTraceCommentLogically(commentId: string): Promise<ApiResponse<null>> {
  // Return null on success
  try {
    const { error } = await supabase
      .from('trace_comments')
      .update({
        is_deleted: true,
        content: '', // Set content to empty string
      })
      .eq('id', commentId);

    if (error) throw error;

    return { data: null, error: null }; // Indicate success
  } catch (error) {
    console.error(`Error marking comment ${commentId} as deleted:`, error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Failed to delete comment',
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}
