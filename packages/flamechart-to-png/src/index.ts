import type { Frame, Profile, ProfileGroup } from '@flamedeck/speedscope-core/profile';
import {
  Flamechart,
  type FlamechartDataSource,
  type FlamechartFrame,
} from '@flamedeck/speedscope-core/flamechart';
import { createCanvas, type CanvasRenderingContext2D } from 'canvas';
import type {
  Theme,
  FlamegraphThemeName,
  FlamegraphTheme,
} from '@flamedeck/speedscope-theme/types';
import { lightTheme } from '@flamedeck/speedscope-theme/light-theme'; // Default theme
import { darkTheme } from '@flamedeck/speedscope-theme/dark-theme';
import { flamegraphThemeRegistry } from '@flamedeck/speedscope-theme/flamegraph-theme-registry';

export interface RenderToPngOptions {
  width?: number;
  height?: number;
  frameHeight?: number;
  font?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  mode?: 'light' | 'dark'; // Added mode option
  flamegraphThemeName?: FlamegraphThemeName; // Added flamegraph theme name option
  startDepth?: number; // Added startDepth option
}

// --- Constants ---
const DEFAULT_FRAME_HEIGHT = 18;
const DEFAULT_FONT = '10px Arial';
const DEFAULT_WIDTH = 1200;
const AXIS_HEIGHT_PX = 20; // Height for time axis
const DEPTH_AXIS_WIDTH_PX = 30; // Width for depth axis
const TEXT_PADDING = 3;

// --- Color & Utility Functions (Old ones will be removed/replaced) ---

// Replicate logic from getters.ts
export const getFrameToColorBucket = (profile: Profile): Map<string | number, number> => {
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
  const n = frames.length;
  for (let i = 0; i < n; i++) {
    const bucket = n === 0 ? 0 : Math.floor((255 * i) / n);
    frameToColorBucket.set(frames[i].key, bucket);
  }
  return frameToColorBucket;
};

export const createGetColorBucketForFrame = (frameToColorBucket: Map<number | string, number>) => {
  return (frame: Frame): number => {
    // Default to 0 if frame.key is somehow not in the map
    return frameToColorBucket.get(frame.key) ?? 0;
  };
};

// --- Rendering Range Calculation ---

interface RenderRangeResult {
  startWeight: number;
  endWeight: number;
  visibleWeight: number;
  xFactor: number;
  isValidTimeRange: boolean;
}

function calculateRenderRange(
  profile: Profile,
  totalWeight: number,
  canvasWidth: number,
  options: RenderToPngOptions
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

function calculateFinalCanvasHeight(
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

// --- Frame Drawing Logic ---

interface DrawFrameParams {
  ctx: CanvasRenderingContext2D;
  frame: FlamechartFrame;
  y: number;
  frameHeightPx: number;
  startWeight: number;
  endWeight: number;
  xFactor: number;
  xAxisOffset: number;
  theme: Theme;
  frameToColorBucket: Map<string | number, number>;
  font: string;
  textPadding: number;
}

function drawFrame({
  ctx,
  frame,
  y,
  frameHeightPx,
  startWeight,
  endWeight,
  xFactor,
  xAxisOffset,
  theme,
  frameToColorBucket,
  font,
  textPadding,
}: DrawFrameParams): void {
  if (frame.end <= startWeight || frame.start >= endWeight) {
    return;
  }

  const visibleStart = Math.max(frame.start, startWeight);
  const visibleEnd = Math.min(frame.end, endWeight);
  const visibleDuration = visibleEnd - visibleStart;

  if (visibleDuration <= 0) return;

  const x = xAxisOffset + (visibleStart - startWeight) * xFactor;
  const rectWidth = visibleDuration * xFactor;

  if (rectWidth < 0.1) {
    return;
  }

  // Get color from theme
  const bucket = frameToColorBucket.get(frame.node.frame.key) ?? 0;
  const t = bucket / 255;
  // TODO: Add fallback color if theme doesn't provide one?
  ctx.fillStyle = theme.colorForBucket(t).toCSS();

  // Draw rectangle
  ctx.fillRect(x, y, Math.max(0, rectWidth), frameHeightPx);

  // Draw border
  ctx.strokeStyle = theme.bgPrimaryColor;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, Math.max(0, rectWidth), frameHeightPx);

  // Draw text label
  const minWidthForText = 20;
  if (rectWidth > minWidthForText) {
    ctx.font = font;
    // Safely access flamegraphTextColor with fallback
    ctx.fillStyle =
      (theme as Theme & Partial<FlamegraphTheme>).flamegraphTextColor || theme.fgPrimaryColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const frameName = frame.node.frame.name;
    const maxTextWidth = rectWidth - 2 * textPadding;
    let displayText = frameName;

    if (ctx.measureText(displayText).width > maxTextWidth) {
      let newLen = displayText.length;
      while (
        ctx.measureText(displayText.substring(0, newLen) + '...').width > maxTextWidth &&
        newLen > 1
      ) {
        newLen--;
      }
      displayText = displayText.substring(0, newLen) + (newLen < frameName.length ? '...' : '');
    }

    if (ctx.measureText(displayText).width <= maxTextWidth && displayText.length > 0) {
      ctx.fillText(displayText, x + textPadding, y + frameHeightPx / 2);
    }
  }
}

// --- Depth Axis Drawing Logic ---

interface DrawDepthAxisParams {
  ctx: CanvasRenderingContext2D;
  canvasHeight: number;
  depthAxisWidth: number;
  timeAxisHeight: number;
  frameHeight: number;
  maxDepth: number;
  startDepth: number;
  theme: Theme;
}

function drawDepthAxis({
  ctx,
  canvasHeight,
  depthAxisWidth,
  timeAxisHeight,
  frameHeight,
  maxDepth,
  startDepth,
  theme,
}: DrawDepthAxisParams): void {
  // Background
  ctx.fillStyle = theme.bgPrimaryColor;
  ctx.fillRect(0, 0, depthAxisWidth, canvasHeight);

  // Separator line
  ctx.fillStyle = theme.fgSecondaryColor;
  ctx.fillRect(depthAxisWidth - 1, 0, 1, canvasHeight);

  // Text style
  const fontSize = 10;
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = theme.fgPrimaryColor;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Draw labels only every 5 levels (or if it's the startDepth)
  const labelInterval = 5;
  for (let depth = startDepth; depth <= maxDepth; depth++) {
    const yPos = timeAxisHeight + (depth - startDepth) * frameHeight + frameHeight / 2;

    // Only draw if the center of the row is visible
    if (
      yPos >= timeAxisHeight &&
      yPos <= canvasHeight &&
      (depth % labelInterval === 0 || depth === startDepth)
    ) {
      ctx.fillText(String(depth), depthAxisWidth - TEXT_PADDING - 2, yPos);
    }
  }
}

// --- Time Axis Drawing Logic ---

interface DrawTimeAxisParams {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  axisHeight: number;
  xAxisOffset: number;
  startWeight: number;
  endWeight: number;
  xFactor: number;
  theme: Theme;
  formatValue: (v: number) => string;
}

function drawTimeAxis({
  ctx,
  canvasWidth,
  axisHeight,
  xAxisOffset,
  startWeight,
  endWeight,
  xFactor,
  theme,
  formatValue,
}: DrawTimeAxisParams): void {
  // Background
  ctx.fillStyle = theme.bgPrimaryColor;
  ctx.fillRect(xAxisOffset, 0, canvasWidth, axisHeight);

  // Axis line
  ctx.fillStyle = theme.fgSecondaryColor;
  ctx.fillRect(xAxisOffset, axisHeight - 1, canvasWidth, 1);

  // Calculate tick interval
  const targetTickDistancePx = 100; // Aim for ticks ~100px apart
  const targetIntervalWeight = targetTickDistancePx / xFactor;

  if (targetIntervalWeight <= 0 || !isFinite(targetIntervalWeight)) {
    console.warn('[flamechart-to-png] Could not determine valid tick interval for axis.');
    return;
  }

  const minInterval = Math.pow(10, Math.floor(Math.log10(targetIntervalWeight)));
  let interval = minInterval;
  if (targetIntervalWeight / interval >= 5) {
    interval *= 5;
  } else if (targetIntervalWeight / interval >= 2) {
    interval *= 2;
  }

  if (interval <= 0) {
    console.warn('[flamechart-to-png] Calculated tick interval is zero or negative.');
    return; // Avoid infinite loops
  }

  // Text style
  const fontSize = 10;
  const textPadding = 2;
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = theme.fgPrimaryColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // Draw ticks and labels
  const firstTickWeight = Math.ceil(startWeight / interval) * interval;
  for (let tickWeight = firstTickWeight; tickWeight < endWeight; tickWeight += interval) {
    const xPos = xAxisOffset + (tickWeight - startWeight) * xFactor;

    // Draw tick line
    ctx.fillStyle = theme.fgSecondaryColor;
    ctx.fillRect(xPos - 0.5, 0, 1, axisHeight - 1);

    // Draw label
    const labelText = formatValue(tickWeight);
    ctx.fillStyle = theme.fgPrimaryColor;
    ctx.fillText(labelText, xPos, axisHeight - textPadding);
  }
}

// --- Main Rendering Function ---

/**
 * Renders a flamegraph from a ProfileGroup to a PNG buffer.
 *
 * @param profileGroup The ProfileGroup object from @flamedeck/speedscope-core.
 * @param options Optional rendering parameters.
 * @returns A Promise that resolves with a Buffer containing the PNG data.
 */
export async function renderToPng(
  profileGroup: ProfileGroup,
  options: RenderToPngOptions = {}
): Promise<Buffer> {
  if (!profileGroup.profiles || profileGroup.profiles.length === 0) {
    console.error('[flamechart-to-png] Profile group contains no profiles.');
    return Buffer.from('');
  }

  const activeProfile: Profile = profileGroup.profiles[profileGroup.indexToView];
  if (!activeProfile) {
    console.error('[flamechart-to-png] Active profile not found.');
    return Buffer.from('');
  }

  // --- Theme Composition ---
  const { mode = 'light', flamegraphThemeName } = options;
  const baseTheme = mode === 'dark' ? darkTheme : lightTheme;
  let finalTheme: Theme = baseTheme;

  if (flamegraphThemeName && flamegraphThemeName !== 'system') {
    const variants = flamegraphThemeRegistry[flamegraphThemeName];
    if (variants) {
      const flamegraphThemeOverride = mode === 'dark' ? variants.dark : variants.light;
      if (flamegraphThemeOverride) {
        // Merge base theme with flamegraph theme override
        finalTheme = { ...baseTheme, ...flamegraphThemeOverride };
      }
    }
  }
  // --- End Theme Composition ---

  console.log(
    `[flamechart-to-png] Rendering profile: ${activeProfile.getName() || 'Unnamed Profile'} using ${mode} mode` +
      (flamegraphThemeName ? ` (${flamegraphThemeName} flame theme)` : '')
  );

  // Get color mapping based on profile
  const frameToColorBucket = getFrameToColorBucket(activeProfile);
  const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket);

  const flamechartDataSource: FlamechartDataSource = {
    getTotalWeight: activeProfile.getTotalWeight.bind(activeProfile),
    forEachCall: activeProfile.forEachCall.bind(activeProfile),
    formatValue: activeProfile.formatValue.bind(activeProfile),
    getColorBucketForFrame: getColorBucketForFrame, // Use the new function
  };

  const flamechart = new Flamechart(flamechartDataSource);

  // --- Canvas Setup & Height/Width Calculation ---
  // Ensure startDepth is a number, default to 0
  let startDepth = options.startDepth !== undefined ? Number(options.startDepth) : 0;
  if (isNaN(startDepth)) {
    console.warn(
      `[flamechart-to-png] Invalid startDepth value provided (${options.startDepth}), defaulting to 0.`
    );
    startDepth = 0;
  }

  const frameHeightPx = options.frameHeight || DEFAULT_FRAME_HEIGHT;
  const font = options.font || DEFAULT_FONT;
  // Use effective total width from options or default
  const totalCanvasWidth = options.width || DEFAULT_WIDTH;
  // Calculate width remaining for flamechart + time axis
  const flamechartAreaWidth = totalCanvasWidth - DEPTH_AXIS_WIDTH_PX;

  // Calculate final height (using existing helper)
  const numLayers = flamechart.getLayers().length;
  const maxDepth = numLayers > 0 ? startDepth + numLayers - 1 : startDepth;
  const estimatedHeightBasedOnFrames =
    AXIS_HEIGHT_PX + (numLayers > 0 ? numLayers + 1 : 2) * frameHeightPx;
  const finalHeight = calculateFinalCanvasHeight(
    options.height,
    flamechartAreaWidth, // Cap height based on flamechart area width, not total width
    estimatedHeightBasedOnFrames,
    AXIS_HEIGHT_PX,
    frameHeightPx
  );

  const canvas = createCanvas(totalCanvasWidth, finalHeight);
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
  // --- End Canvas Setup ---

  // Background (Entire canvas)
  ctx.fillStyle = finalTheme.bgPrimaryColor;
  ctx.fillRect(0, 0, totalCanvasWidth, finalHeight);

  // Check for valid profile weight
  const totalWeight = flamechart.getTotalWeight();
  if (totalWeight <= 0) {
    console.warn('[flamechart-to-png] Total weight of the flamechart is 0, nothing to render.');
    ctx.fillStyle = finalTheme.fgPrimaryColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Profile is empty or has zero total weight.',
      totalCanvasWidth / 2,
      finalHeight / 2
    );
    return canvas.toBuffer('image/png');
  }

  // Calculate render range based on available flamechart width
  const { startWeight, endWeight, visibleWeight, xFactor, isValidTimeRange } = calculateRenderRange(
    activeProfile,
    totalWeight,
    flamechartAreaWidth,
    options
  );

  // Handle empty/invalid range before drawing axes
  if (visibleWeight <= 0 && isValidTimeRange) {
    console.warn(
      '[flamechart-to-png] Calculated visible weight is 0 or negative, nothing to render in the specified range.'
    );
    ctx.fillStyle = finalTheme.fgPrimaryColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Selected time range is empty or too small.',
      totalCanvasWidth / 2,
      finalHeight / 2
    );
    return canvas.toBuffer('image/png');
  }

  // --- Draw Axes ---
  // Draw Depth Axis
  drawDepthAxis({
    ctx,
    canvasHeight: finalHeight,
    depthAxisWidth: DEPTH_AXIS_WIDTH_PX,
    timeAxisHeight: AXIS_HEIGHT_PX,
    frameHeight: frameHeightPx,
    maxDepth,
    startDepth,
    theme: finalTheme,
  });

  // Draw Time Axis (shifted right)
  drawTimeAxis({
    ctx,
    canvasWidth: flamechartAreaWidth,
    axisHeight: AXIS_HEIGHT_PX,
    xAxisOffset: DEPTH_AXIS_WIDTH_PX,
    startWeight,
    endWeight,
    xFactor,
    theme: finalTheme,
    formatValue: flamechartDataSource.formatValue,
  });
  // --- End Draw Axes ---

  // Get the relevant layers based on startDepth
  const layersToRender = flamechart.getLayers().slice(startDepth);

  layersToRender.forEach((layer, visibleLayerIndex) => {
    const y = AXIS_HEIGHT_PX + visibleLayerIndex * frameHeightPx; // Y position for drawing on canvas

    layer.forEach((frame) => {
      drawFrame({
        ctx,
        frame,
        y,
        frameHeightPx,
        startWeight,
        endWeight,
        xFactor,
        xAxisOffset: DEPTH_AXIS_WIDTH_PX,
        theme: finalTheme,
        frameToColorBucket,
        font,
        textPadding: TEXT_PADDING,
      });
    });
  });

  console.log('[flamechart-to-png] Flamegraph rendering pass complete.');
  return canvas.toBuffer('image/png');
}
