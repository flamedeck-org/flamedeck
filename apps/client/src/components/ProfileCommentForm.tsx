import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type { NewTraceComment, ApiError } from "@/lib/api";
import { traceApi } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileCommentFormProps {
  traceId: string;
  parentId?: string | null;
  commentType: string;
  commentIdentifier: string | null;
  onCommentPosted?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const ProfileCommentForm: React.FC<ProfileCommentFormProps> = ({
  traceId,
  parentId = null,
  commentType,
  commentIdentifier,
  onCommentPosted,
  onCancel,
  placeholder = "Add a comment...",
  autoFocus = false,
}) => {
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    setContent("");
  }, [commentIdentifier, commentType]);

  const commentMutation = useMutation({
    mutationFn: (newComment: NewTraceComment & { trace_id: string }) =>
      traceApi.createTraceComment(newComment, user.id),
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["traceComments", traceId] });
      toast({ title: "Comment posted!" });
      onCommentPosted?.();
    },
    onError: (error: ApiError) => {
      toast({
        title: "Error posting comment",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    const newCommentData: NewTraceComment & { trace_id: string } = {
      trace_id: traceId,
      content: content.trim(),
      parent_comment_id: parentId,
      trace_timestamp_ms: null,
      comment_type: commentType,
      comment_identifier: commentIdentifier,
    };

    commentMutation.mutate(newCommentData);
  };

  const handleCancel = () => {
    setContent("");
    onCancel?.();
  };

  if (!user) {
    return <p className="text-sm text-muted-foreground">Please log in to comment.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        disabled={commentMutation.isPending}
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        required
        className="resize-none"
      />
      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={handleCancel} size="sm">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={commentMutation.isPending || !content.trim()} size="sm">
          {commentMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...
            </>
          ) : (
            "Post Comment"
          )}
        </Button>
      </div>
    </form>
  );
};

export default ProfileCommentForm;
