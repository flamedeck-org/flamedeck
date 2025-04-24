import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { TraceCommentWithAuthor } from '@/lib/api'; // Use the type that includes author info
import { getInitials } from '@/lib/utils'; // Assuming a utility for initials

interface TraceViewerCommentItemProps {
  comment: TraceCommentWithAuthor;
  // Add props for reply, edit, delete later if needed
}

export function TraceViewerCommentItem({ comment }: TraceViewerCommentItemProps) {
  const author = comment.author;
  const authorName = author?.username || author?.first_name || 'Unknown User';
  const avatarUrl = author?.avatar_url;
  const initials = getInitials(authorName); // Use utility or simple logic

  return (
    <div className="flex space-x-3 py-3 px-4 border-b border-border last:border-b-0">
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarUrl ?? undefined} alt={authorName} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{authorName}</h4>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </p>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {comment.content}
        </p>
        {/* Add Reply/Actions button here later */}
      </div>
    </div>
  );
} 