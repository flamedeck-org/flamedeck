import React, { memo, useMemo } from 'react';
import { getCanvasContext } from '../../lib/speedscope-core/app-state/getters';
import { useActiveProfileState } from '../../lib/speedscope-core/app-state/active-profile-state';
import { useTheme } from './theme';
import {
  dragActiveAtom,
  errorAtom,
  flattenRecursionAtom,
  glCanvasAtom,
  hashParamsAtom,
  loadingAtom,
  profileGroupAtom,
  viewModeAtom,
} from '../../lib/speedscope-core/app-state';
import { useAtom } from '../../lib/speedscope-core/atom';
import { ProfileSearchContextProvider } from './search-view';
import { Application } from './application';

export const ApplicationContainer = memo(() => {
  const canvas = useAtom(glCanvasAtom);
  const theme = useTheme();
  const canvasContext = useMemo(
    () => (canvas ? getCanvasContext({ theme, canvas }) : null),
    [theme, canvas]
  );

  return (
    <ProfileSearchContextProvider>
      <Application
        activeProfileState={useActiveProfileState()}
        canvasContext={canvasContext}
        setGLCanvas={glCanvasAtom.set}
        setLoading={loadingAtom.set}
        setError={errorAtom.set}
        setProfileGroup={profileGroupAtom.setProfileGroup}
        setDragActive={dragActiveAtom.set}
        setViewMode={viewModeAtom.set}
        setFlattenRecursion={flattenRecursionAtom.set}
        setProfileIndexToView={profileGroupAtom.setProfileIndexToView}
        profileGroup={useAtom(profileGroupAtom)}
        theme={theme}
        flattenRecursion={useAtom(flattenRecursionAtom)}
        viewMode={useAtom(viewModeAtom)}
        hashParams={useAtom(hashParamsAtom)}
        glCanvas={canvas}
        dragActive={useAtom(dragActiveAtom)}
        loading={useAtom(loadingAtom)}
        error={useAtom(errorAtom)}
      />
    </ProfileSearchContextProvider>
  );
});
