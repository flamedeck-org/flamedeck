import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TraceCommentWithAuthor } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import CommentForm from './CommentForm';
import { MessageSquare } from 'lucide-react'; // Reply icon

interface CommentItemProps {
  comment: TraceCommentWithAuthor;
  traceId: string;
  // We might pass down replies later if we handle nesting here
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, traceId }) => {
  const [showReplyForm, setShowReplyForm] = useState(false);

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

  return (
    <div className="flex space-x-3 py-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarUrl ?? undefined} alt={authorName} />
        <AvatarFallback>{avatarFallback}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
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
        <p className="text-sm">{comment.content}</p>
        <div className="flex items-center pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Reply
          </Button>
          {/* Add Like/Reaction buttons later if needed */}
        </div>
        {showReplyForm && (
          <div className="pt-2">
            <CommentForm
              traceId={traceId}
              parentId={comment.id} // Replying to this comment
              placeholder={`Replying to ${authorName}...`}
              onCommentPosted={() => setShowReplyForm(false)} // Hide form on success
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentItem; 