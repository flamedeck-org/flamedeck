import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import type { SpeedscopeViewType } from '@/components/SpeedscopeViewer';
import SpeedscopeViewer from '@/components/SpeedscopeViewer';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getTraceBlob } from '@/lib/api/storage';
import type { TraceMetadata } from '@/lib/api';
import { traceApi } from '@/lib/api';
import type { ApiResponse } from '@/types';
import type { FallbackProps } from 'react-error-boundary';
import { ErrorBoundary } from 'react-error-boundary';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, MessageSquare, Palette, Share2 } from 'lucide-react';
import { TraceViewerCommentSidebar } from '@/components/TraceViewerCommentList/TraceViewerCommentSidebar';
import { useCommentManagement } from '@/hooks/useCommentManagement';
import type { ApiError } from '@/types';
import { ChatContainer } from '@/components/Chat';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAtom } from '../lib/speedscope-core/atom.ts';
import { flamegraphThemeAtom } from '../components/speedscope-ui/theme';
import {
  flamegraphThemeDisplayNames,
  flamegraphThemePreviews,
} from '@flamedeck/speedscope-theme/flamegraph-theme-registry';
import { type FlamegraphThemeName } from '@flamedeck/speedscope-theme/types.ts';
import { useSharingModal } from '@/hooks/useSharingModal';

// Define a fallback component to display on error
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center h-full w-full p-4 text-center border border-destructive bg-destructive/10 text-destructive"
    >
      <h2 className="text-xl font-semibold">Something went wrong rendering the trace viewer:</h2>
      <pre className="mt-2 whitespace-pre-wrap">{error.message}</pre>
      <Button variant="outline" className="mt-4" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}

// Define the type for the snapshot generator function
type SnapshotGenerator = (viewType: string, frameKey?: string) => Promise<string | null>;

// Define the type for the snapshot result state
interface SnapshotResultState {
  requestId: string;
  status: 'success' | 'error';
  data?: string; // imageDataUrl
  error?: string;
}

// --- Add state for test snapshot display ---
interface TestSnapshotState {
  dataUrl: string | null;
  error: string | null;
}
// -----------------------------------------

const TraceViewerPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { openModal } = useSharingModal();

  // Read initialView from location state, default to 'time_ordered'
  const initialViewFromState = location.state?.initialView as SpeedscopeViewType | undefined;
  const [selectedView, setSelectedView] = useState<SpeedscopeViewType>(
    initialViewFromState || 'time_ordered'
  );

  // --- Flamegraph Theme State ---
  const selectedFlamegraphTheme = useAtom(flamegraphThemeAtom);
  const selectedThemePreview = flamegraphThemePreviews[selectedFlamegraphTheme]; // Get selected preview
  // ------------------------------

  // Get blobPath from location state
  const blobPathFromState = location.state?.blobPath as string | undefined;

  // --- Call comment hook unconditionally ---
  // NOTE: useCommentManagement needs to be updated to handle isAuthenticated=false internally
  const commentManagement = useCommentManagement(id, isAuthenticated);
  // -----------------------------------------

  // --- Snapshot State and Refs ---
  const [snapshotResultForClient, setSnapshotResultForClient] =
    useState<SnapshotResultState | null>(null);
  const snapshotGeneratorRef = useRef<SnapshotGenerator | null>(null);
  // --- State for local testing display ---
  const [testSnapshot, setTestSnapshot] = useState<TestSnapshotState>({
    dataUrl: null,
    error: null,
  });
  // ------------------------------------

  // --- Conditionally fetch trace details ---
  const traceDetailsQueryKey = useMemo(
    () => (isAuthenticated ? ['traceDetails', id] : ['publicTraceDetails', id]),
    [isAuthenticated, id]
  );

  const fetchTraceDetailsFn = useMemo(() => {
    // Explicitly type the functions being returned
    return (): Promise<
      ApiResponse<TraceMetadata> | ApiResponse<{ id: string; blob_path: string }>
    > => (isAuthenticated ? traceApi.getTrace(id) : traceApi.getPublicTrace(id));
  }, [isAuthenticated, id]);

  // Define the expected type for the query data, which depends on authentication state
  type TraceDetailsQueryData =
    | ApiResponse<TraceMetadata>
    | ApiResponse<{ id: string; blob_path: string }>;

  const {
    data: traceDetailsApiResponse, // Renamed from traceData
    isLoading: isLoadingTraceDetails, // Renamed from isLoadingTrace
    error: traceDetailsError, // Renamed from traceError
  } = useQuery<TraceDetailsQueryData, ApiError>({
    queryKey: traceDetailsQueryKey,
    queryFn: fetchTraceDetailsFn,
    enabled: !!id && !blobPathFromState, // Only fetch if ID exists and blob path isn't in state
    staleTime: 5 * 60 * 1000, // Stale time of 5 minutes
    retry: (failureCount, error: ApiError) => {
      // Don't retry on 404-like errors (not found or not public)
      if (error?.error?.code === '404' || error?.error?.code === 'PGRST116') {
        return false;
      }
      // Standard retry logic for other errors
      return failureCount < 3;
    },
  });
  // -----------------------------------------

  // Extract data differently based on authentication state
  const traceData = traceDetailsApiResponse?.data;

  // Get the blob path (conditionally)
  const blobPath =
    blobPathFromState || (traceData as TraceMetadata | { blob_path: string })?.blob_path;

  // Fetch trace blob
  const {
    data: traceBlobData,
    isLoading: isLoadingBlob,
    error: blobError,
  } = useQuery<
    {
      data: ArrayBuffer;
      fileName: string;
    },
    Error
  >({
    queryKey: ['traceBlob', id, blobPath],
    queryFn: () => {
      if (!blobPath) throw new Error('Blob path is required');
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

  // --- Snapshot Handling Callbacks ---
  const handleRegisterSnapshotter = useCallback((generator: SnapshotGenerator) => {
    console.log('[TraceViewerPage] Snapshot generator registered.');
    snapshotGeneratorRef.current = generator;
  }, []);

  // Original handler for ChatContainer
  const handleTriggerSnapshotForChat = useCallback(
    async (requestId: string, viewType: string, frameKey?: string) => {
      if (!snapshotGeneratorRef.current) {
        console.error('[TraceViewerPage] Snapshot generator not registered!');
        setSnapshotResultForClient({
          requestId,
          status: 'error',
          error: 'Snapshot function not available.',
        });
        return;
      }
      try {
        console.log(
          `[TraceViewerPage] Triggering snapshot for ${viewType}, requestId ${requestId} (for Chat)`
        );
        const imageDataUrl = await snapshotGeneratorRef.current(viewType, frameKey);
        if (imageDataUrl) {
          setSnapshotResultForClient({ requestId, status: 'success', data: imageDataUrl });
        } else {
          throw new Error('Snapshot generation returned null.');
        }
      } catch (error: unknown) {
        console.error('[TraceViewerPage] Snapshot generation failed:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to generate snapshot.';
        setSnapshotResultForClient({ requestId, status: 'error', error: errorMessage });
      }
    },
    [] // No dependencies needed as it uses a ref
  );

  // --- Test function to trigger snapshot locally ---
  const handleTriggerSnapshotForTest = useCallback(async () => {
    setTestSnapshot({ dataUrl: null, error: 'Generating...' }); // Indicate loading
    if (!snapshotGeneratorRef.current) {
      console.error('[TraceViewerPage] Snapshot generator not registered!');
      setTestSnapshot({ dataUrl: null, error: 'Snapshot function not available.' });
      return;
    }
    try {
      console.log(`[TraceViewerPage] Triggering snapshot for ${selectedView} (for Test)`);
      const imageDataUrl = await snapshotGeneratorRef.current(selectedView); // Use current view
      if (imageDataUrl) {
        setTestSnapshot({ dataUrl: imageDataUrl, error: null });
      } else {
        throw new Error('Snapshot generation returned null.');
      }
    } catch (error: unknown) {
      console.error('[TraceViewerPage] Test snapshot generation failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to generate test snapshot.';
      setTestSnapshot({ dataUrl: null, error: errorMessage });
    }
  }, [selectedView]); // Recreate if selectedView changes
  // ---------------------------------------------

  const clearSnapshotResult = useCallback(() => {
    console.log('[TraceViewerPage] Clearing snapshot result for chat.');
    setSnapshotResultForClient(null);
  }, []);
  // -----------------------------------

  // --- Share Handler ---
  const handleShareClick = useCallback(() => {
    if (id) {
      openModal(id);
    } else {
      console.error('[TraceViewerPage] Trace ID is undefined, cannot open sharing modal.');
      // Optionally show a toast message here
    }
  }, [id, openModal]);
  // -------------------

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
          {id && (
            <Link to={`/traces/${id}`}>
              <Button variant="outline" className="mt-4">
                Back to Details
              </Button>
            </Link>
          )}
        </div>
      )}

      {!isLoading && !error && traceBlobData && id && (
        <div className="h-full w-full flex flex-col bg-background">
          <div className="flex justify-between items-center flex-shrink-0 border-b z-[1] bg-background px-4 gap-4">
            <Tabs
              value={selectedView}
              onValueChange={(value: string) => setSelectedView(value as SpeedscopeViewType)}
              className="inline-block"
            >
              <TabsList className="inline-flex rounded-none bg-transparent text-foreground p-0 border-none">
                <TabsTrigger
                  value="time_ordered"
                  className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground"
                >
                  Time Ordered
                </TabsTrigger>
                <TabsTrigger
                  value="left_heavy"
                  className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground"
                >
                  Left Heavy
                </TabsTrigger>
                <TabsTrigger
                  value="sandwich"
                  className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground"
                >
                  Sandwich
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              {/* --- Add Test Snapshot Button --- */}
              {/* <Button variant="outline" size="sm" onClick={handleTriggerSnapshotForTest} title="Generate snapshot for current view">
                Test Snapshot
              </Button> */}
              {/* ------------------------------ */}
              {/* --- Flamegraph Theme Selector --- */}
              <Select
                value={selectedFlamegraphTheme}
                onValueChange={(value: FlamegraphThemeName) => flamegraphThemeAtom.set(value)}
              >
                <SelectTrigger
                  className="w-[150px] h-8 py-0.5 text-sm"
                  title="Select Flamegraph Theme"
                >
                  <SelectValue placeholder="Select theme..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(flamegraphThemeDisplayNames) as FlamegraphThemeName[]).map(
                    (themeName) => {
                      const previewGradient = flamegraphThemePreviews[themeName];
                      return (
                        <SelectItem
                          key={themeName}
                          value={themeName}
                          className="data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground [&_svg]:hidden pl-3"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-4 h-4 rounded-sm border border-border"
                              style={
                                previewGradient
                                  ? { background: previewGradient }
                                  : { backgroundColor: 'transparent' }
                              }
                              aria-hidden="true"
                            />
                            <span>{flamegraphThemeDisplayNames[themeName]}</span>
                          </div>
                        </SelectItem>
                      );
                    }
                  )}
                </SelectContent>
              </Select>
              {/* --------------------------------- */}
              {isAuthenticated && commentManagement && (
                <TraceViewerCommentSidebar traceId={id} activeView={selectedView} />
              )}
              {/* --- Add Share Button --- */}
              {isAuthenticated && (
                <Button variant="ghost" size="sm" onClick={handleShareClick} title="Share Trace">
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
              {/* ------------------------- */}
              <Link
                to={isAuthenticated ? `/traces/${id}` : '/'}
                title={isAuthenticated ? 'Back to Details' : 'Back to Home'}
              >
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {isAuthenticated ? 'Back to Details' : 'Back Home'}
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex-grow overflow-hidden relative">
            <ErrorBoundary
              FallbackComponent={ErrorFallback}
              onReset={() => {
                console.log('Attempting to reset Speedscope viewer boundary...');
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
                onRegisterSnapshotter={handleRegisterSnapshotter}
              />
            </ErrorBoundary>
            {/* <ChatContainer 
                traceId={id}
                triggerSnapshot={handleTriggerSnapshotForChat}
                snapshotResult={snapshotResultForClient}
                clearSnapshotResult={clearSnapshotResult}
            /> */}
          </div>
          {/* --- Display Test Snapshot --- */}
          {/* {(testSnapshot.dataUrl || testSnapshot.error) && (
            <div className="absolute bottom-4 left-4 bg-card p-2 border rounded shadow-lg z-20 max-w-sm max-h-sm overflow-auto">
                <h4 className="text-sm font-semibold mb-1">Test Snapshot Result:</h4>
                {testSnapshot.error && <p className="text-xs text-destructive">{testSnapshot.error}</p>}
                {testSnapshot.dataUrl && (
                    <img 
                        src={testSnapshot.dataUrl} 
                        alt={`Snapshot of ${selectedView} view`} 
                        className="max-w-full h-auto mt-1"
                    />
                )}
                 <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setTestSnapshot({ dataUrl: null, error: null })}>
                    Close Test Snapshot
                </Button>
            </div>
          )} */}
          {/* -------------------------- */}
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
