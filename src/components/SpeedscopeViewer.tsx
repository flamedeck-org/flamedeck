import React, { useState, useEffect, useMemo } from 'react';
import { 
  importProfilesFromArrayBuffer,
  importProfileGroupFromText 
} from '@/lib/speedscope-import';
import { profileGroupAtom, glCanvasAtom } from '@/lib/speedscope-core/app-state'; 
import { ActiveProfileState } from '@/lib/speedscope-core/app-state/active-profile-state'; 
import { useAtom } from '@/lib/speedscope-core/atom'; 
import { SandwichViewContainer } from './speedscope-ui/sandwich-view'; 
import { ProfileSearchContextProvider } from './speedscope-ui/search-view';
import { useTheme } from './speedscope-ui/themes/theme';
import { LeftHeavyFlamechartView } from './speedscope-ui/flamechart-view-container';
import { FlamechartID } from '@/lib/speedscope-core/app-state/profile-group';
import { getCanvasContext } from '@/lib/speedscope-core/app-state/getters';

interface SpeedscopeViewerProps {
  traceData: string | ArrayBuffer; 
  fileName: string;
  view?: 'sandwich' | 'time_ordered' | 'left_heavy';
}

const SpeedscopeViewer: React.FC<SpeedscopeViewerProps> = ({ traceData, fileName, view = 'time_ordered' }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const profileGroup = useAtom(profileGroupAtom);
  const glCanvas = useAtom(glCanvasAtom);
  const theme = useTheme()

  const canvasContext = useMemo(
    () => (glCanvas ? getCanvasContext({theme, canvas: glCanvas}) : null),
    [theme, glCanvas],
  )

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
        .then(loadedProfileGroup => {
          if (isCancelled) return;
          if (loadedProfileGroup && loadedProfileGroup.profiles.length > 0) {
            profileGroupAtom.setProfileGroup(loadedProfileGroup);
            setError(null);
          } else if (loadedProfileGroup) {
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

  const activeProfileState: ActiveProfileState | null = useMemo(() => {
    return profileGroup
      ? {
          ...profileGroup.profiles[profileGroup.indexToView],
          index: profileGroup.indexToView,
        }
      : null;
  }, [profileGroup]);

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
    <div className="h-full flex">
      <ProfileSearchContextProvider>
        {view === 'sandwich' && (
          <SandwichViewContainer 
            activeProfileState={activeProfileState} 
            glCanvas={glCanvas}
          />
        )}
        {/* {view === 'time_ordered' && (
          <TimeOrderedViewContainer 
            activeProfileState={activeProfileState} 
            glCanvas={glCanvas}
          />
        )} */}
        {view === 'left_heavy' && (
          <LeftHeavyFlamechartView
            flamechart={activeProfileState.profile.getGroupedCalltreeRoot()}
            flamechartRenderer={activeProfileState.leftHeavyRenderer}
            canvasContext={canvasContext}
            theme={theme}
            activeProfileState={activeProfileState}
            flamechartID={FlamechartID.LEFT_HEAVY}
            flamechartViewState={activeProfileState.leftHeavyViewState}
            // updateFlamechartViewState={this.props.setFlamechartViewState!}
          />
        )}
      </ProfileSearchContextProvider>
    </div>
  );
};

export default SpeedscopeViewer; 