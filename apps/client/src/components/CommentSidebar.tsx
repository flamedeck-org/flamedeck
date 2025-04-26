import React from 'react';
// import ProfileCommentForm from './ProfileCommentForm'; // Assume using CommentForm instead
import CommentForm from './CommentForm'; // Use the generic CommentForm
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
// Assuming the Comment type is exported from the hook or a types file
// import { Comment } from '@/hooks/useTraceComments'; // This type might need adjustment
import { TraceCommentWithAuthor } from '@/lib/api'; // Use the consistent type
import { CommentItem, StructuredComment } from '@/components/comments'; // Import CommentItem
import { cn } from "@/lib/utils";
import { useState } from 'react'; // Import useState for reply state

interface CommentSidebarProps {
  traceId: string;
  cellId: string;
  cellName: string | null;
  commentType: string; // e.g., 'chrono', 'sandwich'
  comments: TraceCommentWithAuthor[]; // Use the consistent type
  isLoading: boolean;
  error: Error | null;
  onClose: () => void;
  // Add props needed by CommentItem that CommentList previously managed
  replyingToCommentId: string | null;
  onStartReply: (commentId: string) => void;
  onCancelReply: () => void;
  onCommentUpdated: (updatedComment: TraceCommentWithAuthor) => void;
}

const CommentSidebar: React.FC<CommentSidebarProps> = ({
  traceId,
  cellId,
  cellName,
  commentType,
  comments, // Expecting TraceCommentWithAuthor[] now
  isLoading,
  error,
  onClose,
  // Receive new props
  replyingToCommentId,
  onStartReply,
  onCancelReply,
  onCommentUpdated,
}) => {
  // Filter comments for the specific cellId and type
  // Assuming `comments` prop already contains potentially relevant comments
  const relevantComments = comments.filter(
    comment => comment.comment_identifier === cellId && comment.comment_type === commentType
  ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // Sort oldest first

  const handleCommentPosted = () => {
    // Comments will be refetched by the parent's useTraceComments hook automatically
    // potentially scroll to bottom or give feedback?
    console.log('New comment posted, sidebar remains open.');
  };

  const emptyMessage = `No comments for this item yet.`;
  const headerTitle = cellName || '<unnamed>';

  return (
    <div className="w-[350px] border-l flex flex-col bg-background absolute right-0 top-0 bottom-[160px]">
      {/* Header */}
      <div className="p-3 py-2 border-b flex justify-between items-center flex-shrink-0">
        {/* Updated Header Title */}
        <h3 
          className="text-base font-semibold truncate"
          title={headerTitle} // Show full title on hover if truncated
        >
          {headerTitle}
        </h3>
        {/* Removed the subtitle div */}
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close comments">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Comment List Area - Now rendering CommentItem directly */}
      <ScrollArea className="h-full">
        <div className={cn("flex flex-col px-4 py-2", /* className might be needed here */)}> 
          {isLoading ? (
             <div className="space-y-3 py-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive">
              Error loading comments: {error.message}
            </div>
          ) : relevantComments.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">
              {emptyMessage}
            </div>
          ) : (
            relevantComments.map((comment) => (
              <CommentItem 
                // Pass necessary props directly to CommentItem
                key={comment.id} 
                // Cast comment - NOTE: This assumes no replies needed in sidebar context
                // If replies ARE needed, structuring is required before this map
                comment={comment} // Pass the plain comment data
                traceId={traceId}
                replyingToCommentId={replyingToCommentId}
                onStartReply={onStartReply}
                onCancelReply={onCancelReply}
                onCommentUpdated={onCommentUpdated} // Pass the update handler
                showReplyButton={false} // Explicitly hide reply button in sidebar view
                currentDepth={0} // Top-level comments in this context
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Comment Form */}
      <div className="p-3 border-t flex-shrink-0 bg-background">
        <CommentForm
          traceId={traceId}
          commentType={commentType}
          commentIdentifier={cellId} // Send cellId to backend
          onCommentPosted={handleCommentPosted}
          placeholder={`Add a comment...`} // Simplified placeholder
        />
      </div>
    </div>
  );
};

export default CommentSidebar; 