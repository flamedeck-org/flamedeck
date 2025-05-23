import type { CanvasRenderingContext2D } from 'canvas';
import type { FlamechartFrame } from '@flamedeck/speedscope-core/flamechart';
import type { Theme, FlamegraphTheme } from '@flamedeck/speedscope-theme/types';
import { TEXT_PADDING } from './layout'; // Import TEXT_PADDING

// --- Frame Drawing Logic ---

export interface DrawFrameParams {
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

export function drawFrameRectangle({
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
}: // font and textPadding are not needed for drawing the rectangle itself
  DrawFrameParams): { x: number; rectWidth: number } | null {
  if (frame.end <= startWeight || frame.start >= endWeight) {
    return null;
  }

  const visibleStart = Math.max(frame.start, startWeight);
  const visibleEnd = Math.min(frame.end, endWeight);
  const visibleDuration = visibleEnd - visibleStart;

  if (visibleDuration <= 0) return null;

  const x = xAxisOffset + (visibleStart - startWeight) * xFactor;
  const rectWidth = visibleDuration * xFactor;

  if (rectWidth < 0.1) {
    return null;
  }

  const bucket = frameToColorBucket.get(frame.node.frame.key) ?? 0;
  const t = bucket / 255;
  ctx.fillStyle = theme.colorForBucket(t).toCSS();

  ctx.fillRect(x, y, Math.max(0, rectWidth), frameHeightPx);

  ctx.strokeStyle = theme.bgPrimaryColor;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, Math.max(0, rectWidth), frameHeightPx);
  return { x, rectWidth };
}

export function drawFrameText({
  ctx,
  frame,
  y,
  frameHeightPx,
  font,
  textPadding,
  theme,
  rectX,
  rectWidth,
}: Omit<DrawFrameParams, 'startWeight' | 'endWeight' | 'xFactor' | 'xAxisOffset' | 'frameToColorBucket'> & {
  rectX: number;
  rectWidth: number;
}) {
  const minWidthForText = 20;
  if (rectWidth > minWidthForText) {
    ctx.font = font;
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
      ctx.fillText(displayText, rectX + textPadding, y + frameHeightPx / 2);
    }
  }
}

// --- Depth Axis Drawing Logic ---

export interface DrawDepthAxisParams {
  ctx: CanvasRenderingContext2D;
  canvasHeight: number; // Full height of the depth axis column itself
  depthAxisWidth: number;
  frameHeight: number;
  maxDepth: number;
  startDepth: number;
  theme: Theme;
  orientation: 'top-down' | 'bottom-up';
  // yOffset is removed; caller should translate context if needed
}

export function drawDepthAxis({
  ctx,
  canvasHeight, // This is the height of the depth axis drawing area
  depthAxisWidth,
  frameHeight,
  maxDepth,
  startDepth,
  theme,
  orientation,
}: DrawDepthAxisParams): void {
  ctx.fillStyle = theme.bgPrimaryColor;
  ctx.fillRect(0, 0, depthAxisWidth, canvasHeight); // Covers its own area

  ctx.fillStyle = theme.fgSecondaryColor;
  ctx.fillRect(depthAxisWidth - 1, 0, 1, canvasHeight); // Separator line

  const fontSize = 10;
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = theme.fgPrimaryColor;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const labelInterval = 5;
  for (let depth = startDepth; depth <= maxDepth; depth++) {
    const currentDepthLayerIndex = depth - startDepth;
    let yPosOnContext: number;

    if (orientation === 'top-down') {
      // Labels are positioned at the middle of each frame height slot, starting from top (0)
      yPosOnContext = currentDepthLayerIndex * frameHeight + frameHeight / 2;
    } else {
      // bottom-up
      // Labels are positioned from the bottom up.
      // (maxDepth - startDepth) is the index of the last layer from top (0-indexed).
      // Total number of layers to display ticks for is (maxDepth - startDepth + 1)
      // The last frame (visually at the top for bottom-up) corresponds to maxDepth.
      // The first frame (visually at the bottom for bottom-up) corresponds to startDepth.
      // yPos is calculated from the bottom of the canvasHeight for the depth axis.
      yPosOnContext = canvasHeight - (currentDepthLayerIndex * frameHeight + frameHeight / 2);
    }

    if (
      yPosOnContext >= 0 &&
      yPosOnContext <= canvasHeight &&
      (depth % labelInterval === 0 || depth === startDepth)
    ) {
      ctx.fillText(String(depth), depthAxisWidth - TEXT_PADDING - 2, yPosOnContext);
    }
  }
}

// --- Time Axis Drawing Logic ---

export interface DrawTimeAxisParams {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  axisHeight: number;
  xAxisOffset: number;
  startWeight: number;
  endWeight: number;
  xFactor: number;
  theme: Theme;
  formatValue: (v: number) => string;
  flamechartVisibleHeight: number; // New parameter for the height of the flamegraph area below the axis
}

export function drawTimeAxis({
  ctx,
  canvasWidth,
  axisHeight,
  xAxisOffset,
  startWeight,
  endWeight,
  xFactor,
  theme,
  formatValue,
  flamechartVisibleHeight, // Destructure new parameter
}: DrawTimeAxisParams): void {
  // Draw the background for the time axis label area first
  ctx.fillStyle = theme.bgPrimaryColor;
  ctx.fillRect(xAxisOffset, 0, canvasWidth, axisHeight);

  // Draw the bottom border for the time axis label area
  ctx.fillStyle = theme.fgSecondaryColor;
  ctx.fillRect(xAxisOffset, axisHeight - 1, canvasWidth, 1);

  const targetTickDistancePx = 150;
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
    return;
  }

  const fontSize = 10;
  const textPadding = 2;
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = theme.fgPrimaryColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const firstTickWeight = Math.ceil(startWeight / interval) * interval;
  for (let tickWeight = firstTickWeight; tickWeight < endWeight; tickWeight += interval) {
    const xPos = xAxisOffset + (tickWeight - startWeight) * xFactor;

    // Draw the vertical tick line extending through the flamechart area
    ctx.fillStyle = theme.fgSecondaryColor; // Use the same color as the axis bottom border
    // The line starts at y=0 (top of the axis band) and extends down to the bottom of the flamechart area
    ctx.fillRect(xPos - 0.5, 0, 1, axisHeight + flamechartVisibleHeight);

    // Draw the text label on top of the (now extended) tick line
    ctx.fillStyle = theme.fgPrimaryColor;
    ctx.fillText(formatValue(tickWeight), xPos, axisHeight - textPadding);
  }
}

// --- Vertical Time Grid Lines Drawing Logic ---

export interface DrawVerticalTimeGridLinesParams {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number; // Width of the area where lines should be drawn (e.g., flamechartAreaWidth)
  totalSectionHeight: number; // Total height the lines should span (e.g., sectionHeight)
  xAxisOffset: number; // Horizontal offset for drawing (e.g., DEPTH_AXIS_WIDTH_PX)
  startWeight: number;
  endWeight: number;
  xFactor: number;
  theme: Theme;
}

export function drawVerticalTimeGridLines({
  ctx,
  canvasWidth,
  totalSectionHeight,
  xAxisOffset,
  startWeight,
  endWeight,
  xFactor,
  theme,
}: DrawVerticalTimeGridLinesParams): void {
  const targetTickDistancePx = 200;
  const targetIntervalWeight = targetTickDistancePx / xFactor;

  if (targetIntervalWeight <= 0 || !isFinite(targetIntervalWeight)) {
    // console.warn('[flamechart-to-png] Could not determine valid tick interval for grid lines.');
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
    // console.warn('[flamechart-to-png] Calculated grid line interval is zero or negative.');
    return;
  }

  ctx.fillStyle = theme.fgSecondaryColor; // Use the same color as axis ticks

  const firstTickWeight = Math.ceil(startWeight / interval) * interval;
  for (let tickWeight = firstTickWeight; tickWeight < endWeight; tickWeight += interval) {
    const xPos = xAxisOffset + (tickWeight - startWeight) * xFactor;
    // Draw the vertical line spanning the totalSectionHeight from the top (y=0 of the current context)
    ctx.fillRect(xPos - 0.5, 0, 1, totalSectionHeight);
  }
}
