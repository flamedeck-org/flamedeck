import { memoizeByShallowEquality, noop } from '../../lib/speedscope-core/lib-utils';
import type { Profile, Frame } from '../../lib/speedscope-core/profile';
import { Flamechart } from '../../lib/speedscope-core/flamechart';
import type {
  FlamechartViewContainerProps,
  FlamechartViewHandle,
} from './flamechart-view-container';
import {
  createMemoizedFlamechartRenderer,
  useFlamechartSetters,
} from './flamechart-view-container';
import {
  getCanvasContext,
  createGetColorBucketForFrame,
  createGetCSSColorForFrame,
  getFrameToColorBucket,
} from '../../lib/speedscope-core/app-state/getters';
import { FlamechartWrapper } from './flamechart-wrapper';
import React, { memo, forwardRef, useRef, useImperativeHandle } from 'react';
import { useTheme } from './themes/theme';
import { FlamechartID } from '../../lib/speedscope-core/app-state/profile-group';
import { flattenRecursionAtom, glCanvasAtom } from '../../lib/speedscope-core/app-state';
import { useAtom } from '../../lib/speedscope-core/atom';

const getCalleeProfile = memoizeByShallowEquality<
  {
    profile: Profile;
    frame: Frame;
    flattenRecursion: boolean;
  },
  Profile
>(({ profile, frame, flattenRecursion }) => {
  const p = profile.getProfileForCalleesOf(frame);
  return flattenRecursion ? p.getProfileWithRecursionFlattened() : p;
});

const getCalleeFlamegraph = memoizeByShallowEquality<
  {
    calleeProfile: Profile;
    getColorBucketForFrame: (frame: Frame) => number;
  },
  Flamechart
>(({ calleeProfile, getColorBucketForFrame }) => {
  return new Flamechart({
    getTotalWeight: calleeProfile.getTotalNonIdleWeight.bind(calleeProfile),
    forEachCall: calleeProfile.forEachCallGrouped.bind(calleeProfile),
    formatValue: calleeProfile.formatValue.bind(calleeProfile),
    getColorBucketForFrame,
  });
});

const getCalleeFlamegraphRenderer = createMemoizedFlamechartRenderer();

export const CalleeFlamegraphView = memo(
  forwardRef<FlamechartViewHandle, FlamechartViewContainerProps>((props, ref) => {
    const { activeProfileState } = props;
    const { profile, sandwichViewState } = activeProfileState;
    const flattenRecursion = useAtom(flattenRecursionAtom);
    const glCanvas = useAtom(glCanvasAtom);
    const theme = useTheme();

    const flamechartWrapperRef = useRef<FlamechartViewHandle>(null);

    useImperativeHandle(ref, () => ({
      drawOverlayOnto: (targetCtx: CanvasRenderingContext2D) => {
        flamechartWrapperRef.current?.drawOverlayOnto(targetCtx);
      },
    }));

    if (!profile) throw new Error('profile missing');
    if (!glCanvas) throw new Error('glCanvas missing');
    const { callerCallee } = sandwichViewState;
    if (!callerCallee) throw new Error('callerCallee missing');
    const { selectedFrame } = callerCallee;

    const frameToColorBucket = getFrameToColorBucket(profile);
    const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket);
    const getCSSColorForFrame = createGetCSSColorForFrame({ theme, frameToColorBucket });
    const canvasContext = getCanvasContext({ theme, canvas: glCanvas });

    const flamechart = getCalleeFlamegraph({
      calleeProfile: getCalleeProfile({ profile, frame: selectedFrame, flattenRecursion }),
      getColorBucketForFrame,
    });
    const flamechartRenderer = getCalleeFlamegraphRenderer({ canvasContext, flamechart });

    return (
      <FlamechartWrapper
        ref={flamechartWrapperRef}
        theme={theme}
        renderInverted={false}
        flamechart={flamechart}
        flamechartRenderer={flamechartRenderer}
        canvasContext={canvasContext}
        getCSSColorForFrame={getCSSColorForFrame}
        {...useFlamechartSetters(FlamechartID.SANDWICH_CALLEES)}
        {...callerCallee.calleeFlamegraph}
        setSelectedNode={noop}
      />
    );
  })
);
