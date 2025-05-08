import { memo, forwardRef, useRef, useImperativeHandle } from 'react';
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
import { FlamechartID } from '../../lib/speedscope-core/app-state/profile-group';
import { flattenRecursionAtom, glCanvasAtom } from '../../lib/speedscope-core/app-state';
import { useAtom } from '../../lib/speedscope-core/atom';
import { useTheme } from './themes/theme';

const getInvertedCallerProfile = memoizeByShallowEquality(
  ({
    profile,
    frame,
    flattenRecursion,
  }: {
    profile: Profile;
    frame: Frame;
    flattenRecursion: boolean;
  }): Profile => {
    const p = profile.getInvertedProfileForCallersOf(frame);
    return flattenRecursion ? p.getProfileWithRecursionFlattened() : p;
  }
);

const getInvertedCallerFlamegraph = memoizeByShallowEquality(
  ({
    invertedCallerProfile,
    getColorBucketForFrame,
  }: {
    invertedCallerProfile: Profile;
    getColorBucketForFrame: (frame: Frame) => number;
  }): Flamechart => {
    return new Flamechart({
      getTotalWeight: invertedCallerProfile.getTotalNonIdleWeight.bind(invertedCallerProfile),
      forEachCall: invertedCallerProfile.forEachCallGrouped.bind(invertedCallerProfile),
      formatValue: invertedCallerProfile.formatValue.bind(invertedCallerProfile),
      getColorBucketForFrame,
    });
  }
);

const getInvertedCallerFlamegraphRenderer = createMemoizedFlamechartRenderer({ inverted: true });

export const InvertedCallerFlamegraphView = memo(
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

    const flamechart = getInvertedCallerFlamegraph({
      invertedCallerProfile: getInvertedCallerProfile({
        profile,
        frame: selectedFrame,
        flattenRecursion,
      }),
      getColorBucketForFrame,
    });
    const flamechartRenderer = getInvertedCallerFlamegraphRenderer({ canvasContext, flamechart });

    return (
      <FlamechartWrapper
        ref={flamechartWrapperRef}
        theme={theme}
        renderInverted={true}
        flamechart={flamechart}
        flamechartRenderer={flamechartRenderer}
        canvasContext={canvasContext}
        getCSSColorForFrame={getCSSColorForFrame}
        {...useFlamechartSetters(FlamechartID.SANDWICH_INVERTED_CALLERS)}
        {...callerCallee.invertedCallerFlamegraph}
        setSelectedNode={noop}
      />
    );
  })
);
