import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { TraceCommentWithAuthor, updateTraceComment } from '@/lib/api'; // Use the type that includes author info, Import updateTraceComment
import { getInitials } from '@/lib/utils'; // Assuming a utility for initials
import CommentForm from '@/components/CommentForm'; // Added CommentForm import
import { cn } from '@/lib/utils'; // Added cn function for conditional classes
import { CornerDownRight, MoreHorizontal } from 'lucide-react'; // Import Reply icon, Import MoreHorizontal
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Import DropdownMenu components
import { toast } from 'sonner'; // Assuming you use sonner for toasts
import { useAuth } from '@/contexts/AuthContext';

// Define recursive type for structured comments
export interface StructuredComment extends TraceCommentWithAuthor {
  replies: StructuredComment[];
  onStartReply: (commentId: string) => void;
  replyingToCommentId: string | null; // Pass the ID being replied to, not a boolean
  onCancelReply: () => void;
  onCommentUpdated: (updatedComment: TraceCommentWithAuthor) => void;
  currentDepth?: number; // Add depth tracking for indentation
  showReplyButton?: boolean; // New prop to control reply button visibility
}

interface CommentItemProps {
  traceId: string; // Need traceId for the reply form
  comment: StructuredComment; // Use the structured type
  onStartReply: (commentId: string) => void;
  replyingToCommentId: string | null; // Pass the ID being replied to, not a boolean
  onCancelReply: () => void;
  onCommentUpdated: (updatedComment: TraceCommentWithAuthor) => void;
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
  onCommentUpdated, // Receive the update handler
  currentDepth = 0, // Default depth is 0
  showReplyButton = true, // Default to true
}: CommentItemProps) {
  const { user } = useAuth(); 
  const [isEditing, setIsEditing] = useState(false); // State for edit mode

  const author = comment.author;
  const authorName = author?.username || author?.first_name || 'Unknown User';
  const avatarUrl = author?.avatar_url;
  const initials = getInitials(authorName); // Use utility or simple logic
  
  const canReply = currentDepth < MAX_REPLY_DEPTH;
  
  // Determine if the form should be shown for THIS specific comment
  const showReplyFormForThisComment = replyingToCommentId === comment.id;
  const isAuthor = user?.id === comment.user_id; // Check if current user is the author

  const handleReplySuccess = () => {
    onCancelReply(); // Close the reply form on successful post
  }

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleEditSubmit = async (editedContent: string) => {
    if (editedContent.trim() === comment.content) {
      setIsEditing(false); // No change, just cancel
      return;
    }
    const { data, error } = await updateTraceComment(comment.id, editedContent);
    if (error) {
      toast.error(`Failed to update comment: ${error.message}`);
      // Optionally keep editing state true on error?
    } else if (data) {
      toast.success("Comment updated successfully");
      setIsEditing(false);
      // Call the callback to update the comment in the parent's state
      // We need to merge the potentially partial 'data' (TraceComment)
      // with the existing 'comment' (TraceCommentWithAuthor) data.
      const updatedCommentData: TraceCommentWithAuthor = {
          ...comment, // Keep existing author info etc.
          content: data.content,
          is_edited: data.is_edited ?? true, // Use DB value or assume true
          last_edited_at: data.last_edited_at ?? new Date().toISOString(), // Use DB value or current time
          updated_at: data.updated_at ?? new Date().toISOString(), // Use DB value or current time
      };
      onCommentUpdated(updatedCommentData);
    }
  };

  return (
    <div 
      className={cn("flex space-x-3 py-2 relative", /* Removed group */ )}
    >
      {/* Indentation Line for Replies */} 
      {currentDepth > 0 && (
         <div className="absolute left-0 top-0 bottom-0 w-px bg-border"></div> 
      )}
      
      {/* Avatar - Adjust margin based on depth */} 
      <Avatar className={cn("h-8 w-8 flex-shrink-0", currentDepth > 0 && "ml-8")}>
        <AvatarImage src={avatarUrl ?? undefined} alt={authorName} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      
      {/* Main Content Area */} 
      <div className="flex-1 space-y-0.5 min-w-0"> {/* Reduced space-y */} 
        
        {/* Header Row: Author + Timestamp + Actions */} 
        <div className="flex items-center justify-between">
            {/* Left Side: Author + Timestamp + Edited indicator */}
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <h4 className="text-sm font-semibold truncate text-foreground">{authorName}</h4>
                <span className="flex-shrink-0 whitespace-nowrap">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
                {comment.is_edited && (
                    <span className="text-xs text-muted-foreground/80">(edited)</span>
                )}
            </div>
            
            {/* Right Side: Actions (Reply & More Options) */}
            {/* Don't show actions while editing this comment */}
            {!isEditing && (
                <div className="flex items-center space-x-1">
                    {!showReplyFormForThisComment && canReply && showReplyButton && (
                        <Button
                            variant="ghost"
                            size="xs" // Use a small text button size
                            className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground" // Adjusted padding/height for text
                            onClick={() => onStartReply(comment.id)}
                            title="Reply"
                        >
                           Reply {/* Changed icon to text */}
                        </Button>
                    )}
                    {/* More Options Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" title="More options">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {isAuthor && (
                                <DropdownMenuItem onSelect={handleEdit}>
                                    Edit comment
                                </DropdownMenuItem>
                            )}
                            {/* Add other options like Delete here if needed */}
                            <DropdownMenuItem disabled>
                                Copy link to comment
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
        
        {/* Content Area: Show CommentForm if editing, otherwise show content */}
        <div className="pt-0.5"> {/* Added slight top padding */} 
            {isEditing ? (
                 <CommentForm
                    traceId={traceId} // Required, but not directly used for update logic
                    initialContent={comment.content} // Pass current content
                    placeholder="Edit your comment..."
                    onCommentPosted={handleEditSubmit} // Use the edit handler
                    onCancel={handleCancelEdit}
                    submitButtonText="Save Changes"
                    autoFocus
                    mode='edit' // Specify edit mode
                    // Pass nulls/undefined for fields not relevant to editing an existing comment
                    parentId={null}
                    commentType={undefined}
                    commentIdentifier={undefined}
                 />
            ) : (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                    {comment.content}
                </p>
            )}
        </div>
        
        {/* Render Replies Recursively */}
        {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2 space-y-0"> 
                {comment.replies.map(reply => (
                    <CommentItem
                        key={reply.id}
                        traceId={traceId}
                        comment={reply} 
                        replyingToCommentId={replyingToCommentId} 
                        onStartReply={onStartReply} 
                        onCancelReply={onCancelReply} 
                        onCommentUpdated={onCommentUpdated} // Pass down the handler
                        currentDepth={currentDepth + 1} 
                        showReplyButton={showReplyButton}
                    />
                ))}
            </div>
        )}
      </div>
    </div>
  );
} 