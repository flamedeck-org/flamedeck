import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import type { SpeedscopeViewType } from '@/components/SpeedscopeViewer';
import SpeedscopeViewer from '@/components/SpeedscopeViewer';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getTraceBlob } from '@/lib/api/storage';
import type { TraceMetadata } from '@/types';
import { traceApi } from '@/lib/api';
import type { ApiResponse } from '@/types';
import type { FallbackProps } from 'react-error-boundary';
import { ErrorBoundary } from 'react-error-boundary';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Share2 } from 'lucide-react';
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
import { UnauthenticatedChatTeaser } from '@/components/Chat/UnauthenticatedChatTeaser';
import { useTraceDetails } from '@/hooks/useTraceDetails';
import { TraceViewerHeaderActions } from '@/components/TraceViewer/TraceViewerHeaderActions';
import { TraceViewerErrorState } from '@/components/TraceViewer';

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

  // Parse query parameters
  const queryParams = new URLSearchParams(location.search);
  const viewFromQuery = queryParams.get('view') as SpeedscopeViewType | null;
  const chatFromQuery = queryParams.get('chat');

  // Read initialView from query params first, then location state, default to 'time_ordered'
  const initialViewFromState = location.state?.initialView as SpeedscopeViewType | undefined;
  const initialView = viewFromQuery || initialViewFromState || 'time_ordered';

  const [selectedView, setSelectedView] = useState<SpeedscopeViewType>(initialView);
  const [isCommentSidebarOpen, setIsCommentSidebarOpen] = useState(false);

  // Track if we've done the initial view setup
  const hasInitializedView = useRef(false);

  // --- Flamegraph Theme State ---
  const selectedFlamegraphTheme = useAtom(flamegraphThemeAtom);
  // ------------------------------

  // Get blobPath from location state
  const blobPathFromState = location.state?.blobPath as string | undefined;

  // --- Call comment hook unconditionally ---
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

  // --- Fetch trace details for authenticated users ---
  const {
    data: authenticatedTraceData,
    isLoading: isLoadingAuthenticatedTrace,
    error: authenticatedTraceError,
  } = useTraceDetails(isAuthenticated && !blobPathFromState ? id : null);

  // --- Fetch public trace details for unauthenticated users ---
  const {
    data: publicTraceApiResponse,
    isLoading: isLoadingPublicTrace,
    error: publicTraceError,
  } = useQuery<ApiResponse<{ id: string; blob_path: string }>, ApiError>({
    queryKey: ['publicTraceDetails', id],
    queryFn: () => traceApi.getPublicTrace(id),
    enabled: !isAuthenticated && !!id && !blobPathFromState,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: ApiError) => {
      // Don't retry on 404-like errors (not found or not public)
      if (error?.code === '404' || error?.code === 'PGRST116') {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Extract the actual data from public trace response
  const publicTraceData = publicTraceApiResponse?.data;

  // Combine loading states
  const isLoadingTraceDetails = isLoadingAuthenticatedTrace || isLoadingPublicTrace;

  // Combine errors
  const traceDetailsError = authenticatedTraceError || publicTraceError || publicTraceApiResponse?.error;

  // Get the trace data (authenticated has full metadata, public only has id/blob_path)
  const traceData = authenticatedTraceData || publicTraceData;

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
    // Only update view from query params/location state if:
    // 1. This is the initial load, OR
    // 2. The location has actually changed (new query params or state)
    const newViewFromQuery = new URLSearchParams(location.search).get('view') as SpeedscopeViewType | null;
    const newViewFromState = location.state?.initialView as SpeedscopeViewType | undefined;
    const newView = newViewFromQuery || newViewFromState;

    // On initial load, set the view from query params/location state
    if (!hasInitializedView.current) {
      if (newView && newView !== selectedView) {
        setSelectedView(newView);
      }
      hasInitializedView.current = true;
    }
    // After initial load, only update if there's a new view from navigation
    // (Don't override user's manual tab selection)

    // Run when location changes (both search and state), but not on selectedView changes
  }, [location.search, location.state]);

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

  const handleShowComments = useCallback(() => {
    setIsCommentSidebarOpen(true);
  }, []);

  const handleFlamegraphThemeChange = useCallback((theme: FlamegraphThemeName) => {
    flamegraphThemeAtom.set(theme);
  }, []);

  // Whether we're loading data
  const isLoading = (isLoadingTraceDetails && !blobPathFromState) || (isLoadingBlob && !!blobPath);

  // Combine errors - handle different error types
  const error = traceDetailsError || (blobError ? { message: blobError.message, code: undefined } : null);

  return (
    <Layout noPadding isProfileView>
      {isLoading && (
        <div className="flex items-center justify-center h-full w-full">
          <p>Loading trace data...</p>
        </div>
      )}

      {!isLoading && error && (
        <TraceViewerErrorState
          title={error?.code === '404' ? 'Trace Not Found or Not Public' : 'Error Loading Trace Data'}
          message={error.message}
          actions={[
            {
              message: 'Back to Home',
              href: '/',
              variant: 'outline',
            } as const,
            ...(id ? [{
              message: 'Back to Details',
              href: `/traces/${id}`,
              variant: 'gradient',
            } as const] : []),
          ]}
        />
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
            <TraceViewerHeaderActions
              traceId={id}
              isAuthenticated={isAuthenticated}
              onShowComments={handleShowComments}
              onShare={handleShareClick}
              selectedFlamegraphTheme={selectedFlamegraphTheme}
              onFlamegraphThemeChange={handleFlamegraphThemeChange}
            />
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

      {/* Chat Feature - Render based on authentication status */}
      {!isLoading && !error && traceBlobData && (
        isAuthenticated ? (
          <ChatContainer traceId={id} initialOpen={chatFromQuery === 'open'} />
        ) : (
          <UnauthenticatedChatTeaser traceId={id} />
        )
      )}

      {/* Conditionally render TraceViewerCommentSidebar based on isCommentSidebarOpen */}
      {isAuthenticated && commentManagement && (
        <TraceViewerCommentSidebar
          traceId={id}
          activeView={selectedView}
          isOpen={isCommentSidebarOpen}
          onOpenChange={setIsCommentSidebarOpen}
        />
      )}
    </Layout>
  );
};

export default TraceViewerPage;
