import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { traceApi } from "@/lib/api";
import { ArrowLeft, Trash2, Eye, Share2 } from "lucide-react";
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
import CommentList from "@/components/CommentList";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { ProfileType } from "@/lib/speedscope-import"; // Import ProfileType
import { useSharingModal } from '@/hooks/useSharingModal'; // Added hook import
import { useTraceDetails } from '@/hooks/useTraceDetails'; // Import the hook
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Added Avatar imports
import { useAuth } from "@/contexts/AuthContext"; // Added Auth context import

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

const TraceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openModal } = useSharingModal();
  const { user: currentUser } = useAuth(); // Get current user

  // Use the custom hook to fetch trace details
  const {
    data: trace,
    isLoading,
    error, // Error is now potentially of type ApiError
  } = useTraceDetails(id);

  // Handle navigation for not found/permission error
  useEffect(() => {
    if (error?.code === 'PGRST116') {
      console.log("Trace not found or permission denied (PGRST116), navigating to /404");
      navigate('/404', { replace: true }); // Use replace to avoid back button to error state
    }
  }, [error, navigate]);

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

  const formatDuration = (ms: number | undefined) => {
    if (ms === undefined) return "Unknown";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const handleShareClick = () => { // Added handler
    if (id) {
      openModal(id);
    } else {
      console.error("Trace ID is undefined, cannot open sharing modal.");
      // TODO: Optionally show an error to the user
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
  const owner = trace?.owner; // Assuming owner data is available on trace object

  // Determine owner name and initials
  const isOwnerCurrentUser = currentUser && owner?.id === currentUser.id;
  const ownerName = isOwnerCurrentUser 
    ? "me" 
    : owner?.username || `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || "Unknown Owner";
  const ownerInitials = ownerName === 'me' 
    ? currentUser?.email?.[0].toUpperCase() ?? '?' 
    : ownerName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  // Construct subtitle node
  const ownerSubtitle = owner ? (
    <div className="flex items-center space-x-1.5">
      <span>Owned by</span>
      <Avatar className="h-5 w-5"> {/* Smaller avatar for subtitle */}
        <AvatarImage src={isOwnerCurrentUser ? currentUser?.user_metadata?.avatar_url : owner?.avatar_url ?? undefined} alt={ownerName} />
        <AvatarFallback className="text-xs">{ownerInitials}</AvatarFallback> {/* Smaller text */} 
      </Avatar>
      <span className="font-medium">{ownerName}</span>
    </div>
  ) : null;

  // Render loading state first
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
             {/* Don't render comment skeleton if trace might not exist */}
            {/* <Skeleton className="h-[60vh]" /> */}
          </PageLayout>
        </Layout>
      </AuthGuard>
    );
  }

  // Specific check for PGRST116 is handled by useEffect navigation
  // This block now handles other errors OR the case where data is null after loading
  if (error || !trace) {
    // If navigation didn't happen, it means it's some other error
    console.error("Failed to load trace details:", error);
    return (
      <AuthGuard>
        <Layout>
          <div className="text-center py-12 space-y-6">
            <p className="text-destructive">{error?.message || "Trace data could not be loaded."}</p>
            <Link to="/traces">
              <Button>Back to Traces</Button>
            </Link>
          </div>
        </Layout>
      </AuthGuard>
    );
  }

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

          {traceId && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Comments</h2>
              <Separator className="mb-4" />
              
              <div className="mb-6">
                <CommentForm traceId={traceId} />
              </div>

              <CommentList traceId={traceId} />
            </div>
          )}

        </PageLayout>
      </Layout>
    </AuthGuard>
  );
};

export default TraceDetail;
