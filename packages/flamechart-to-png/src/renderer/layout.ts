import type { Profile } from '@flamedeck/speedscope-core/profile';
import type { RenderLeftHeavyFlamechartOptions } from '../index';

// --- Constants ---
export const DEFAULT_FRAME_HEIGHT = 18;
export const DEFAULT_FONT = '10px Arial';
export const DEFAULT_WIDTH = 1200;
export const AXIS_HEIGHT_PX = 20; // Height for time axis
export const DEPTH_AXIS_WIDTH_PX = 30; // Width for depth axis
export const TEXT_PADDING = 3;

// --- Rendering Range Calculation ---

export interface RenderRangeResult {
  startWeight: number;
  endWeight: number;
  visibleWeight: number;
  xFactor: number;
  isValidTimeRange: boolean;
}

export function calculateRenderRange(
  profile: Profile,
  totalWeight: number,
  canvasWidth: number,
  options: RenderLeftHeavyFlamechartOptions // Assuming RenderToPngOptions is sufficient for now
): RenderRangeResult {
  let startWeight = 0;
  let endWeight = totalWeight;
  const unit = profile.getWeightUnit();
  let isValidTimeRange = true;

  let msToWeightUnitFactor: number | null = null;
  if (unit === 'nanoseconds') msToWeightUnitFactor = 1_000_000;
  else if (unit === 'microseconds') msToWeightUnitFactor = 1_000;
  else if (unit === 'milliseconds') msToWeightUnitFactor = 1;
  else if (unit === 'seconds') msToWeightUnitFactor = 0.001;

  if (
    (options.startTimeMs !== undefined || options.endTimeMs !== undefined) &&
    msToWeightUnitFactor !== null
  ) {
    if (options.startTimeMs !== undefined) {
      startWeight = Math.max(0, options.startTimeMs * msToWeightUnitFactor);
    }
    if (options.endTimeMs !== undefined) {
      endWeight = Math.min(totalWeight, options.endTimeMs * msToWeightUnitFactor);
    }

    if (startWeight >= endWeight) {
      console.warn(
        `[flamechart-to-png] Invalid time range: startTimeMs (${options.startTimeMs}) resulted in startWeight (${startWeight}) >= endTimeMs (${options.endTimeMs}) resulted in endWeight (${endWeight}). Rendering full chart.`
      );
      startWeight = 0;
      endWeight = totalWeight;
      isValidTimeRange = false;
    } else {
      console.log(
        `[flamechart-to-png] Rendering weight range: ${startWeight} to ${endWeight} (based on ${
          options.startTimeMs ?? 'start'
        }ms to ${options.endTimeMs ?? 'end'}ms)`
      );
    }
  } else if (options.startTimeMs !== undefined || options.endTimeMs !== undefined) {
    console.warn(
      `[flamechart-to-png] startTimeMs/endTimeMs provided, but profile unit (${unit}) is not time-based or not recognized for conversion. Ignoring time range.`
    );
  }

  const visibleWeight = endWeight - startWeight;
  const xFactor = canvasWidth / (visibleWeight > 0 ? visibleWeight : 1); // Avoid division by zero

  return { startWeight, endWeight, visibleWeight, xFactor, isValidTimeRange };
}

// --- Height Calculation Logic ---

export function calculateFinalCanvasHeight(
  requestedHeight: number | undefined,
  widthToCapBy: number,
  estimatedContentHeight: number,
  minAxisHeight: number,
  minFrameHeight: number
): number {
  let calculatedHeight: number;
  if (requestedHeight !== undefined) {
    calculatedHeight = Math.min(requestedHeight, widthToCapBy);
    console.log(
      `[flamechart-to-png] User height ${requestedHeight} provided, capping at width ${widthToCapBy}. Intermediate height: ${calculatedHeight}`
    );
  } else {
    calculatedHeight = Math.min(estimatedContentHeight, widthToCapBy);
    console.log(
      `[flamechart-to-png] Height not specified. Estimated: ${estimatedContentHeight}, capping at width ${widthToCapBy}. Intermediate height: ${calculatedHeight}`
    );
  }
  // Ensure a minimum practical height (e.g., axis + 2 rows of frames)
  const minPracticalHeight = minAxisHeight + minFrameHeight * 2;
  calculatedHeight = Math.max(minPracticalHeight, calculatedHeight);
  console.log(`[flamechart-to-png] Final height after min practical check: ${calculatedHeight}`);
  return calculatedHeight;
}
