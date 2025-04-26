import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  importProfilesFromArrayBuffer,
  importProfileGroupFromText 
} from '@/lib/speedscope-import';
import { profileGroupAtom, glCanvasAtom, flattenRecursionAtom } from '@/lib/speedscope-core/app-state';
import { ActiveProfileState, useActiveProfileState, CallTreeNode } from '@/lib/speedscope-core/app-state/active-profile-state'; 
import { useAtom } from '@/lib/speedscope-core/atom'; 
import { SandwichViewContainer } from './speedscope-ui/sandwich-view'; 
import { ProfileSearchContextProvider } from './speedscope-ui/search-view';
import { ChronoFlamechartView, LeftHeavyFlamechartView } from './speedscope-ui/flamechart-view-container';
import ProfileCommentForm from './ProfileCommentForm';
import { useTraceComments } from '@/hooks/useTraceComments';
import CommentSidebar from './CommentSidebar';
import { TraceCommentWithAuthor } from '@/lib/api';

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

interface SpeedscopeViewerProps {
  traceId?: string;
  traceData: string | ArrayBuffer; 
  fileName: string;
  view: SpeedscopeViewType;
}

const SpeedscopeViewer: React.FC<SpeedscopeViewerProps> = ({ traceId, traceData, fileName, view }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State to hold selection info per view
  const [selectedCommentInfoByView, setSelectedCommentInfoByView] = useState<Record<SpeedscopeViewType, SelectedCommentState>>({
    time_ordered: { cellId: null, nodeName: null },
    left_heavy: { cellId: null, nodeName: null },
    sandwich: { cellId: null, nodeName: null }, // Initialize for all views
  });
  
  const profileGroup = useAtom(profileGroupAtom);
  const glCanvas = useAtom(glCanvasAtom);
  const flattenRecursion = useAtom(flattenRecursionAtom);
  const activeProfileState = useActiveProfileState();

  // Fetch all comments once
  const { 
    allComments, 
    commentedChronoCellIds, 
    commentedLeftHeavyCellIds,
    isLoading: commentsLoading, 
    error: commentsError 
  } = useTraceComments(traceId);

  // Updated handler to accept the view type
  const handleNodeSelect = useCallback((activeView: SpeedscopeViewType, node: CallTreeNode | null, cellId?: string | null) => {
    console.log(`[handleNodeSelect] Called for view: ${activeView}, cellId: ${cellId}, node name: ${node?.frame.name}`); // Log arguments
    const nodeName = node?.frame.name ?? null;
    setSelectedCommentInfoByView(prev => {
      // Log previous and next state for this view
      console.log(`[handleNodeSelect] Updating state for ${activeView}. Prev:`, prev[activeView], `Next: { cellId: ${cellId ?? null}, nodeName: ${nodeName} }`);
      return {
          ...prev,
          [activeView]: { cellId: cellId ?? null, nodeName: nodeName }
      }
    });
  }, []);

  // Simplified close handler - only closes for the currently active view
  const handleCloseSidebar = useCallback(() => {
    setSelectedCommentInfoByView(prev => ({
      ...prev,
      [view]: { cellId: null, nodeName: null } // Reset only the current view's state
    }));
  }, [view]); // Re-create if the active view changes

  useEffect(() => {
    let isCancelled = false;
    if (traceData && fileName) {
      setError(null);
      setIsLoading(true);
      profileGroupAtom.set(null);

      const importerPromise = 
        traceData instanceof ArrayBuffer
          ? importProfilesFromArrayBuffer(fileName, traceData)
          : importProfileGroupFromText(fileName, traceData);

      importerPromise
        .then(({ profileGroup }) => {
          if (isCancelled) return;
          if (profileGroup && profileGroup.profiles.length > 0) {
            profileGroupAtom.setProfileGroup(profileGroup);
            setError(null);
          } else if (profileGroup) {
             setError('Could not parse the profile file. The format might be unsupported or the file corrupted.');
             profileGroupAtom.set(null); 
          } else {
            setError('Import process failed unexpectedly.');
            profileGroupAtom.set(null); 
          }
        })
        .catch(err => {
          if (isCancelled) return;
          setError(`An error occurred during import: ${err instanceof Error ? err.message : String(err)}`);
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
  }, [traceData, fileName]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === 'r') { flattenRecursionAtom.set(!flattenRecursion); }
      if (event.key === 'Escape') {
        // Close sidebar for the current view if it's open
        if (selectedCommentInfoByView[view].cellId !== null) {
          handleCloseSidebar();
        } else {
          // Fallback to deselecting node in speedscope core
          activeProfileState?.setSelectedNode(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
    // Depend on the current view's selection state and the close handler
  }, [selectedCommentInfoByView, view, activeProfileState, flattenRecursion, handleCloseSidebar]);

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
    <div className="h-full flex flex-row relative">
      <div className="flex-grow h-full relative overflow-hidden">
        <ProfileSearchContextProvider>
          {view === 'sandwich' && (
            <SandwichViewContainer
              onFrameSelectForComment={() => { /* Potentially call handleNodeSelect('sandwich', ...) */ }}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
            />
          )}
          {view === 'time_ordered' && (
            <ChronoFlamechartView
              onNodeSelect={(node, cellId) => handleNodeSelect('time_ordered', node, cellId)}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
              commentedCellIds={commentedChronoCellIds || []}
            />
          )}
          {view === 'left_heavy' && (
            <LeftHeavyFlamechartView
              onNodeSelect={(node, cellId) => {
                // Log that the callback from LeftHeavyFlamechartView was triggered
                console.log(`[LeftHeavyFlamechartView onNodeSelect] Triggered. cellId: ${cellId}, node name: ${node?.frame.name}`); 
                handleNodeSelect('left_heavy', node, cellId)
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
          commentType={commentTypeForView} // Use the mapped comment type
          comments={allComments || []} 
          isLoading={commentsLoading}
          error={commentsError}
          onClose={handleCloseSidebar} // Use the specific close handler
        />
      )}
    </div>
  );
};

export default SpeedscopeViewer; 