import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { traceApi } from '@/lib/api';
import { ArrowLeft, Trash2, Eye, Share2, ExternalLink, AlertTriangle } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import PageHeader from '@/components/PageHeader';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import CommentForm from '@/components/CommentForm';
import type { StructuredComment } from '@/components/comments';
import { CommentItem } from '@/components/comments';
import { Separator } from '@/components/ui/separator';
import { buttonVariants } from '@/components/ui/button';
import type { ProfileType } from 'packages/speedscope-import/src';
import type { SpeedscopeViewType } from '@/components/SpeedscopeViewer';
import { useSharingModal } from '@/hooks/useSharingModal';
import { useTraceDetails } from '@/hooks/useTraceDetails';
import { useTraceComments } from '@/hooks/useTraceComments';
import { useAuth } from '@/contexts/AuthContext';
import { formatDuration } from '@/lib/utils';
import type { TraceCommentWithAuthor } from '@/lib/api';
import { useCommentManagement } from '@/hooks/useCommentManagement';
import { UserAvatar } from '@/components/UserAvatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { TraceTitle } from '@/components/TraceDetail';

// Function to get human-readable profile type name
const getProfileTypeName = (profileType: ProfileType | string | undefined): string => {
  if (!profileType) return 'Unknown';

  const typeMap: Record<ProfileType | string, string> = {
    speedscope: 'Speedscope',
    pprof: 'pprof (Go/Protobuf)',
    'chrome-timeline': 'Chrome Timeline',
    'chrome-cpuprofile': 'Chrome CPU Profile',
    'chrome-cpuprofile-old': 'Chrome CPU Profile (Old)',
    'chrome-heap-profile': 'Chrome Heap Profile',
    stackprof: 'Stackprof (Ruby)',
    'instruments-deepcopy': 'Instruments Deep Copy (macOS)',
    'instruments-trace': 'Instruments Trace (macOS)',
    'linux-perf': 'Linux Perf',
    'collapsed-stack': 'Collapsed Stack',
    'v8-prof-log': 'V8 Log',
    firefox: 'Firefox Profile',
    safari: 'Safari Profile',
    haskell: 'Haskell GHC Profile',
    'trace-event': 'Trace Event',
    callgrind: 'Callgrind',
    papyrus: 'Papyrus (Skyrim)',
    unknown: 'Unknown',
  };

  return typeMap[profileType] || profileType; // Return mapped name or the original string if not in map
};

// Helper to map comment type to SpeedscopeViewType
const commentTypeToViewType = (commentType: string): SpeedscopeViewType | null => {
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
const getCommentSectionTitle = (commentType: string): string => {
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

// --- Helper function to structure comments (moved here) ---
const structureComments = (comments: TraceCommentWithAuthor[]): StructuredComment[] => {
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
// ---------------------------------------------------------

const TraceDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openModal } = useSharingModal();
  const { user: currentUser } = useAuth();

  const { data: trace, isLoading: traceLoading, error: traceError } = useTraceDetails(id);

  const { allComments, isLoading: commentsLoading, error: commentsError } = useTraceComments(id);

  // Determine authentication status
  const isAuthenticated = !!currentUser;

  // Use the new hook
  const { replyingToCommentId, handleStartReply, handleCancelReply, handleCommentUpdate } =
    useCommentManagement(id, isAuthenticated);

  // Structure the comments
  const structuredComments = useMemo(() => {
    return allComments ? structureComments(allComments) : [];
  }, [allComments]);

  // Group structured root comments by type
  const groupedComments = useMemo(() => {
    if (!structuredComments) return {};
    // Group only the ROOT comments
    return structuredComments.reduce<Record<string, StructuredComment[]>>((acc, comment) => {
      const type = comment.comment_type || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(comment); // Add the whole structured comment object
      return acc;
    }, {});
  }, [structuredComments]);

  const commentTypes = useMemo(() => {
    const types = Object.keys(groupedComments);
    return types.sort((a, b) => {
      if (a === 'overview') return -1;
      if (b === 'overview') return 1;
      return a.localeCompare(b);
    });
  }, [groupedComments]);

  useEffect(() => {
    if (traceError?.code === 'PGRST116') {
      console.log('Trace not found or permission denied (PGRST116), navigating to /404');
      navigate('/404', { replace: true });
    }
  }, [traceError, navigate]);

  const deleteMutation = useMutation({
    mutationFn: (traceId: string) => traceApi.deleteTrace(traceId),
    onSuccess: () => {
      toast({
        title: 'Trace deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      navigate('/traces');
    },
    onError: (error) => {
      toast({
        title: 'Error deleting trace',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // updateScenarioMutation and its handlers are now in TraceTitle component
  // const updateScenarioMutation = useMutation({ ... });
  // const handleEditScenarioClick = () => { ... };
  // const handleScenarioInputChange = (event: React.ChangeEvent<HTMLInputElement>) => { ... };
  // const handleScenarioSave = () => { ... };
  // const handleScenarioCancel = () => { ... };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const dateOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    return `${date.toLocaleDateString(undefined, dateOptions)} ${date.toLocaleTimeString(undefined, timeOptions)}`;
  };

  const handleShareClick = () => {
    if (id) {
      openModal(id);
    } else {
      console.error('Trace ID is undefined, cannot open sharing modal.');
    }
  };

  const headerActions = (
    <div className="flex items-center gap-3">
      {/* Primary action button with gradient */}
      <Link
        to={`/traces/${id}/view`}
        state={{ blobPath: trace?.blob_path }}
        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white border-0 transition-all duration-300 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
      >
        <Eye className="mr-2 h-4 w-4" /> Explore Trace
      </Link>

      <div className="flex items-center gap-2">
        {/* Share button with glassmorphic design */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleShareClick}
          aria-label="Share Trace"
          className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300 shadow-sm hover:shadow-md"
        >
          <Share2 className="h-4 w-4" />
        </Button>

        {/* Delete button with enhanced styling */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={deleteMutation.isPending}
              aria-label="Delete Trace"
              className="bg-background/80 backdrop-blur-sm border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 text-red-600 hover:text-red-700 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-background/95 backdrop-blur-lg border border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the trace{' '}
                <strong>{trace?.scenario || `ID: ${trace?.id?.substring(0, 7)}`}</strong> and all
                associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => id && deleteMutation.mutate(id)}
                disabled={deleteMutation.isPending}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 transition-all duration-300"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Back button with glassmorphic design */}
        <Link
          to="/traces"
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300 shadow-sm hover:shadow-md"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Traces
        </Link>
      </div>
    </div>
  );

  const owner = trace?.owner;

  const ownerDisplayName = React.useMemo(() => {
    const isOwnerCurrentUser = currentUser && owner?.id === currentUser.id;
    if (isOwnerCurrentUser) return 'me';
    return (
      owner?.username ||
      `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() ||
      'Unknown Owner'
    );
  }, [owner, currentUser]);

  const ownerSubtitle = owner ? (
    <div className="flex items-center space-x-1.5 text-sm text-muted-foreground">
      <span>Owned by</span>
      {/* @ts-ignore */}
      <UserAvatar profile={owner} currentUser={currentUser} size="sm" />
      <span className="font-medium text-foreground">{ownerDisplayName}</span>
    </div>
  ) : null;

  const isLoading = traceLoading || commentsLoading;

  // Calculate expiration status for the current trace
  const expirationStatus = {
    isExpiring: false,
    daysRemaining: null,
    formattedExpirationDate: null,
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <Layout>
          <PageLayout>
            <PageHeader
              title={<TraceTitle trace={undefined} />}
              actions={<Skeleton className="h-9 w-36 rounded-md" />}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          </PageLayout>
        </Layout>
      </AuthGuard>
    );
  }

  if (traceError || !trace) {
    console.error('Failed to load trace details:', traceError);
    return (
      <AuthGuard>
        <Layout>
          <div className="text-center py-12 space-y-6">
            <p className="text-destructive">
              {traceError?.message || 'Trace data could not be loaded.'}
            </p>
            <Link to="/traces">
              <Button>Back to Traces</Button>
            </Link>
          </div>
        </Layout>
      </AuthGuard>
    );
  }

  if (!trace) {
    return <div>Trace data unavailable.</div>;
  }

  return (
    <AuthGuard>
      <Layout>
        <PageLayout>
          <PageHeader
            title={<TraceTitle trace={trace} />}
            subtitle={ownerSubtitle}
            actions={headerActions}
          />

          {/* Expiration Warning Alert */}
          {expirationStatus.isExpiring && (
            <Alert variant="warning" className="mb-5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Deletion Scheduled</AlertTitle>
              <AlertDescription className="mt-2 mb-2">
                This trace will be automatically deleted in approximately{' '}
                <strong>
                  {expirationStatus.daysRemaining}{' '}
                  {expirationStatus.daysRemaining === 1 ? 'day' : 'days'}
                </strong>
                {expirationStatus.formattedExpirationDate &&
                  ` (on ${expirationStatus.formattedExpirationDate})`}{' '}
                due to the configured data retention policy.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <Card className="bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground font-medium">Scenario</div>
                <div className="text-lg font-semibold truncate mt-1" title={trace?.scenario}>
                  {trace?.scenario || 'N/A'}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground font-medium">Uploaded</div>
                <div className="text-lg font-semibold mt-1">{formatDate(trace?.uploaded_at)}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground font-medium">Commit</div>
                <div className="text-lg font-semibold font-mono truncate mt-1" title={trace?.commit_sha}>
                  {trace?.commit_sha || 'N/A'}
                </div>
                {trace?.branch && (
                  <div className="text-sm text-muted-foreground mt-1 truncate" title={trace.branch}>
                    {trace.branch}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground font-medium">Duration</div>
                <div className="text-lg font-semibold text-red-600 mt-1">
                  {formatDuration(trace?.duration_ms)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground font-medium">Profile Format</div>
                <div className="text-lg font-semibold mt-1">{getProfileTypeName(trace?.profile_type)}</div>
              </CardContent>
            </Card>
          </div>

          {trace.notes && (
            <Card className="mt-6 bg-card/90 backdrop-blur-sm border border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground font-medium mb-3">Notes</div>
                <div className="whitespace-pre-wrap text-foreground leading-relaxed">{trace.notes}</div>
              </CardContent>
            </Card>
          )}

          {trace.id && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-6">Comments</h2>
              <Separator className="mb-8" />

              {/* Grouped Comment Lists */}
              {/* Handle Loading State */}
              {commentsLoading && (
                <Card className="bg-card/90 backdrop-blur-sm border border-border shadow-sm">
                  <CardContent className="pt-6">
                    <Skeleton className="h-20 w-full rounded-md" />
                  </CardContent>
                </Card>
              )}

              {/* Handle Error State */}
              {!commentsLoading && commentsError && (
                <Card className="bg-card/90 backdrop-blur-sm border border-red-500/30 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="text-red-600 p-4 rounded-md bg-red-500/10">
                      Error loading comments: {commentsError.message}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Handle Success State (With Comments) */}
              {!commentsLoading && !commentsError && (
                <div className="space-y-8">
                  {/* --- Render Overview Section First --- */}
                  <Card className="bg-card/90 backdrop-blur-sm border border-border shadow-sm">
                    <CardContent className="pt-6">
                      <div key="overview">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold">{getCommentSectionTitle('overview')}</h3>
                          {/* No context link for overview */}
                        </div>
                        {/* Render existing overview comments or empty state */}
                        {groupedComments['overview'] && groupedComments['overview'].length > 0 ? (
                          groupedComments['overview'].map((comment) => (
                            <CommentItem
                              key={comment.id}
                              traceId={trace.id}
                              comment={comment}
                              replyingToCommentId={replyingToCommentId}
                              onStartReply={handleStartReply}
                              onCancelReply={handleCancelReply}
                              onCommentUpdated={handleCommentUpdate}
                            />
                          ))
                        ) : (
                          <div className="text-muted-foreground italic py-4 text-sm">
                            No comments yet. Be the first to add one!
                          </div>
                        )}
                        {/* Always render the form for overview */}
                        <div className="pt-4">
                          <CommentForm
                            traceId={trace.id}
                            commentType="overview"
                            commentIdentifier={null}
                            placeholder="Add a general comment..."
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* --- Render Other Comment Sections --- */}
                  {commentTypes
                    .filter((type) => type !== 'overview') // Exclude overview as it's handled above
                    .map((commentType) => {
                      const commentsInSection = groupedComments[commentType];
                      const viewType = commentTypeToViewType(commentType);
                      const sectionTitle = getCommentSectionTitle(commentType);

                      if (!commentsInSection || commentsInSection.length === 0) {
                        return null;
                      }

                      return (
                        <Card key={commentType} className="bg-card/90 backdrop-blur-sm border border-border shadow-sm">
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-lg font-semibold">{sectionTitle}</h3>
                              {viewType && (
                                <Link
                                  to={`/traces/${trace.id}/view`}
                                  state={{
                                    initialView: viewType,
                                    blobPath: trace.blob_path,
                                  }}
                                  className={
                                    buttonVariants({ variant: 'outline', size: 'sm' }) +
                                    ' flex items-center'
                                  }
                                >
                                  View in Context <ExternalLink className="ml-1.5 h-3 w-3" />
                                </Link>
                              )}
                            </div>
                            {commentsInSection.map((comment) => (
                              <CommentItem
                                key={comment.id}
                                traceId={trace.id}
                                comment={comment}
                                replyingToCommentId={replyingToCommentId}
                                onStartReply={handleStartReply}
                                onCancelReply={handleCancelReply}
                                onCommentUpdated={handleCommentUpdate}
                              />
                            ))}
                            {/* No form needed for non-overview types here */}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </PageLayout>
      </Layout>
    </AuthGuard>
  );
};

export default TraceDetail;
