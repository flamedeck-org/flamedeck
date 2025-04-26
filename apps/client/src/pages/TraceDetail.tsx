import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { traceApi } from "@/lib/api";
import { ArrowLeft, Trash2, Eye, Share2, ExternalLink } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "@/components/ui/alert-dialog";
import CommentForm from "@/components/CommentForm";
import { CommentList, CommentItem, StructuredComment } from "@/components/comments";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { ProfileType } from "@trace-view-pilot/shared-importer";
import { SpeedscopeViewType } from '@/components/SpeedscopeViewer';
import { useSharingModal } from '@/hooks/useSharingModal';
import { useTraceDetails } from '@/hooks/useTraceDetails';
import { useTraceComments } from '@/hooks/useTraceComments';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatDuration } from "@/lib/utils";
import { TraceCommentWithAuthor } from '@/lib/api';
import { useCommentManagement } from '@/hooks/useCommentManagement';

// Function to get human-readable profile type name
const getProfileTypeName = (profileType: ProfileType | string | undefined): string => {
  if (!profileType) return "Unknown";

  const typeMap: Record<ProfileType | string, string> = {
    'speedscope': 'Speedscope',
    'pprof': 'pprof (Go/Protobuf)',
    'chrome-timeline': 'Chrome Timeline',
    'chrome-cpuprofile': 'Chrome CPU Profile',
    'chrome-cpuprofile-old': 'Chrome CPU Profile (Old)',
    'chrome-heap-profile': 'Chrome Heap Profile',
    'stackprof': 'Stackprof (Ruby)',
    'instruments-deepcopy': 'Instruments Deep Copy (macOS)',
    'instruments-trace': 'Instruments Trace (macOS)',
    'linux-perf': 'Linux Perf',
    'collapsed-stack': 'Collapsed Stack',
    'v8-prof-log': 'V8 Log',
    'firefox': 'Firefox Profile',
    'safari': 'Safari Profile',
    'haskell': 'Haskell GHC Profile',
    'trace-event': 'Trace Event',
    'callgrind': 'Callgrind',
    'papyrus': 'Papyrus (Skyrim)',
    'unknown': 'Unknown',
  };

  return typeMap[profileType] || profileType; // Return mapped name or the original string if not in map
};

// Helper to map comment type to SpeedscopeViewType
const commentTypeToViewType = (commentType: string): SpeedscopeViewType | null => {
  switch (commentType) {
    case 'chrono': return 'time_ordered';
    case 'left_heavy': return 'left_heavy';
    case 'sandwich': return 'sandwich';
    default: return null;
  }
};

// Helper to get a display name for the comment type section
const getCommentSectionTitle = (commentType: string): string => {
  switch (commentType) {
    case 'overview': return 'General Comments';
    case 'chrono': return 'Timeline View Comments';
    case 'left_heavy': return 'Left Heavy View Comments';
    case 'sandwich': return 'Sandwich View Comments';
    default: return `Comments (${commentType})`;
  }
};

// --- Helper function to structure comments (moved here) --- 
const structureComments = (comments: TraceCommentWithAuthor[]): StructuredComment[] => {
  const commentMap: { [key: string]: StructuredComment } = {};
  const rootComments: StructuredComment[] = [];

  comments.forEach(comment => {
    commentMap[comment.id] = { ...comment, replies: [] };
  });

  comments.forEach(comment => {
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
  Object.values(commentMap).forEach(comment => {
      comment.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  });

  return rootComments;
};
// ---------------------------------------------------------

const TraceDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openModal } = useSharingModal();
  const { user: currentUser } = useAuth();

  const {
    data: trace,
    isLoading: traceLoading,
    error: traceError,
  } = useTraceDetails(id);

  const { 
    allComments, 
    isLoading: commentsLoading, 
    error: commentsError 
  } = useTraceComments(id);

  // Use the new hook
  const { 
    replyingToCommentId, 
    handleStartReply, 
    handleCancelReply, 
    handleCommentUpdate 
  } = useCommentManagement(id);

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
      console.log("Trace not found or permission denied (PGRST116), navigating to /404");
      navigate('/404', { replace: true });
    }
  }, [traceError, navigate]);

  const deleteMutation = useMutation({
    mutationFn: (traceId: string) => traceApi.deleteTrace(traceId),
    onSuccess: () => {
      toast({
        title: "Trace deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      navigate("/traces");
    },
    onError: (error) => {
      toast({
        title: "Error deleting trace",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const dateOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return `${date.toLocaleDateString(undefined, dateOptions)} ${date.toLocaleTimeString(undefined, timeOptions)}`;
  };

  const handleShareClick = () => {
    if (id) {
      openModal(id);
    } else {
      console.error("Trace ID is undefined, cannot open sharing modal.");
    }
  };

  const headerActions = (
    <div className="flex items-center space-x-2">
      <Link
        to={`/traces/${id}/view`}
        state={{ blobPath: trace?.blob_path }}
        className={buttonVariants({ variant: "default", size: "sm" })}
      >
        <Eye className="mr-2 h-4 w-4" /> Explore Trace
      </Link>

      <Button variant="default" size="sm" onClick={handleShareClick} aria-label="Share Trace">
         <Share2 className="h-4 w-4" />
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={deleteMutation.isPending} aria-label="Delete Trace">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trace{' '}
              <strong>{trace?.scenario || `ID: ${trace?.id.substring(0, 7)}`}</strong>{' '}
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => id && deleteMutation.mutate(id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Link 
        to="/traces"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Traces
      </Link>
    </div>
  );

  const traceId = trace?.id;
  const owner = trace?.owner;

  const ownerInfo = useMemo(() => {
    if (!owner) return { name: "Unknown Owner", initials: "?" };
    const isOwnerCurrentUser = currentUser && owner?.id === currentUser.id;
    const name = isOwnerCurrentUser 
      ? "me" 
      : owner?.username || `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || "Unknown Owner";
    const initials = name === 'me' 
      ? currentUser?.email?.[0].toUpperCase() ?? '?' 
      : name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
    const avatarUrl = isOwnerCurrentUser ? currentUser?.user_metadata?.avatar_url : owner?.avatar_url ?? undefined;
    return { name, initials, avatarUrl, isOwnerCurrentUser };
  }, [owner, currentUser]);

  const ownerSubtitle = owner ? (
    <div className="flex items-center space-x-1.5">
      <span>Owned by</span>
      <Avatar className="h-5 w-5">
        <AvatarImage src={ownerInfo.avatarUrl} alt={ownerInfo.name} />
        <AvatarFallback className="text-xs">{ownerInfo.initials}</AvatarFallback>
      </Avatar>
      <span className="font-medium">{ownerInfo.name}</span>
    </div>
  ) : null;

  const isLoading = traceLoading || commentsLoading;

  if (isLoading) {
    return (
      <AuthGuard>
        <Layout>
          <PageLayout>
            <PageHeader 
              title={<Skeleton className="h-8 w-48" />} 
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
    console.error("Failed to load trace details:", traceError);
    return (
      <AuthGuard>
        <Layout>
          <div className="text-center py-12 space-y-6">
            <p className="text-destructive">{traceError?.message || "Trace data could not be loaded."}</p>
            <Link to="/traces">
              <Button>Back to Traces</Button>
            </Link>
          </div>
        </Layout>
      </AuthGuard>
    );
  }

  if (!trace) { return <div>Trace data unavailable.</div>; }
  const traceIdForComments = trace.id;

  return (
    <AuthGuard>
      <Layout>
        <PageLayout>
          <PageHeader 
            title={trace.scenario || "Trace Details"} 
            subtitle={ownerSubtitle}
            actions={headerActions}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Scenario</div>
                <div className="text-lg font-medium truncate" title={trace?.scenario}>
                  {trace?.scenario || 'N/A'}
                </div>
                {trace?.device_model && (
                  <div className="text-sm text-muted-foreground mt-1 truncate" title={trace.device_model}>
                    {trace.device_model}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Uploaded</div>
                <div className="text-lg font-medium">
                  {formatDate(trace?.uploaded_at)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Commit</div>
                <div className="text-lg font-medium font-mono truncate" title={trace?.commit_sha}>
                  {trace?.commit_sha || 'N/A'}
                </div>
                {trace?.branch && (
                  <div className="text-sm text-muted-foreground mt-1 truncate" title={trace.branch}>
                    {trace.branch}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="text-lg font-medium text-primary">
                  {formatDuration(trace?.duration_ms)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Profile Format</div>
                <div className="text-lg font-medium">
                  {getProfileTypeName(trace?.profile_type)}
                </div>
              </CardContent>
            </Card>
          </div>

          {trace.notes && (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Notes</div>
                <div className="whitespace-pre-wrap">{trace.notes}</div>
              </CardContent>
            </Card>
          )}

          {traceIdForComments && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Comments</h2>
              <Separator className="mb-6" />

              {/* Grouped Comment Lists */}
              {/* Handle Loading State */}
              {commentsLoading && (
                <Skeleton className="h-20 w-full rounded-md" /> 
              )}

              {/* Handle Error State */}
              {!commentsLoading && commentsError && (
                 <div className="text-destructive p-4 border rounded-md">
                   Error loading comments: {commentsError.message}
                 </div>
              )}

              {/* Handle Success State (With Comments) */}
              {!commentsLoading && !commentsError && (
                <div className="space-y-6">
                  {/* --- Render Overview Section First --- */}
                  <div key="overview">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-md font-medium">{getCommentSectionTitle('overview')}</h3>
                      {/* No context link for overview */}
                    </div>
                    <div className="border rounded-md px-4">
                      {/* Render existing overview comments or empty state */}
                      {groupedComments['overview'] && groupedComments['overview'].length > 0 ? (
                        groupedComments['overview'].map(comment => (
                          <CommentItem
                            key={comment.id}
                            traceId={traceIdForComments}
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
                      <div className="py-4 border-t">
                        <CommentForm
                          traceId={traceIdForComments}
                          commentType="overview"
                          commentIdentifier={null}
                          placeholder="Add a general comment..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* --- Render Other Comment Sections --- */}
                  {commentTypes
                    .filter(type => type !== 'overview') // Exclude overview as it's handled above
                    .map(commentType => {
                      const commentsInSection = groupedComments[commentType];
                      const viewType = commentTypeToViewType(commentType);
                      const sectionTitle = getCommentSectionTitle(commentType);

                      // This check should now be redundant due to how commentTypes is derived, but safe to keep
                      if (!commentsInSection || commentsInSection.length === 0) {
                          return null;
                      }

                      return (
                        <div key={commentType}>
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-md font-medium">{sectionTitle}</h3>
                            {viewType && (
                              <Link
                                to={`/traces/${id}/view`}
                                state={{
                                  initialView: viewType,
                                  blobPath: trace.blob_path
                                }}
                                className={buttonVariants({ variant: "outline", size: "xs" }) + " flex items-center"}
                              >
                                View in Context <ExternalLink className="ml-1.5 h-3 w-3" />
                              </Link>
                            )}
                          </div>
                          <div className="border rounded-md px-4">
                            {commentsInSection.map(comment => (
                              <CommentItem
                                key={comment.id}
                                traceId={traceIdForComments}
                                comment={comment}
                                replyingToCommentId={replyingToCommentId}
                                onStartReply={handleStartReply}
                                onCancelReply={handleCancelReply}
                                onCommentUpdated={handleCommentUpdate}
                              />
                            ))}
                            {/* No form needed for non-overview types here */}
                          </div>
                        </div>
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
