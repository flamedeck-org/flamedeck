import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  importProfilesFromArrayBuffer,
  importProfileGroupFromText 
} from '@/lib/speedscope-import';
import { profileGroupAtom, glCanvasAtom, flattenRecursionAtom } from '@/lib/speedscope-core/app-state';
import { ActiveProfileState, useActiveProfileState } from '@/lib/speedscope-core/app-state/active-profile-state'; 
import { useAtom } from '@/lib/speedscope-core/atom'; 
import { SandwichViewContainer } from './speedscope-ui/sandwich-view'; 
import { ProfileSearchContextProvider } from './speedscope-ui/search-view';
import { ChronoFlamechartView, LeftHeavyFlamechartView } from './speedscope-ui/flamechart-view-container';
import ProfileCommentForm from './ProfileCommentForm';
import { useTraceComments } from '@/hooks/useTraceComments';

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
  const [selectedCommentTarget, setSelectedCommentTarget] = useState<{identifier: string | null, type: string | null}>({ identifier: null, type: null });
  
  const profileGroup = useAtom(profileGroupAtom);
  const glCanvas = useAtom(glCanvasAtom);
  const flattenRecursion = useAtom(flattenRecursionAtom);
  const activeProfileState = useActiveProfileState();

  const { allComments, commentedChronoCellIds, overviewComments, isLoading: commentsLoading, error: commentsError } = useTraceComments(traceId);

  const handleSelectCommentTarget = useCallback((identifier: string | null, type: string | null) => {
    console.log("Target selected for comment:", { identifier, type });
    setSelectedCommentTarget({ identifier, type });
  }, []);

  const handleCommentPosted = useCallback(() => {
    setSelectedCommentTarget({ identifier: null, type: null });
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

      if (event.key === 'Escape' && selectedCommentTarget.identifier !== null) {
        handleSelectCommentTarget(null, null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [flattenRecursion, selectedCommentTarget, handleSelectCommentTarget]);

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
    <div className="h-full flex flex-col">
      <div className="flex-grow relative overflow-hidden">
        <ProfileSearchContextProvider>
          {view === 'sandwich' && (
            <SandwichViewContainer
              onFrameSelectForComment={() => {}}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
              commentedCellIds={[]}
            />
          )}
          {view === 'time_ordered' && (
            <ChronoFlamechartView
              onCellSelectForComment={handleSelectCommentTarget}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
              commentedCellIds={commentedChronoCellIds}
            />
          )}
          {view === 'left_heavy' && (
            <LeftHeavyFlamechartView
              onFrameSelectForComment={() => {}}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
              commentedCellIds={[]}
            />
          )}
        </ProfileSearchContextProvider>

        {selectedCommentTarget.identifier !== null && selectedCommentTarget.type && traceId && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background z-10">
            <h3 className="text-sm font-medium mb-2 flex justify-between items-center">
              <span>Commenting on {selectedCommentTarget.type} target: <span className="font-mono">{String(selectedCommentTarget.identifier)}</span></span>
            </h3>
            <ProfileCommentForm 
              traceId={traceId}
              commentType={selectedCommentTarget.type}
              commentIdentifier={selectedCommentTarget.identifier}
              onCommentPosted={handleCommentPosted}
              onCancel={() => handleSelectCommentTarget(null, null)}
              placeholder="Add comment..."
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeedscopeViewer; 