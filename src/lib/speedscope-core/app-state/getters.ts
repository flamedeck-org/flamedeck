import {Frame, Profile} from '../profile'
import {memoizeByReference, memoizeByShallowEquality} from '../lib-utils'
import {RowAtlas} from '../../speedscope-gl/row-atlas'
import {CanvasContext} from '../../speedscope-gl/canvas-context'
import {FlamechartRowAtlasKey} from '../../speedscope-gl/flamechart-renderer'
import {Theme} from '@/components/speedscope-ui/themes/theme'

export const createGetColorBucketForFrame = memoizeByReference(
  (frameToColorBucket: Map<number | string, number>) => {
    return (frame: Frame): number => {
      return frameToColorBucket.get(frame.key) || 0
    }
  },
)

export const createGetCSSColorForFrame = memoizeByShallowEquality(
  ({
    // TODO: Re-enable or adapt theme usage for Tailwind
    // theme, 
    frameToColorBucket,
  }: {
    // TODO: Re-enable or adapt theme usage for Tailwind
    // theme: Theme 
    frameToColorBucket: Map<number | string, number>
  }) => {
    const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket)
    return (frame: Frame): string => {
      const bucket = getColorBucketForFrame(frame);
      
      // TODO: Replace this placeholder logic with proper Tailwind color mapping or re-enable theme usage
      // Simple grayscale mapping for now:
      const lightness = 90 - (bucket % 5) * 10; // Example: Vary lightness
      return `hsl(0, 0%, ${lightness}%)`;

      // Original logic:
      // const t = getColorBucketForFrame(frame) / 255
      // return theme.colorForBucket(t).toCSS()
    }
  },
)

export const getCanvasContext = memoizeByShallowEquality(
  ({theme, canvas}: {theme: Theme; canvas: HTMLCanvasElement}) => {
    return new CanvasContext(canvas, theme)
  },
)

export const getRowAtlas = memoizeByReference((canvasContext: CanvasContext) => {
  return new RowAtlas<FlamechartRowAtlasKey>(
    canvasContext.gl,
    canvasContext.rectangleBatchRenderer,
    canvasContext.textureRenderer,
  )
})

export const getProfileToView = memoizeByShallowEquality(
  ({profile, flattenRecursion}: {profile: Profile; flattenRecursion: boolean}): Profile => {
    return flattenRecursion ? profile.getProfileWithRecursionFlattened() : profile
  },
)
export const getFrameToColorBucket = memoizeByReference(
  (profile: Profile): Map<string | number, number> => {
    const frames: Frame[] = []
    profile.forEachFrame(f => frames.push(f))
    function key(f: Frame) {
      return (f.file || '') + f.name
    }
    function compare(a: Frame, b: Frame) {
      return key(a) > key(b) ? 1 : -1
    }
    frames.sort(compare)
    const frameToColorBucket = new Map<string | number, number>()
    for (let i = 0; i < frames.length; i++) {
      frameToColorBucket.set(frames[i].key, Math.floor((255 * i) / frames.length))
    }

    return frameToColorBucket
  },
)
