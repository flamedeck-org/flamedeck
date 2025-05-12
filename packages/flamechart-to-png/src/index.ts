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
import { Color } from '@flamedeck/speedscope-core/color'; // Needed for theme colors

export interface RenderToPngOptions {
  width?: number;
  height?: number;
  frameHeight?: number;
  font?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  mode?: 'light' | 'dark'; // Added mode option
  flamegraphThemeName?: FlamegraphThemeName; // Added flamegraph theme name option
}

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

// --- Frame Drawing Logic ---

interface DrawFrameParams {
  ctx: CanvasRenderingContext2D;
  frame: FlamechartFrame;
  y: number;
  frameHeightPx: number;
  startWeight: number;
  endWeight: number;
  xFactor: number;
  theme: Theme; // Use Theme object
  frameToColorBucket: Map<string | number, number>; // Pass map directly
  font: string;
  textPadding: number;
}

// Updated drawFrame to use theme and bucket map
function drawFrame({
  ctx,
  frame,
  y,
  frameHeightPx,
  startWeight,
  endWeight,
  xFactor,
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

  const x = (visibleStart - startWeight) * xFactor;
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
  ctx.strokeStyle = '#555'; // TODO: Use theme color for border?
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

// --- Time Axis Drawing Logic ---

interface DrawTimeAxisParams {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  axisHeight: number;
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
  startWeight,
  endWeight,
  xFactor,
  theme,
  formatValue,
}: DrawTimeAxisParams): void {
  // Background
  ctx.fillStyle = theme.altBgPrimaryColor || theme.bgSecondaryColor; // Use an alternate bg or secondary
  ctx.fillRect(0, 0, canvasWidth, axisHeight);

  // Axis line
  ctx.fillStyle = theme.fgSecondaryColor;
  ctx.fillRect(0, axisHeight - 1, canvasWidth, 1); // Line at the bottom of the axis area

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
    const xPos = (tickWeight - startWeight) * xFactor;

    // Draw tick line
    ctx.fillStyle = theme.fgSecondaryColor;
    ctx.fillRect(xPos - 0.5, 0, 1, axisHeight - 1); // Center line on pixel

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

  // Setup Canvas
  const axisHeightPx = 20; // Height reserved for the time axis
  const canvasWidth = options.width || 1200;
  const frameHeightPx = options.frameHeight || 18;
  // Add axis height and padding below frames
  const estimatedCanvasHeight = axisHeightPx + (flamechart.getLayers().length + 1) * frameHeightPx;
  const canvasHeight = options.height || Math.max(axisHeightPx + 50, estimatedCanvasHeight); // Ensure minimum height
  const font = options.font || '10px Arial';
  const textPadding = 3;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

  // Background
  ctx.fillStyle = finalTheme.bgPrimaryColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Check for valid profile weight
  const totalWeight = flamechart.getTotalWeight();
  if (totalWeight <= 0) {
    console.warn('[flamechart-to-png] Total weight of the flamechart is 0, nothing to render.');
    ctx.fillStyle = finalTheme.fgPrimaryColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Profile is empty or has zero total weight.', canvasWidth / 2, canvasHeight / 2);
    return canvas.toBuffer('image/png');
  }

  // Calculate render range
  const { startWeight, endWeight, visibleWeight, xFactor, isValidTimeRange } = calculateRenderRange(
    activeProfile,
    totalWeight,
    canvasWidth,
    options
  );

  // Handle empty/invalid range before drawing axis
  if (visibleWeight <= 0 && isValidTimeRange) {
    console.warn(
      '[flamechart-to-png] Calculated visible weight is 0 or negative, nothing to render in the specified range.'
    );
    ctx.fillStyle = finalTheme.fgPrimaryColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Selected time range is empty or too small.', canvasWidth / 2, canvasHeight / 2);
    return canvas.toBuffer('image/png');
  }

  // Draw Time Axis FIRST (below background, above frames)
  drawTimeAxis({
    ctx,
    canvasWidth,
    axisHeight: axisHeightPx,
    startWeight,
    endWeight,
    xFactor,
    theme: finalTheme,
    formatValue: flamechartDataSource.formatValue, // Pass the formatter
  });

  // Draw layers and frames, shifted down by axis height
  flamechart.getLayers().forEach((layer, layerIndex) => {
    const y = axisHeightPx + layerIndex * frameHeightPx; // Shift y-coordinate
    layer.forEach((frame) => {
      drawFrame({
        ctx,
        frame,
        y,
        frameHeightPx,
        startWeight,
        endWeight,
        xFactor,
        theme: finalTheme,
        frameToColorBucket,
        font,
        textPadding,
      });
    });
  });

  console.log('[flamechart-to-png] Flamegraph rendering pass complete.');
  return canvas.toBuffer('image/png');
}
