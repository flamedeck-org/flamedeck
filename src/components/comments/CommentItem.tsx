import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { TraceCommentWithAuthor } from '@/lib/api'; // Use the type that includes author info
import { getInitials } from '@/lib/utils'; // Assuming a utility for initials
import CommentForm from '@/components/CommentForm'; // Added CommentForm import
import { cn } from '@/lib/utils'; // Added cn function for conditional classes

// Define recursive type for structured comments
export interface StructuredComment extends TraceCommentWithAuthor {
  replies: StructuredComment[];
}

interface CommentItemProps {
  traceId: string; // Need traceId for the reply form
  comment: StructuredComment; // Use the structured type
  onStartReply: (commentId: string) => void;
  replyingToCommentId: string | null; // Pass the ID being replied to, not a boolean
  onCancelReply: () => void;
  currentDepth?: number; // Add depth tracking for indentation
  showReplyButton?: boolean; // New prop to control reply button visibility
}

const MAX_REPLY_DEPTH = 3; // Limit nesting depth

// Renamed from TraceViewerCommentItem
export function CommentItem({ 
  traceId,
  comment, 
  onStartReply,
  replyingToCommentId, // Receive the ID
  onCancelReply,
  currentDepth = 0, // Default depth is 0
  showReplyButton = true, // Default to true
}: CommentItemProps) {
  const author = comment.author;
  const authorName = author?.username || author?.first_name || 'Unknown User';
  const avatarUrl = author?.avatar_url;
  const initials = getInitials(authorName); // Use utility or simple logic
  
  const canReply = currentDepth < MAX_REPLY_DEPTH;
  
  // Determine if the form should be shown for THIS specific comment
  const showReplyFormForThisComment = replyingToCommentId === comment.id;

  const handleReplySuccess = () => {
    onCancelReply(); // Close the reply form on successful post
  }

  return (
    <div className={cn(
      "flex space-x-3 py-3", // Removed px-4, rely on parent container. Kept py-3.
      // Removed border-b logic, handled by group container
      // currentDepth > 0 && `pl-${currentDepth * 4}` // Removed direct padding, handle via reply container
    )}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={avatarUrl ?? undefined} alt={authorName} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold truncate">{authorName}</h4> {/* Added truncate */} 
          <p className="text-xs text-muted-foreground flex-shrink-0 ml-2"> {/* Added flex-shrink-0 ml-2 */} 
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </p>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words"> {/* Added break-words */} 
          {comment.content}
        </p>
        
        <div className="mt-2 flex items-center space-x-2">
          {/* Reply Button (show if we CAN reply, are ALLOWED to show button, and form is NOT currently shown for this comment) */} 
          {canReply && showReplyButton && !showReplyFormForThisComment && (
            <Button 
              variant="ghost"
              size="xs"
              className="text-xs h-auto px-1 py-0 text-muted-foreground hover:text-foreground"
              onClick={() => onStartReply(comment.id)}
            >
              Reply
            </Button>
          )}
          {/* Add other actions like Edit/Delete later */} 
        </div>
          
        {/* Reply Form Area (Rendered if showReplyFormForThisComment is true) */}
        {showReplyFormForThisComment && (
          <div className="mt-2">
            <CommentForm 
              traceId={traceId}
              parentId={comment.id}
              commentType={comment.comment_type}
              commentIdentifier={comment.comment_identifier}
              placeholder={`Replying to ${authorName}...`}
              onCommentPosted={handleReplySuccess}
              onCancel={onCancelReply}
              autoFocus
            />
          </div>
        )}

        {/* Render Replies Recursively */}
        {comment.replies && comment.replies.length > 0 && (
            // Container for replies with border and padding for visual structure
            <div className="mt-4 ml-4 pl-4 border-l border-border/50 space-y-3"> 
                {comment.replies.map(reply => (
                    <CommentItem
                        key={reply.id}
                        traceId={traceId}
                        comment={reply} 
                        replyingToCommentId={replyingToCommentId} 
                        onStartReply={onStartReply} 
                        onCancelReply={onCancelReply} 
                        currentDepth={currentDepth + 1} 
                    />
                ))}
            </div>
        )}

      </div>
    </div>
  );
} 