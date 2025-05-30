import type { Frame, Profile } from '@flamedeck/speedscope-core/profile';
import { memoizeByReference, memoizeByShallowEquality } from '@flamedeck/speedscope-core/lib-utils';
import { RowAtlas } from '@flamedeck/speedscope-gl/row-atlas';
import { CanvasContext } from '@flamedeck/speedscope-gl/canvas-context';
import type { FlamechartRowAtlasKey } from '@flamedeck/speedscope-gl/flamechart-renderer';
import type { Theme } from '@flamedeck/speedscope-theme/types';

export const createGetColorBucketForFrame = memoizeByReference(
  (frameToColorBucket: Map<number | string, number>) => {
    return (frame: Frame): number => {
      return frameToColorBucket.get(frame.key) || 0;
    };
  }
);

export const createGetCSSColorForFrame = memoizeByShallowEquality(
  ({
    theme,
    frameToColorBucket,
  }: {
    theme: Theme;
    frameToColorBucket: Map<number | string, number>;
  }) => {
    const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket);
    return (frame: Frame): string => {
      const t = getColorBucketForFrame(frame) / 255;
      return theme.colorForBucket(t).toCSS();
    };
  }
);

export const getCanvasContext = memoizeByShallowEquality(
  ({ theme, canvas }: { theme: Theme; canvas: HTMLCanvasElement }) => {
    return new CanvasContext(canvas, theme);
  }
);

export const getRowAtlas = memoizeByReference((canvasContext: CanvasContext) => {
  return new RowAtlas<FlamechartRowAtlasKey>(
    canvasContext.gl,
    canvasContext.rectangleBatchRenderer,
    canvasContext.textureRenderer
  );
});

export const getProfileToView = memoizeByShallowEquality(
  ({ profile, flattenRecursion }: { profile: Profile; flattenRecursion: boolean }): Profile => {
    return flattenRecursion ? profile.getProfileWithRecursionFlattened() : profile;
  }
);
export const getFrameToColorBucket = memoizeByReference(
  (profile: Profile): Map<string | number, number> => {
    const frames: Frame[] = [];
    profile.forEachFrame((f) => frames.push(f));
    function key(f: Frame) {
      return (f.file || '') + f.name;
    }
    function compare(a: Frame, b: Frame) {
      return key(a) > key(b) ? 1 : -1;
    }
    frames.sort(compare);
    const frameToColorBucket = new Map<string | number, number>();
    for (let i = 0; i < frames.length; i++) {
      frameToColorBucket.set(frames[i].key, Math.floor((255 * i) / frames.length));
    }

    return frameToColorBucket;
  }
);
