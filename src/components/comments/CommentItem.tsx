import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { TraceCommentWithAuthor, updateTraceComment, deleteTraceCommentLogically } from '@/lib/api'; // Use the type that includes author info, Import updateTraceComment, Import deleteTraceCommentLogically
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
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"; // Import AlertDialog

export interface StructuredComment extends TraceCommentWithAuthor {
  replies: StructuredComment[];
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete dialog

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

  const handleDeleteConfirm = async () => {
    const { error } = await deleteTraceCommentLogically(comment.id);
    if (error) {
      toast.error(`Failed to delete comment: ${error.message}`);
    } else {
      toast.success("Comment deleted");
      // Update the local cache to reflect deletion immediately
      // We create a placeholder object with the deleted flag
      const deletedCommentData: TraceCommentWithAuthor = {
        ...comment,
        content: '[deleted]', // Optional: Clear content locally too
        is_deleted: true,
        // Clear replies locally if desired, though they exist in DB
        replies: [], 
        // Nullify author locally if desired
        // author: null, 
      };
      onCommentUpdated(deletedCommentData); // Use the existing update handler
    }
    setIsDeleteDialogOpen(false); // Close dialog regardless of outcome
  };

  return (
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <div 
        className={cn("flex space-x-3 py-2 relative", /* Removed group */ )}
      >
        {/* Indentation Line for Replies */} 
        {currentDepth > 0 && (
           <div className="absolute left-0 top-0 bottom-0 w-px bg-border"></div> 
        )}
        
        {/* Avatar - Adjust margin based on depth */} 
        <Avatar className={cn("h-8 w-8 mt-1 flex-shrink-0", currentDepth > 0 && "ml-8")}>
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
              {/* Hide actions if comment is deleted OR if editing */}
              {!comment.is_deleted && !isEditing && (
                  <div className="flex items-center space-x-1">
                      {!showReplyFormForThisComment && canReply && showReplyButton && (
                          <Button
                              variant="ghost"
                              size="xs" // Use a small text button size
                              className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground" // Adjusted padding/height for text
                              onClick={() => {
                                onStartReply(comment.id)
                              }}
                              title="Reply"
                          >
                             Reply {/* Changed icon to text */}
                          </Button>
                      )}
                      {/* More Options Dropdown - Only render if user is the author */} 
                      {isAuthor && (
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
                                {/* --- Add Delete Option --- */} 
                                {isAuthor && (
                                  <DropdownMenuItem 
                                    onSelect={() => setIsDeleteDialogOpen(true)} 
                                    // Increase opacity on hover/focus
                                    className="text-destructive hover:bg-destructive/20 focus:bg-destructive/20 focus:text-destructive"
                                  >
                                    Delete comment
                                  </DropdownMenuItem>
                                )}
                                {/* ------------------------- */} 
                            </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                  </div>
              )}
          </div>
          
          {/* Content Area: Show placeholder if deleted, form if editing, otherwise content */}
          <div className="pt-0.5"> 
            {comment.is_deleted ? (
              <p className="text-sm italic text-muted-foreground">[comment deleted]</p>
            ) : isEditing ? (
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
          
          {/* Reply Form Area - Conditionally render based on state AND not deleted */}
          {!comment.is_deleted && showReplyFormForThisComment && (
            <div className="pt-2 pb-1">
              {/* ------------------------------------ */}
              <CommentForm 
                traceId={traceId}
                parentId={comment.id}
                // Ensure correct props for REPLY form
                commentType={comment.comment_type} 
                commentIdentifier={comment.comment_identifier}
                placeholder={`Replying to ${authorName}...`}
                onCommentPosted={handleReplySuccess} // Should reset reply state
                onCancel={onCancelReply} // Use the cancel reply handler
                autoFocus
                // mode defaults to 'create', which is correct here
              />
            </div>
          )}
          
          {/* Render Replies Recursively - Render even if parent is deleted */}
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
      
      {/* Delete Confirmation Dialog */} 
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the comment as deleted. Replies will remain but may lose context. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDeleteConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Comment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 