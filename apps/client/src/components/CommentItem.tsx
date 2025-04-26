import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TraceCommentWithAuthor } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import CommentForm from './CommentForm';
import { MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'; // Added Chevron icons

// Define recursive type for structured comments
interface StructuredComment extends TraceCommentWithAuthor {
  replies: StructuredComment[];
}

interface CommentItemProps {
  comment: StructuredComment; // Use the defined recursive type
  traceId: string;
  currentDepth?: number;
  maxDepth?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  traceId,
  currentDepth = 0,
  maxDepth = 4
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(currentDepth === 0); // Expand only first level by default

  // Use username or first_name for display name
  const authorName = comment.author?.username || comment.author?.first_name || 'Anonymous';
  const avatarUrl = comment.author?.avatar_url;
  // Update fallback to use first_name initial if available
  const avatarFallback = 
    comment.author?.username?.charAt(0) || 
    comment.author?.first_name?.charAt(0) || 
    'A'; // Fallback for anonymous

  // Format timestamp (TODO: Implement linking)
  const timestampText = comment.trace_timestamp_ms
    ? ` @ ${(comment.trace_timestamp_ms / 1000).toFixed(2)}s`
    : '';

  const canReply = currentDepth < maxDepth - 1;

  const hasReplies = comment.replies && comment.replies.length > 0;
  const canShowReplies = hasReplies && currentDepth < maxDepth - 1;

  return (
    <div className="flex items-start space-x-3 py-2">
      <Avatar className="h-8 w-8 relative mt-0.5">
        <AvatarImage src={avatarUrl ?? undefined} alt={authorName} />
        <AvatarFallback>{avatarFallback}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">{authorName}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {timestampText && (
              <span className="text-xs text-blue-500 ml-2 font-mono cursor-pointer" title={`Jump to ${timestampText.trim()}`}>
                {timestampText}
              </span>
            )}
          </div>
          {/* Add Edit/Delete buttons later if needed */}
        </div>
        <p className="text-sm pb-0.5 whitespace-pre-wrap">{comment.content}</p>
        <div className="flex items-center pt-0">
          {canReply && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground h-auto py-0.5 px-1"
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Reply
            </Button>
          )}
          {/* Add Like/Reaction buttons later if needed */}
        </div>
        {showReplyForm && canReply && (
          <div className="pt-1 pb-1">
            <CommentForm
              traceId={traceId}
              parentId={comment.id}
              placeholder={`Replying to ${authorName}...`}
              onCommentPosted={() => setShowReplyForm(false)}
              autoFocus
            />
          </div>
        )}

        {/* Toggle Button for Replies */}
        {canShowReplies && (
           <Button
             variant="ghost"
             size="sm"
             className="text-xs text-muted-foreground hover:text-foreground h-auto py-0.5 px-1 mt-1"
             onClick={() => setIsExpanded(!isExpanded)}
           >
             {isExpanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
             {comment.replies.length} {comment.replies.length === 1 ? 'Reply' : 'Replies'}
           </Button>
        )}

        {/* Render Replies */}
        {canShowReplies && isExpanded && (
          <div className="ml-4 pl-4 border-l border-border space-y-0 mt-2">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                traceId={traceId}
                currentDepth={currentDepth + 1}
                maxDepth={maxDepth}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentItem; 