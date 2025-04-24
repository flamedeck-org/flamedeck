import React, { useMemo } from 'react';
import { useTraceComments } from '@/hooks/useTraceComments';
import { TraceViewerCommentItem } from './TraceViewerCommentItem';
import { SpeedscopeViewType } from '../SpeedscopeViewer'; // Assuming SpeedscopeViewType is exported
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const { 
    allComments, 
    isLoading,
    error,
  } = useTraceComments(traceId);

  const targetCommentType = viewTypeToCommentType[activeView];

  const filteredAndSortedComments = useMemo(() => {
    if (!allComments || !targetCommentType) return [];

    // Filter comments by the active view type
    const filtered = allComments.filter(comment => comment.comment_type === targetCommentType);

    // Sort by creation date, newest first
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  }, [allComments, targetCommentType]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">Error loading comments: {error.message}</div>;
  }

  return (
    <ScrollArea className="h-[400px] w-full">
      {filteredAndSortedComments.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          No comments for the '{activeView.replace('_', ' ')}' view yet.
        </div>
      ) : (
        <div className="flex flex-col">
          {filteredAndSortedComments.map((comment) => (
            <TraceViewerCommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </ScrollArea>
  );
} 