import type { SpeedscopeViewType } from '@/components/SpeedscopeViewer';
import type { StructuredComment } from '@/components/comments';
import type { TraceCommentWithAuthor } from '@/lib/api';

// Helper to map comment type to SpeedscopeViewType
export const commentTypeToViewType = (commentType: string): SpeedscopeViewType | null => {
  switch (commentType) {
    case 'chrono':
      return 'time_ordered';
    case 'left_heavy':
      return 'left_heavy';
    case 'sandwich':
      return 'sandwich';
    default:
      return null;
  }
};

// Helper to get a display name for the comment type section
export const getCommentSectionTitle = (commentType: string): string => {
  switch (commentType) {
    case 'overview':
      return 'General Comments';
    case 'chrono':
      return 'Timeline View Comments';
    case 'left_heavy':
      return 'Left Heavy View Comments';
    case 'sandwich':
      return 'Sandwich View Comments';
    default:
      return `Comments (${commentType})`;
  }
};

// Helper function to structure comments
export const structureComments = (comments: TraceCommentWithAuthor[]): StructuredComment[] => {
  const commentMap: { [key: string]: StructuredComment } = {};
  const rootComments: StructuredComment[] = [];

  comments.forEach((comment) => {
    commentMap[comment.id] = { ...comment, replies: [] };
  });

  comments.forEach((comment) => {
    const mappedComment = commentMap[comment.id];
    if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
      // Make sure parent exists and it's not the comment itself
      if (comment.id !== comment.parent_comment_id) {
        commentMap[comment.parent_comment_id].replies.push(mappedComment);
      }
    } else {
      rootComments.push(mappedComment);
    }
  });

  // Optional: Sort replies within each comment (e.g., oldest first)
  Object.values(commentMap).forEach((comment) => {
    comment.replies.sort(
      (a: StructuredComment, b: StructuredComment) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  return rootComments;
};
