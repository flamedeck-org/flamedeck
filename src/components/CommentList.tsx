import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { traceApi, TraceCommentWithAuthor } from '@/lib/api';
import CommentItem from './CommentItem';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, MessageSquare } from 'lucide-react';

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

  // Sort root comments: frame comments first, grouped by frame, then general comments
  rootComments.sort((a, b) => {
    // If both have frame_key or both don't, sort by date (newest first)
    if ((a.frame_key && b.frame_key) || (!a.frame_key && !b.frame_key)) {
      // If they have the same frame_key, sort by date
      if (a.frame_key === b.frame_key) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // If they have different frame_keys, group by frame_key
      return a.frame_key && b.frame_key 
        ? String(a.frame_key).localeCompare(String(b.frame_key)) 
        : 0;
    }
    // Frame comments come before general comments
    return a.frame_key ? -1 : 1;
  });

  return rootComments;
};

// Function to group comments by frame_key
const groupCommentsByFrame = (comments: StructuredComment[]) => {
  const frameGroups: Record<string, StructuredComment[]> = {};
  const generalComments: StructuredComment[] = [];

  comments.forEach(comment => {
    if (comment.frame_key) {
      const key = String(comment.frame_key);
      if (!frameGroups[key]) {
        frameGroups[key] = [];
      }
      frameGroups[key].push(comment);
    } else {
      generalComments.push(comment);
    }
  });

  return { frameGroups, generalComments };
};

const CommentList: React.FC<CommentListProps> = ({ traceId }) => {
  const { data: comments, isLoading, error } = useQuery({
    queryKey: ['traceComments', traceId],
    queryFn: async () => {
      const response = await traceApi.getTraceComments(traceId);
      if (response.error) throw new Error(response.error.message);
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
  const { frameGroups, generalComments } = groupCommentsByFrame(threadedComments);

  return (
    <div className="space-y-6 pt-4">
      {/* Frame-specific comments */}
      {Object.entries(frameGroups).map(([frameKey, frameComments]) => (
        <div key={`frame-${frameKey}`} className="mb-6">
          <div className="flex items-center space-x-2 mb-2 text-sm font-medium bg-muted p-2 rounded">
            <MessageSquare className="h-4 w-4" />
            <span>Comments on Frame: {frameKey}</span>
            <span className="text-muted-foreground">({frameComments.length})</span>
          </div>
          <div className="ml-4">
            {frameComments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                traceId={traceId}
                currentDepth={0}
              />
            ))}
          </div>
        </div>
      ))}

      {/* General comments */}
      {generalComments.length > 0 && (
        <div>
          {Object.keys(frameGroups).length > 0 && (
            <div className="flex items-center space-x-2 mb-2 text-sm font-medium">
              <span>General Comments</span>
            </div>
          )}
          {generalComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              traceId={traceId}
              currentDepth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentList; 