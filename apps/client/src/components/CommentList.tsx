import React from "react";
import { useQuery } from "@tanstack/react-query";
import type { TraceCommentWithAuthor } from "@/lib/api";
import { traceApi } from "@/lib/api";
import CommentItem from "./CommentItem";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, MessageSquare } from "lucide-react";

// Type for structured comment including potentially nested replies
type StructuredComment = TraceCommentWithAuthor & { replies: StructuredComment[] };

interface CommentListProps {
  traceId: string;
}

const structureComments = (comments: TraceCommentWithAuthor[]): StructuredComment[] => {
  const commentMap: { [key: string]: StructuredComment } = {};
  const rootComments: StructuredComment[] = [];

  comments.forEach((comment) => {
    commentMap[comment.id] = { ...comment, replies: [] };
  });

  comments.forEach((comment) => {
    const mappedComment = commentMap[comment.id];
    if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
      // Ensure parent exists before pushing
      commentMap[comment.parent_comment_id].replies.push(mappedComment);
    } else {
      rootComments.push(mappedComment);
    }
  });

  // Sort root comments: specific comments first, grouped, then general comments
  rootComments.sort((a, b) => {
    const isAOverview = a.comment_type === "overview";
    const isBOverview = b.comment_type === "overview";

    // If both are overview or both are specific, sort by date (newest first)
    if (isAOverview === isBOverview) {
      // If they are specific and have the same identifier, sort by date
      if (!isAOverview && a.comment_identifier === b.comment_identifier) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // If they are specific with different identifiers, sort by identifier (grouping)
      if (!isAOverview) {
        // Handle null identifiers just in case, though should be non-null for non-overview
        const idA = String(a.comment_identifier ?? "");
        const idB = String(b.comment_identifier ?? "");
        if (idA !== idB) {
          return idA.localeCompare(idB);
        }
      }
      // If both are overview or same identifier, sort by date
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    // Specific comments come before overview comments
    return isAOverview ? 1 : -1;
  });

  return rootComments;
};

// Function to group comments by type/identifier
const groupCommentsByTypeAndIdentifier = (comments: StructuredComment[]) => {
  const specificGroups: Record<string, { type: string; comments: StructuredComment[] }> = {};
  const generalComments: StructuredComment[] = [];

  comments.forEach((comment) => {
    if (comment.comment_type !== "overview" && comment.comment_identifier) {
      const key = `${comment.comment_type}-${comment.comment_identifier}`;
      if (!specificGroups[key]) {
        specificGroups[key] = { type: comment.comment_type, comments: [] };
      }
      specificGroups[key].comments.push(comment);
    } else {
      // Treat as general if type is 'overview' or identifier is missing
      generalComments.push(comment);
    }
  });

  return { specificGroups, generalComments };
};

const CommentList: React.FC<CommentListProps> = ({ traceId }) => {
  const {
    data: comments,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["traceComments", traceId],
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
  const { specificGroups, generalComments } = groupCommentsByTypeAndIdentifier(threadedComments);

  return (
    <div className="space-y-6 pt-4">
      {/* Specific comments (Grouped) */}
      {Object.entries(specificGroups).map(([groupKey, groupData]) => {
        // Extract identifier from the key (it's after the first '-')
        const identifier = groupKey.substring(groupData.type.length + 1);
        return (
          <div key={groupKey} className="mb-6">
            <div className="flex items-center space-x-2 mb-2 text-sm font-medium bg-muted p-2 rounded capitalize">
              <MessageSquare className="h-4 w-4" />
              {/* Make title more descriptive */}
              <span>
                Comments on {groupData.type}: {identifier}
              </span>
              <span className="text-muted-foreground">({groupData.comments.length})</span>
            </div>
            <div className="ml-4">
              {groupData.comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  traceId={traceId}
                  currentDepth={0}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* General comments (Overview) */}
      {generalComments.length > 0 && (
        <div>
          {Object.keys(specificGroups).length > 0 && (
            <div className="flex items-center space-x-2 mb-2 text-sm font-medium">
              <span>Overview Comments</span>
            </div>
          )}
          {generalComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} traceId={traceId} currentDepth={0} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentList;
