import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import SpeedscopeViewer, { SpeedscopeViewType } from "@/components/SpeedscopeViewer";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getTraceBlob } from "@/lib/api/storage";
import { traceApi, TraceMetadata } from "@/lib/api";
import { ApiResponse } from '@/types';
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { TraceViewerCommentSidebar } from '@/components/TraceViewerCommentList/TraceViewerCommentSidebar';
import { useCommentManagement } from '@/hooks/useCommentManagement';
import { ApiError } from '@/types';

// Define a fallback component to display on error
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center h-full w-full p-4 text-center border border-destructive bg-destructive/10 text-destructive">
      <h2 className="text-xl font-semibold">Something went wrong rendering the trace viewer:</h2>
      <pre className="mt-2 whitespace-pre-wrap">{error.message}</pre>
      <Button variant="outline" className="mt-4" onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}

const TraceViewerPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  
  // Read initialView from location state, default to 'time_ordered'
  const initialViewFromState = location.state?.initialView as SpeedscopeViewType | undefined;
  const [selectedView, setSelectedView] = useState<SpeedscopeViewType>(initialViewFromState || 'time_ordered');

  // Get blobPath from location state
  const blobPathFromState = location.state?.blobPath as string | undefined;

  // --- Call comment hook unconditionally --- 
  // NOTE: useCommentManagement needs to be updated to handle isAuthenticated=false internally
  const commentManagement = useCommentManagement(id, isAuthenticated);
  // -----------------------------------------

  // --- Conditionally fetch trace details ---
  const traceDetailsQueryKey = useMemo(() =>
    isAuthenticated
      ? ['traceDetails', id]
      : ['publicTraceDetails', id]
  , [isAuthenticated, id]);

  const fetchTraceDetailsFn = useMemo(() => {
    // Explicitly type the functions being returned
    return (): Promise<ApiResponse<TraceMetadata> | ApiResponse<{ id: string; blob_path: string }>> =>
     isAuthenticated ? traceApi.getTrace(id) : traceApi.getPublicTrace(id);
  }, [isAuthenticated, id]);

  // Define the expected type for the query data, which depends on authentication state
  type TraceDetailsQueryData = ApiResponse<TraceMetadata> | ApiResponse<{ id: string; blob_path: string }>;

  const {
    data: traceDetailsApiResponse, // Renamed from traceData
    isLoading: isLoadingTraceDetails, // Renamed from isLoadingTrace
    error: traceDetailsError // Renamed from traceError
  } = useQuery<TraceDetailsQueryData, ApiError>({
    queryKey: traceDetailsQueryKey,
    queryFn: fetchTraceDetailsFn,
    enabled: !!id && !blobPathFromState, // Only fetch if ID exists and blob path isn't in state
    staleTime: 5 * 60 * 1000, // Stale time of 5 minutes
    retry: (failureCount, error: any) => {
       // Don't retry on 404-like errors (not found or not public)
       if (error?.error?.code === '404' || error?.error?.code === 'PGRST116') {
           return false;
       }
       // Standard retry logic for other errors
       return failureCount < 3;
    }
  });
  // -----------------------------------------

  // Extract data differently based on authentication state
  const traceData = traceDetailsApiResponse?.data;

  // Get the blob path (conditionally)
  const blobPath = blobPathFromState || (traceData as TraceMetadata | { blob_path: string })?.blob_path;

  // Fetch trace blob
  const {
    data: traceBlobData,
    isLoading: isLoadingBlob,
    error: blobError
  } = useQuery<{
    data: ArrayBuffer;
    fileName: string;
  }, Error>({
    queryKey: ['traceBlob', id, blobPath],
    queryFn: () => {
      if (!blobPath) throw new Error("Blob path is required");
      return getTraceBlob(blobPath);
    },
    enabled: !!blobPath, // Only enable if blobPath is available
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    const newInitialView = location.state?.initialView as SpeedscopeViewType | undefined;
    if (newInitialView && newInitialView !== selectedView) {
      setSelectedView(newInitialView);
    }
    // Only run when location state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [location.state]);

  // Whether we're loading data
  const isLoading = (isLoadingTraceDetails && !blobPathFromState) || (isLoadingBlob && !!blobPath);

  // Combine errors
  const error = traceDetailsError?.error || blobError;

  return (
    <Layout noPadding isProfileView>
      {isLoading && (
        <div className="flex items-center justify-center h-full w-full">
          <p>Loading trace data...</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center relative z-10">
          <h2 className="text-xl font-semibold text-destructive">
            {error?.code === '404' ? 'Trace Not Found or Not Public' : 'Error Loading Trace Data'}
          </h2>
          <p className="text-destructive mt-2">{error.message}</p>
          {id && <Link to={`/traces/${id}`}><Button variant="outline" className="mt-4">Back to Details</Button></Link>}
        </div>
      )}

      {!isLoading && !error && traceBlobData && id && (
        <div className="h-full w-full flex flex-col bg-background">
          <div className="flex justify-between items-center flex-shrink-0 border-b z-[1] bg-background px-4 gap-4">
            <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as SpeedscopeViewType)} className="inline-block">
              <TabsList className="inline-flex rounded-none bg-transparent text-foreground p-0 border-none">
                <TabsTrigger value="time_ordered" className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground">Time Ordered</TabsTrigger>
                <TabsTrigger value="left_heavy" className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground">Left Heavy</TabsTrigger>
                <TabsTrigger value="sandwich" className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground">Sandwich</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              {isAuthenticated && commentManagement && <TraceViewerCommentSidebar traceId={id} activeView={selectedView} />}
              <Link to={isAuthenticated ? `/traces/${id}` : '/'} title={isAuthenticated ? "Back to Details" : "Back to Home"}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {isAuthenticated ? "Back to Details" : "Back Home"}
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex-grow overflow-hidden relative">
            <ErrorBoundary
              FallbackComponent={ErrorFallback}
              onReset={() => {
                console.log("Attempting to reset Speedscope viewer boundary...");
              }}
              key={id}
            >
              <SpeedscopeViewer
                traceId={id}
                traceData={traceBlobData.data}
                fileName={traceBlobData.fileName}
                view={selectedView}
                replyingToCommentId={commentManagement?.replyingToCommentId}
                onStartReply={commentManagement?.handleStartReply}
                onCancelReply={commentManagement?.handleCancelReply}
                onCommentUpdated={commentManagement?.handleCommentUpdate}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {!isLoading && !error && (!traceBlobData || !id) && (
         <div className="flex items-center justify-center h-full w-full bg-background relative z-10">
            <p>Trace data could not be loaded (missing path, data, or ID).</p>
         </div>
      )}
    </Layout>
  );
};

export default TraceViewerPage; 