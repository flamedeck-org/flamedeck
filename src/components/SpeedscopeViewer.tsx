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
import CommentForm from './CommentForm';
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
  const [selectedFrameKeyForComment, setSelectedFrameKeyForComment] = useState<string | number | null>(null);
  
  const profileGroup = useAtom(profileGroupAtom);
  const glCanvas = useAtom(glCanvasAtom);
  const flattenRecursion = useAtom(flattenRecursionAtom);
  const activeProfileState = useActiveProfileState();

  // Fetch trace comments to identify frames that have comments
  const { commentedFrameKeys } = useTraceComments(traceId);

  const handleFrameSelectForComment = useCallback((key: string | number | null) => {
    console.log("Frame selected for comment:", key);
    setSelectedFrameKeyForComment(key);
  }, []);

  const handleCommentPosted = useCallback(() => {
    setSelectedFrameKeyForComment(null);
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
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [flattenRecursion]);

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
              onFrameSelectForComment={handleFrameSelectForComment}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
              commentedFrameKeys={commentedFrameKeys}
            />
          )}
          {view === 'time_ordered' && (
            <ChronoFlamechartView
              onFrameSelectForComment={handleFrameSelectForComment}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
              commentedFrameKeys={commentedFrameKeys}
            />
          )}
          {view === 'left_heavy' && (
            <LeftHeavyFlamechartView
              onFrameSelectForComment={handleFrameSelectForComment}
              activeProfileState={activeProfileState}
              glCanvas={glCanvas}
              commentedFrameKeys={commentedFrameKeys}
            />
          )}
        </ProfileSearchContextProvider>
      </div>

      {selectedFrameKeyForComment !== null && traceId && (
        <div className="flex-shrink-0 p-4 border-t bg-background">
          <h3 className="text-sm font-medium mb-2">
            Commenting on frame: {String(selectedFrameKeyForComment)}
            <button
              onClick={() => handleFrameSelectForComment(null)}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground"
              title="Cancel comment"
            >
              (Cancel)
            </button>
          </h3>
          <CommentForm
            traceId={traceId}
            frameKey={selectedFrameKeyForComment}
            onCommentPosted={handleCommentPosted}
            placeholder="Add comment to selected frame..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
};

export default SpeedscopeViewer; 