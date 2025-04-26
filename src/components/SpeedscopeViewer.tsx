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

export type SpeedscopeViewType = 'sandwich' | 'time_ordered' | 'left_heavy';

interface SpeedscopeViewerProps {
  traceId?: string;
  traceData: string | ArrayBuffer; 
  fileName: string;
  view: SpeedscopeViewType;
}

const SpeedscopeViewer: React.FC<SpeedscopeViewerProps> = ({ traceId, traceData, fileName, view }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCellIdForComments, setSelectedCellIdForComments] = useState<string | null>(null);
  const [selectedNodeNameForComments, setSelectedNodeNameForComments] = useState<string | null>(null);
  
  const profileGroup = useAtom(profileGroupAtom);
  const glCanvas = useAtom(glCanvasAtom);
  const flattenRecursion = useAtom(flattenRecursionAtom);
  const activeProfileState = useActiveProfileState();

  const { allComments, commentedChronoCellIds, isLoading: commentsLoading, error: commentsError } = useTraceComments(traceId);

  const handleNodeSelect = useCallback((node: CallTreeNode | null, cellId?: string | null) => {
    const nodeName = node?.frame.name ?? null;
    setSelectedCellIdForComments(cellId ?? null);
    setSelectedNodeNameForComments(nodeName);
    if (!cellId) {
        setSelectedNodeNameForComments(null);
    }
  }, []);

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

      if (event.key === 'r') {
        flattenRecursionAtom.set(!flattenRecursion);
      }

      if (event.key === 'Escape') {
        if (selectedCellIdForComments !== null) {
          setSelectedCellIdForComments(null);
        } else {
          activeProfileState?.setSelectedNode(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [flattenRecursion, selectedCellIdForComments, activeProfileState]);

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

  return (
    <div className="h-full flex flex-row relative">
      <div className="flex-grow h-full relative overflow-hidden">
        <ProfileSearchContextProvider>
          {view === 'sandwich' && (
            <SandwichViewContainer
              onFrameSelectForComment={() => {}}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
            />
          )}
          {view === 'time_ordered' && (
            <ChronoFlamechartView
              onNodeSelect={handleNodeSelect}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
              commentedCellIds={commentedChronoCellIds || []}
            />
          )}
          {view === 'left_heavy' && (
            <LeftHeavyFlamechartView
              onNodeSelect={handleNodeSelect}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
              commentedCellIds={[]}
            />
          )}
        </ProfileSearchContextProvider>
      </div>

      {selectedCellIdForComments && traceId && (
        <CommentSidebar
          traceId={traceId}
          cellId={selectedCellIdForComments}
          cellName={selectedNodeNameForComments}
          commentType="chrono"
          comments={allComments || []}
          isLoading={commentsLoading}
          error={commentsError}
          onClose={() => {
              setSelectedCellIdForComments(null);
              setSelectedNodeNameForComments(null);
          }}
        />
      )}
    </div>
  );
};

export default SpeedscopeViewer; 