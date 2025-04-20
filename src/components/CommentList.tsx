import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { traceApi, TraceCommentWithAuthor } from '@/lib/api';
import CommentItem from './CommentItem';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

// Type for structured comment including potentially nested replies
type StructuredComment = TraceCommentWithAuthor & { replies: StructuredComment[] };

interface CommentListProps {
  traceId: string;
}

const structureComments = (comments: TraceCommentWithAuthor[]): StructuredComment[] => {
  const commentMap: { [key: string]: StructuredComment } = {};
  const rootComments: StructuredComment[] = [];

  comments.forEach(comment => {
    commentMap[comment.id] = { ...comment, replies: [] };
  });

  comments.forEach(comment => {
    const mappedComment = commentMap[comment.id];
    if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
      // Ensure parent exists before pushing
      commentMap[comment.parent_comment_id].replies.push(mappedComment);
    } else {
      rootComments.push(mappedComment);
    }
  });

  // Optional: Sorting can happen here if needed, API sorts initially
  return rootComments;
};

const CommentList: React.FC<CommentListProps> = ({ traceId }) => {
  const { data: comments, isLoading, error } = useQuery({
    queryKey: ['traceComments', traceId],
    queryFn: async () => {
      const response = await traceApi.getTraceComments(traceId);
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    enabled: !!traceId, // Only run query if traceId is available
  });

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="flex space-x-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive flex items-center space-x-2 py-4">
        <AlertCircle className="h-5 w-5" />
        <span>Error loading comments: {error.message}</span>
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return <p className="text-muted-foreground py-4">No comments yet.</p>;
  }

  const threadedComments = structureComments(comments);

  return (
    <div className="space-y-0 pt-4">
      {threadedComments.map(comment => (
        <CommentItem
          key={comment.id}
          comment={comment}
          traceId={traceId}
          currentDepth={0}
        />
      ))}
    </div>
  );
};

export default CommentList; 