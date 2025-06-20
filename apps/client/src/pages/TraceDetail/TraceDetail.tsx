import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { traceApi } from '@/lib/api';
import {
  Eye,
  ExternalLink,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Globe,
  Lock,
  Loader2,
} from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import PageHeader from '@/components/PageHeader';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import CommentForm from '@/components/CommentForm';
import type { StructuredComment } from '@/components/comments';
import { CommentItem } from '@/components/comments';
import { buttonVariants } from '@/components/ui/button';
import { useSharingModal } from '@/hooks/useSharingModal';
import { useTraceDetails } from '@/hooks/useTraceDetails';
import { useTraceComments } from '@/hooks/useTraceComments';
import { useAuth } from '@/contexts/AuthContext';
import { formatDuration } from '@/lib/utils';
import type { TracePermissionWithUser, TraceRole } from '@/lib/api';
import { useCommentManagement } from '@/hooks/useCommentManagement';
import { UserAvatar } from '@/components/UserAvatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TraceTitle, FlamegraphPreview, TraceDetailHeaderActions } from '@/components/TraceDetail';
import {
  commentTypeToViewType,
  getCommentSectionTitle,
  structureComments,
} from './utils/commentUtils';
import { getProfileTypeName } from './utils/profileUtils';
import { formatUploadDate } from './utils/dateUtils';

export const TraceDetail: React.FC = () => {
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

  // Fetch trace permissions to determine public access state
  const {
    data: permissionsData,
    isLoading: isLoadingPermissions,
    error: permissionsError,
  } = useQuery<TracePermissionWithUser[] | null, string>({
    queryKey: ['tracePermissions', id],
    queryFn: async () => {
      if (!id) return null;
      const permResponse = await traceApi.getTracePermissions(id);
      if (permResponse.error) {
        throw permResponse.error;
      }
      return permResponse.data;
    },
    enabled: !!id && isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const permissions: TracePermissionWithUser[] = useMemo(
    () => permissionsData ?? [],
    [permissionsData]
  );

  // Calculate current public access state
  const publicPermission = useMemo(() => permissions.find((p) => p.user === null), [permissions]);
  const isPublic = publicPermission?.role === 'viewer';

  // Calculate user permissions for access control
  const currentUserPermission = useMemo(
    () => permissions.find((p) => p.user?.id === currentUser?.id),
    [permissions, currentUser]
  );
  const canManagePermissions =
    currentUserPermission?.role === 'editor' || currentUserPermission?.role === 'owner';

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

  // Mutation for toggling public access
  const togglePublicAccessMutation = useMutation({
    mutationFn: (makePublic: boolean) => {
      if (!id) throw new Error('Trace ID is missing');
      const targetRole: TraceRole | null = makePublic ? 'viewer' : null;
      return traceApi.setPublicTraceAccess(id, targetRole);
    },
    onSuccess: (data, makePublic) => {
      if (makePublic) {
        // Show toast with copy link action when making public
        toast({
          title: 'Trace is now public',
          description: 'Anyone with the link can now view this trace.',
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/traces/${id}/view`;
                navigator.clipboard
                  .writeText(url)
                  .then(() => {
                    toast({ title: 'Link copied to clipboard' });
                  })
                  .catch(() => {
                    toast({ title: 'Failed to copy link', variant: 'destructive' });
                  });
              }}
            >
              Copy Link
            </Button>
          ),
        });
      } else {
        toast({
          title: 'Trace is now private',
          description: 'Only people with access can view this trace.',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tracePermissions', id] });
    },
    onError: (error) => {
      toast({
        title: 'Error updating access',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

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
    <TraceDetailHeaderActions
      traceId={id}
      trace={trace}
      onShareClick={handleShareClick}
      deleteMutation={deleteMutation}
    />
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
              title={<Skeleton className="h-8 w-96 rounded" />}
              subtitle={
                <div className="flex items-center space-x-1.5">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              }
              actions={
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-32 rounded-lg" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-10 w-32 rounded-lg" />
                  </div>
                </div>
              }
            />

            {/* Main Content Layout - Flamegraph on left, Details on right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Flamegraph Preview Skeleton */}
              <div className="space-y-8">
                <div className="relative rounded-xl bg-card/50 h-96 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Skeleton className="h-12 w-12 mx-auto rounded-lg" />
                    <Skeleton className="h-5 w-40 rounded mx-auto" />
                    <Skeleton className="h-3 w-56 rounded mx-auto" />
                  </div>
                </div>
              </div>

              {/* Right Column - Trace Details Skeleton */}
              <div className="space-y-4">
                {/* Trace Overview Card Skeleton */}
                <div className="relative">
                  <Card className="relative bg-card/95 backdrop-blur-lg border border-border/80 rounded-xl">
                    <CardContent className="pt-6 pb-6 px-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <Skeleton className="h-6 w-32 rounded" />
                          <Skeleton className="h-1 w-12 rounded-full mt-2" />
                        </div>
                        <Skeleton className="h-8 w-20 rounded-lg" />
                      </div>

                      {/* Key Metrics Row Skeleton */}
                      <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-16 rounded" />
                          <Skeleton className="h-8 w-20 rounded" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-20 rounded" />
                          <Skeleton className="h-6 w-24 rounded" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-16 rounded" />
                          <Skeleton className="h-6 w-16 rounded" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions Skeleton */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24 rounded" />
                          <Skeleton className="h-3 w-36 rounded" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-3 rounded" />
                    </div>
                    <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28 rounded" />
                          <Skeleton className="h-3 w-32 rounded" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-3 rounded" />
                    </div>
                    <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24 rounded" />
                          <Skeleton className="h-3 w-40 rounded" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-10 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabbed Interface Skeleton */}
            <div className="mt-8">
              <div className="inline-flex rounded-none bg-transparent text-foreground p-0 border-none w-full justify-start border-b border-border">
                <div className="px-6 py-3 border-b-2 border-primary">
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
                <div className="px-6 py-3">
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
              </div>
              <div className="mt-6 space-y-6">
                <Card className="bg-card/90 backdrop-blur-sm border border-border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-6 w-40 rounded" />
                      </div>
                      <div className="text-center py-8 space-y-4">
                        <Skeleton className="h-16 w-16 mx-auto rounded-xl" />
                        <Skeleton className="h-5 w-32 mx-auto rounded" />
                        <Skeleton className="h-4 w-56 mx-auto rounded" />
                      </div>
                      <div className="pt-4 border-t border-border">
                        <Skeleton className="h-20 w-full rounded-lg" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
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

          {/* Main Content Layout - Flamegraph on left, Details on right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Flamegraph Preview */}
            <div className="space-y-8">
              <FlamegraphPreview
                trace={trace}
                lightImagePath={trace.light_image_path}
                darkImagePath={trace.dark_image_path}
              />
            </div>

            {/* Right Column - Trace Details and Notes */}
            <div className="space-y-6">
              {/* Header Section */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-yellow-500/5 rounded-xl" />
                <Card className="relative bg-card/95 backdrop-blur-lg border border-border/80 shadow-lg hover:shadow-xl hover:border-border transition-all duration-500 rounded-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-background/50 to-background/30" />
                  <CardContent className="relative pt-6 pb-6 px-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-foreground">
                          Trace Overview
                        </h3>
                        <div className="w-12 h-0.5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-full mt-2" />
                      </div>
                      <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500/10 to-yellow-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                          Active
                        </span>
                      </div>
                    </div>

                    {/* Key Metrics Row */}
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Duration
                        </div>
                        <div className="text-2xl font-black bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent leading-none">
                          {formatDuration(trace?.duration_ms)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Profile Type
                        </div>
                        <div className="text-lg font-bold text-foreground leading-tight">
                          {getProfileTypeName(trace?.profile_type)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Uploaded
                        </div>
                        <div className="text-lg font-bold text-foreground leading-tight">
                          {formatUploadDate(trace?.uploaded_at)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  <Link
                    to={`/traces/${id}/view?blob=${encodeURIComponent(trace?.blob_path || '')}`}
                    state={{ blobPath: trace?.blob_path }}
                    className="group flex items-center justify-between p-4 bg-gradient-to-r from-red-500/5 to-yellow-500/5 hover:from-red-500/10 hover:to-yellow-500/10 border border-border/80 hover:border-red-500/30 rounded-xl transition-all duration-300 hover:shadow-md"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-yellow-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                        <Eye className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground group-hover:text-red-600 transition-colors duration-300">
                          Explore Trace
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Interactive flamegraph analysis
                        </div>
                      </div>
                    </div>
                    <div className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                  </Link>

                  <Link
                    to={`/traces/${id}/view?chat=open&blob=${encodeURIComponent(trace?.blob_path || '')}`}
                    state={{ blobPath: trace?.blob_path }}
                    className="group flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/5 to-blue-500/5 hover:from-purple-500/10 hover:to-blue-500/10 border border-border/80 hover:border-purple-500/30 rounded-xl transition-all duration-300 hover:shadow-md"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground group-hover:text-purple-600 transition-colors duration-300">
                          Analyze with AI
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Get AI insights and analysis
                        </div>
                      </div>
                    </div>
                    <div className="text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                  </Link>

                  {/* Public Access Toggle - Only show if user can manage permissions */}
                  {canManagePermissions && (
                    <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-green-500/5 to-emerald-500/5 hover:from-green-500/10 hover:to-emerald-500/10 border border-border/80 hover:border-green-500/30 rounded-xl transition-all duration-300 hover:shadow-md">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                          {isLoadingPermissions ? (
                            <Loader2 className="h-4 w-4 text-white animate-spin" />
                          ) : isPublic ? (
                            <Globe className="h-4 w-4 text-white" />
                          ) : (
                            <Lock className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-foreground group-hover:text-green-600 transition-colors duration-300">
                            Public Access
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isPublic
                              ? 'Anyone with the link can view'
                              : 'Only people with access can view'}
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <Switch
                          checked={isPublic}
                          onCheckedChange={(checked) => togglePublicAccessMutation.mutate(checked)}
                          disabled={togglePublicAccessMutation.isPending || isLoadingPermissions}
                          className="data-[state=checked]:bg-green-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabbed Interface - Comments and Metadata */}
          {trace.id && (
            <div className="mt-8">
              <Tabs defaultValue="comments" className="w-full">
                <TabsList className="inline-flex rounded-none bg-transparent text-foreground p-0 border-none w-full justify-start">
                  <TabsTrigger
                    value="comments"
                    className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground"
                  >
                    Comments
                  </TabsTrigger>
                  <TabsTrigger
                    value="metadata"
                    className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground"
                  >
                    Metadata
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="mt-6">
                  <div className="space-y-6">
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
                                <h3 className="text-lg font-semibold">
                                  {getCommentSectionTitle('overview')}
                                </h3>
                                {/* No context link for overview */}
                              </div>
                              {/* Render existing overview comments or empty state */}
                              {groupedComments['overview'] &&
                              groupedComments['overview'].length > 0 ? (
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
                                <div className="text-center py-8">
                                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/40 flex items-center justify-center">
                                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                  <h3 className="text-lg font-bold mb-2">No comments yet</h3>
                                  <p className="text-muted-foreground mb-6">
                                    Be the first to share your insights about this trace.
                                  </p>
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
                              <Card
                                key={commentType}
                                className="bg-card/90 backdrop-blur-sm border border-border shadow-sm"
                              >
                                <CardContent className="pt-6">
                                  <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold">{sectionTitle}</h3>
                                    {viewType && (
                                      <Link
                                        to={`/traces/${trace.id}/view?view=${viewType}&blob=${encodeURIComponent(trace.blob_path || '')}`}
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
                </TabsContent>

                <TabsContent value="metadata" className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Trace Metadata */}
                    <Card className="bg-card/90 backdrop-blur-sm border border-border/80 shadow-sm hover:shadow-md hover:border-border transition-all duration-300 rounded-xl">
                      <CardContent className="pt-6 pb-6 px-6">
                        <h3 className="text-lg font-bold text-foreground mb-4">Trace Metadata</h3>
                        <div className="space-y-4">
                          {/* Scenario */}
                          <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
                            <div className="flex items-center space-x-3">
                              <div className="w-6 h-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-lg border border-red-500/30 flex items-center justify-center">
                                <div className="w-2 h-2 bg-red-500 rounded-sm" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Scenario
                                </div>
                                <div
                                  className="text-sm font-semibold text-foreground truncate"
                                  title={trace?.scenario}
                                >
                                  {trace?.scenario || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Git Information */}
                          {(trace?.commit_sha || trace?.branch) && (
                            <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
                              <div className="flex items-center space-x-3">
                                <div className="w-6 h-6 bg-gradient-to-br from-green-500/20 to-green-400/20 rounded-lg border border-green-500/30 flex items-center justify-center">
                                  <div className="w-2 h-2 bg-green-500 rounded-sm transform rotate-45" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Git Information
                                  </div>
                                  <div className="flex items-center justify-between">
                                    {trace?.commit_sha && (
                                      <div
                                        className="text-sm font-mono font-semibold text-foreground truncate"
                                        title={trace.commit_sha}
                                      >
                                        {trace.commit_sha}
                                      </div>
                                    )}
                                    {trace?.branch && (
                                      <div className="flex items-center space-x-2 ml-4">
                                        <div
                                          className="text-xs text-muted-foreground truncate"
                                          title={trace.branch}
                                        >
                                          {trace.branch}
                                        </div>
                                        <div className="px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded-md text-xs font-medium text-green-600">
                                          branch
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Upload Date */}
                          <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
                            <div className="flex items-center space-x-3">
                              <div className="w-6 h-6 bg-gradient-to-br from-blue-500/20 to-blue-400/20 rounded-lg border border-blue-500/30 flex items-center justify-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-sm" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Upload Date
                                </div>
                                <div className="text-sm font-semibold text-foreground">
                                  {formatDate(trace?.uploaded_at)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Right Column - Notes */}
                    {trace.notes && (
                      <Card className="bg-card/95 backdrop-blur-lg border border-border/80 shadow-sm rounded-xl">
                        <CardContent className="pt-6 pb-6 px-6">
                          <h3 className="text-lg font-bold text-foreground mb-4">Notes</h3>
                          <div className="relative">
                            <div className="absolute -left-2 top-0 w-1 h-full bg-gradient-to-b from-red-500 to-yellow-500 rounded-full" />
                            <div className="whitespace-pre-wrap text-foreground leading-relaxed text-sm pl-4">
                              {trace.notes}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Placeholder for when no notes exist */}
                    {!trace.notes && (
                      <Card className="bg-card/95 backdrop-blur-lg border border-border/80 shadow-sm rounded-xl">
                        <CardContent className="pt-6 pb-6 px-6">
                          <h3 className="text-lg font-bold text-foreground mb-4">Notes</h3>
                          <div className="text-center py-8">
                            <div className="text-muted-foreground">
                              No notes available for this trace.
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </PageLayout>
      </Layout>
    </AuthGuard>
  );
};
