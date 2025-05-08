import React, { useMemo } from 'react';
import { useTraceComments } from '@/hooks/useTraceComments';
import type { SpeedscopeViewType } from '../SpeedscopeViewer'; // Assuming SpeedscopeViewType is exported
import { CommentList } from '@/components/comments'; // Import the new CommentList

interface TraceViewerCommentListProps {
  traceId: string;
  // The view type selected in the Speedscope viewer (e.g., 'time_ordered')
  activeView: SpeedscopeViewType;
}

// Map Speedscope view types to comment_type used in the database
const viewTypeToCommentType: Record<SpeedscopeViewType, string | null> = {
  time_ordered: 'chrono',
  left_heavy: 'left_heavy',
  sandwich: 'sandwich',
};

export function TraceViewerCommentList({ traceId, activeView }: TraceViewerCommentListProps) {
  const { allComments, isLoading, error } = useTraceComments(traceId);

  const targetCommentType = viewTypeToCommentType[activeView];

  const filteredAndSortedComments = useMemo(() => {
    if (!allComments || !targetCommentType) return [];

    // Filter comments by the active view type
    const filtered = allComments.filter((comment) => comment.comment_type === targetCommentType);

    // Sort by creation date, newest first
    return filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [allComments, targetCommentType]);

  const emptyMessage = `No comments for the '${activeView.replace('_', ' ')}' view yet.`;

  return (
    <CommentList
      comments={filteredAndSortedComments}
      isLoading={isLoading}
      error={error}
      emptyStateMessage={emptyMessage}
      // Pass specific classes for this context if needed
      // className="some-specific-layout"
      scrollAreaClassName="h-[400px] w-full" // Maintain the scroll height
    />
  );
}
