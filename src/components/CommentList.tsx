import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { traceApi, TraceCommentWithAuthor } from '@/lib/api';
import CommentItem from './CommentItem';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface CommentListProps {
  traceId: string;
}

// Helper to structure comments into threads
const structureComments = (comments: TraceCommentWithAuthor[]) => {
  const commentMap: { [key: string]: TraceCommentWithAuthor & { replies: TraceCommentWithAuthor[] } } = {};
  const rootComments: (TraceCommentWithAuthor & { replies: TraceCommentWithAuthor[] })[] = [];

  // Initialize map and add replies array
  comments.forEach(comment => {
    commentMap[comment.id] = { ...comment, replies: [] };
  });

  // Populate replies and identify root comments
  comments.forEach(comment => {
    const mappedComment = commentMap[comment.id];
    if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
      commentMap[comment.parent_comment_id].replies.push(mappedComment);
    } else {
      rootComments.push(mappedComment);
    }
  });

  // Sort root comments and replies by creation date (optional, API already sorts)
  // rootComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  // Object.values(commentMap).forEach(c => c.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

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

  // Structure comments into threads
  const threadedComments = structureComments(comments);

  return (
    <div className="space-y-4 divide-y divide-border">
      {threadedComments.map(comment => (
        <div key={comment.id}>
          <CommentItem comment={comment} traceId={traceId} />
          {/* Render replies nested */}
          {comment.replies.length > 0 && (
            <div className="ml-8 pl-4 border-l border-border space-y-4">
              {comment.replies.map(reply => (
                <CommentItem key={reply.id} comment={reply} traceId={traceId} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CommentList; 