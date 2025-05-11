import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { StructuredComment } from './CommentItem';
import { CommentItem } from './CommentItem';
import type { TraceCommentWithAuthor } from '@/lib/api'; // Using this type for now
import { cn } from '@/lib/utils';

interface CommentListProps {
  comments: StructuredComment[];
  isLoading: boolean;
  error: Error | null;
  traceId: string;
  replyingToCommentId: string | null;
  onStartReply: (commentId: string) => void;
  onCancelReply: () => void;
  onCommentUpdated: (updatedComment: TraceCommentWithAuthor) => void;
  showReplyButton?: boolean;
  emptyStateMessage?: string;
  className?: string;
  scrollAreaClassName?: string;
}

export function CommentList({
  comments,
  isLoading,
  error,
  traceId,
  replyingToCommentId,
  onStartReply,
  onCancelReply,
  onCommentUpdated,
  showReplyButton,
  emptyStateMessage = 'No comments yet.',
  className,
  scrollAreaClassName,
}: CommentListProps) {
  if (isLoading) {
    return (
      <div className={cn('p-4 space-y-3', className)}>
        {' '}
        {/* Apply className here */}
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-sm text-destructive', className)}>
        {' '}
        {/* Apply className here */}
        Error loading comments: {error.message}
      </div>
    );
  }

  return (
    <ScrollArea className={cn(scrollAreaClassName)}>
      {' '}
      {/* Apply scrollAreaClassName here */}
      <div className={cn('flex flex-col px-4', className)}>
        {' '}
        {/* Apply className here */}
        {comments.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground text-center">
            {emptyStateMessage}
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              traceId={traceId}
              replyingToCommentId={replyingToCommentId}
              onStartReply={onStartReply}
              onCancelReply={onCancelReply}
              onCommentUpdated={onCommentUpdated}
              showReplyButton={showReplyButton}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
}
