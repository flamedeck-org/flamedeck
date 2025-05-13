import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  importProfilesFromArrayBuffer,
  importProfileGroupFromText,
  type ImporterDependencies, // Import type via alias
} from '@flamedeck/speedscope-import';
import * as pako from 'pako'; // Import pako for client-side use
import { JSON_parse } from 'uint8array-json-parser'; // Import parser for client-side use
import Long from 'long'; // Import Long for client-side
import {
  profileGroupAtom,
  glCanvasAtom,
  flattenRecursionAtom,
} from '@/lib/speedscope-core/app-state';
import { useActiveProfileState } from '@/lib/speedscope-core/app-state/active-profile-state';
import { useAtom } from '@/lib/speedscope-core/atom';
import type { SandwichViewHandle } from '@/components/speedscope-ui/sandwich-view';
import { SandwichViewContainer } from './speedscope-ui/sandwich-view';
import { ProfileSearchContextProvider } from './speedscope-ui/search-view';
import type { FlamechartViewHandle } from './speedscope-ui/flamechart-view-container';
import {
  ChronoFlamechartView,
  LeftHeavyFlamechartView,
} from './speedscope-ui/flamechart-view-container';
import { useTraceComments } from '@/hooks/useTraceComments';
import CommentSidebar from './CommentSidebar';
import type { TraceCommentWithAuthor } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ChatContainer } from '@/components/Chat';
import { CallTreeNode } from '@flamedeck/speedscope-core/profile';

export type SpeedscopeViewType = 'sandwich' | 'time_ordered' | 'left_heavy';

// Type for storing selection state per view
interface SelectedCommentState {
  cellId: string | null;
  nodeName: string | null;
}

// Helper map from Speedscope view type to comment_type used in DB/API
const viewToCommentTypeMap: Record<SpeedscopeViewType, string> = {
  time_ordered: 'chrono',
  left_heavy: 'left_heavy',
  sandwich: 'sandwich',
};

// Define the type for the generator function expected by the prop
type SnapshotGenerator = (viewType: string, frameKey?: string) => Promise<string | null>;

// Add the new props required by CommentSidebar
interface SpeedscopeViewerProps {
  traceId: string;
  traceData: ArrayBuffer | string;
  fileName?: string;
  view: SpeedscopeViewType;
  replyingToCommentId: string | null;
  onStartReply: (commentId: string) => void;
  onCancelReply: () => void;
  onCommentUpdated: (updatedComment: TraceCommentWithAuthor) => void;
  onRegisterSnapshotter?: (generator: SnapshotGenerator) => void; // Optional prop
}

const SpeedscopeViewer: React.FC<SpeedscopeViewerProps> = ({
  traceId,
  traceData,
  fileName,
  view,
  // Destructure new props
  replyingToCommentId,
  onStartReply,
  onCancelReply,
  onCommentUpdated,
  onRegisterSnapshotter,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State to hold selection info per view
  const [selectedCommentInfoByView, setSelectedCommentInfoByView] = useState<
    Record<SpeedscopeViewType, SelectedCommentState>
  >({
    time_ordered: { cellId: null, nodeName: null },
    left_heavy: { cellId: null, nodeName: null },
    sandwich: { cellId: null, nodeName: null }, // Initialize for all views
  });

  const profileGroup = useAtom(profileGroupAtom);
  const glCanvas = useAtom(glCanvasAtom);
  const flattenRecursion = useAtom(flattenRecursionAtom);
  const activeProfileState = useActiveProfileState();

  // --- Refs for view components ---
  const chronoViewRef = useRef<FlamechartViewHandle>(null);
  const leftHeavyViewRef = useRef<FlamechartViewHandle>(null);
  const sandwichViewRef = useRef<SandwichViewHandle>(null);
  // TODO: Add ref for SandwichViewContainer if snapshot support is needed there
  // ------------------------------

  // Fetch all comments once
  const {
    allComments,
    commentedChronoCellIds,
    commentedLeftHeavyCellIds,
    isLoading: commentsLoading,
    error: commentsError,
  } = useTraceComments(traceId);

  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Create the dependencies object (useMemo to avoid recreating on every render)
  const importerDeps = useMemo(
    (): ImporterDependencies => ({
      inflate: pako.inflate,
      parseJsonUint8Array: JSON_parse,
      LongType: Long,
    }),
    []
  );

  // Updated handler to accept the view type
  const handleNodeSelect = useCallback(
    (activeView: SpeedscopeViewType, node: CallTreeNode | null, cellId?: string | null) => {
      const nodeName = node?.frame.name ?? null;
      setSelectedCommentInfoByView((prev) => {
        return {
          ...prev,
          [activeView]: { cellId: cellId ?? null, nodeName: nodeName },
        };
      });
    },
    []
  );

  // Simplified close handler - only closes for the currently active view
  const handleCloseSidebar = useCallback(() => {
    setSelectedCommentInfoByView((prev) => ({
      ...prev,
      [view]: { cellId: null, nodeName: null }, // Reset only the current view's state
    }));
  }, [view]); // Re-create if the active view changes

  useEffect(() => {
    let isCancelled = false;
    if (traceData && fileName) {
      setError(null);
      setIsLoading(true);
      profileGroupAtom.set(null);

      // Pass the importerDeps object
      const importerPromise =
        traceData instanceof ArrayBuffer
          ? importProfilesFromArrayBuffer(fileName, traceData, importerDeps)
          : importProfileGroupFromText(fileName, traceData, importerDeps);

      importerPromise
        .then(({ profileGroup }) => {
          if (isCancelled) return;
          if (profileGroup && profileGroup.profiles.length > 0) {
            profileGroupAtom.setProfileGroup(profileGroup);
            setError(null);
          } else if (profileGroup) {
            setError(
              'Could not parse the profile file. The format might be unsupported or the file corrupted.'
            );
            profileGroupAtom.set(null);
          } else {
            setError('Import process failed unexpectedly.');
            profileGroupAtom.set(null);
          }
        })
        .catch((err) => {
          if (isCancelled) return;
          console.error(err);
          setError(
            `An error occurred during import: ${err instanceof Error ? err.message : String(err)}`
          );
          profileGroupAtom.set(null);
        })
        .finally(() => {
          if (isCancelled) return;
          setIsLoading(false);
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [traceData, fileName, importerDeps]); // Add importerDeps to useEffect dependencies

  // Make sure the handleKeyDown effect doesn't interfere with chat input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement;
      if (targetElement.closest('.chat-input-area')) {
        return;
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === 'r') {
        flattenRecursionAtom.set(!flattenRecursion);
      }
      if (event.key === 'Escape') {
        if (selectedCommentInfoByView[view].cellId !== null) {
          handleCloseSidebar();
        } else {
          activeProfileState?.setSelectedNode(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCommentInfoByView, view, activeProfileState, flattenRecursion, handleCloseSidebar]);

  // --- Snapshot Logic ---
  const generateSnapshotCallback = useCallback(
    async (requestedViewType: string, frameKey?: string): Promise<string | null> => {
      console.log(`[SpeedscopeViewer] generateSnapshot called for view: ${requestedViewType}`);
      if (!glCanvas) {
        console.error('Cannot generate snapshot: glCanvas not available.');
        return null;
      }

      // Determine which view ref to use
      let activeViewRef: React.RefObject<FlamechartViewHandle | SandwichViewHandle> | null = null;
      let isSandwichView = false;

      if (requestedViewType === 'time_ordered') {
        activeViewRef = chronoViewRef;
      } else if (requestedViewType === 'left_heavy') {
        activeViewRef = leftHeavyViewRef;
      } else if (requestedViewType.startsWith('sandwich_')) {
        activeViewRef = sandwichViewRef;
        isSandwichView = true;
      }

      if (!activeViewRef || !activeViewRef.current) {
        console.error(
          `Cannot generate snapshot: Ref for view ${requestedViewType} is not available.`
        );
        return null;
      }

      try {
        // Find the overlay canvas element with the specific class
        const overlayCanvas = document.querySelector('.flamechart-overlay') as HTMLCanvasElement;
        if (!overlayCanvas) {
          console.error(
            "Cannot generate snapshot: Overlay canvas not found with class 'flamechart-overlay'"
          );
          return null;
        }

        // Get the dimensions of both canvases
        const overlayRect = overlayCanvas.getBoundingClientRect();
        const glRect = glCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // Create a temporary canvas with the overlay canvas dimensions
        const tempCanvas = document.createElement('canvas');
        const canvasWidth = Math.floor(overlayRect.width);
        const canvasHeight = Math.floor(overlayRect.height);

        // Set physical size (actual pixels)
        tempCanvas.width = Math.floor(canvasWidth * dpr);
        tempCanvas.height = Math.floor(canvasHeight * dpr);

        // Set display size (CSS pixels)
        tempCanvas.style.width = `${canvasWidth}px`;
        tempCanvas.style.height = `${canvasHeight}px`;

        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
          console.error('Cannot generate snapshot: Failed to get 2D context for temporary canvas.');
          return null;
        }

        // Fill with a dark background color
        tempCtx.fillStyle = '#121212'; // Dark background
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Calculate source coordinates for proper alignment
        // We want to align both the right and bottom edges of the canvases

        // Calculate vertical alignment (bottom align)
        const sourceY = Math.max(0, glRect.height - overlayRect.height) * dpr;
        const sourceHeight = Math.min(glRect.height, overlayRect.height) * dpr;

        // Calculate horizontal alignment (right align)
        const sourceX = Math.max(0, glRect.width - overlayRect.width) * dpr;
        const sourceWidth = Math.min(glRect.width, overlayRect.width) * dpr;

        console.log(
          `[SpeedscopeViewer] Canvas sizes - GL: ${glRect.width}x${glRect.height}, Overlay: ${overlayRect.width}x${overlayRect.height}`
        );
        console.log(
          `[SpeedscopeViewer] Source region - X: ${sourceX}, Y: ${sourceY}, Width: ${sourceWidth}, Height: ${sourceHeight}`
        );

        // Draw the bottom-right portion of the GL canvas onto the temp canvas
        tempCtx.drawImage(
          glCanvas,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight, // Source: Only take the bottom-right portion of glCanvas
          0,
          0,
          tempCanvas.width,
          tempCanvas.height // Destination: Cover the entire tempCanvas
        );

        // Draw the overlay onto the combined canvas
        if (isSandwichView) {
          (activeViewRef.current as SandwichViewHandle).drawOverlayOnto(tempCtx, requestedViewType);
        } else {
          (activeViewRef.current as FlamechartViewHandle).drawOverlayOnto(tempCtx);
        }

        // Generate data URL from the combined canvas
        const dataUrl = tempCanvas.toDataURL('image/png');
        return dataUrl;
      } catch (e) {
        console.error('[SpeedscopeViewer] Error generating combined snapshot:', e);
        return null;
      }
    },
    [glCanvas, chronoViewRef, leftHeavyViewRef, sandwichViewRef]
  );

  // Register the snapshot generator with the parent
  useEffect(() => {
    if (onRegisterSnapshotter) {
      console.log('[SpeedscopeViewer] Registering snapshot generator.');
      onRegisterSnapshotter(generateSnapshotCallback);
    }
  }, [onRegisterSnapshotter, generateSnapshotCallback]);
  // --- End Snapshot Logic ---

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4 border border-gray-300">
        <p>Parsing profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4 border border-red-500 bg-red-100 text-red-700">
        <p>Error loading profile: {error}</p>
      </div>
    );
  }

  if (!profileGroup || !activeProfileState) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4 border border-gray-300">
        <p>Profile loaded, but still initializing view state...</p>
      </div>
    );
  }

  // Determine current selection based on the active view
  const currentSelection = selectedCommentInfoByView[view];
  const commentTypeForView = viewToCommentTypeMap[view];

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex-1 flex flex-row relative overflow-hidden">
        <div className="flex-1 h-full relative overflow-hidden">
          <ProfileSearchContextProvider>
            {view === 'sandwich' && (
              <SandwichViewContainer
                ref={sandwichViewRef}
                onFrameSelectForComment={() => {
                  /* Potentially call handleNodeSelect('sandwich', ...) */
                }}
                activeProfileState={activeProfileState}
                glCanvas={glCanvas}
              />
            )}
            {view === 'time_ordered' && (
              <ChronoFlamechartView
                ref={chronoViewRef}
                onNodeSelect={(node, cellId) => handleNodeSelect('time_ordered', node, cellId)}
                activeProfileState={activeProfileState}
                glCanvas={glCanvas}
                commentedCellIds={commentedChronoCellIds || []}
              />
            )}
            {view === 'left_heavy' && (
              <LeftHeavyFlamechartView
                ref={leftHeavyViewRef}
                onNodeSelect={(node, cellId) => {
                  handleNodeSelect('left_heavy', node, cellId);
                }}
                activeProfileState={activeProfileState}
                glCanvas={glCanvas}
                commentedCellIds={commentedLeftHeavyCellIds || []}
              />
            )}
          </ProfileSearchContextProvider>
        </div>

        {/* Render sidebar based on current view's selection state */}
        {currentSelection.cellId && traceId && (
          <CommentSidebar
            traceId={traceId}
            cellId={currentSelection.cellId}
            cellName={currentSelection.nodeName}
            commentType={commentTypeForView}
            comments={allComments || []}
            isLoading={commentsLoading}
            error={commentsError}
            onClose={handleCloseSidebar}
            replyingToCommentId={replyingToCommentId}
            onStartReply={onStartReply}
            onCancelReply={onCancelReply}
            onCommentUpdated={onCommentUpdated}
            isAuthenticated={isAuthenticated}
          />
        )}

        {/* Chat Feature - Render the container */}
        {!isLoading && !error && profileGroup && <ChatContainer traceId={traceId} />}
      </div>
    </div>
  );
};

export default SpeedscopeViewer;
