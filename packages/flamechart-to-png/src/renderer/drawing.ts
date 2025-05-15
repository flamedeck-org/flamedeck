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

export function drawFrame({
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

  const bucket = frameToColorBucket.get(frame.node.frame.key) ?? 0;
  const t = bucket / 255;
  ctx.fillStyle = theme.colorForBucket(t).toCSS();

  ctx.fillRect(x, y, Math.max(0, rectWidth), frameHeightPx);

  ctx.strokeStyle = theme.bgPrimaryColor;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, Math.max(0, rectWidth), frameHeightPx);

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
      ctx.fillText(displayText, x + textPadding, y + frameHeightPx / 2);
    }
  }
}

// --- Depth Axis Drawing Logic ---

export interface DrawDepthAxisParams {
  ctx: CanvasRenderingContext2D;
  canvasHeight: number;
  depthAxisWidth: number;
  timeAxisHeight: number;
  frameHeight: number;
  maxDepth: number;
  startDepth: number;
  theme: Theme;
}

export function drawDepthAxis({
  ctx,
  canvasHeight,
  depthAxisWidth,
  timeAxisHeight,
  frameHeight,
  maxDepth,
  startDepth,
  theme,
}: DrawDepthAxisParams): void {
  ctx.fillStyle = theme.bgPrimaryColor;
  ctx.fillRect(0, 0, depthAxisWidth, canvasHeight);

  ctx.fillStyle = theme.fgSecondaryColor;
  ctx.fillRect(depthAxisWidth - 1, 0, 1, canvasHeight);

  const fontSize = 10;
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = theme.fgPrimaryColor;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const labelInterval = 5;
  for (let depth = startDepth; depth <= maxDepth; depth++) {
    const yPos = timeAxisHeight + (depth - startDepth) * frameHeight + frameHeight / 2;

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
}: DrawTimeAxisParams): void {
  ctx.fillStyle = theme.bgPrimaryColor;
  ctx.fillRect(xAxisOffset, 0, canvasWidth, axisHeight);

  ctx.fillStyle = theme.fgSecondaryColor;
  ctx.fillRect(xAxisOffset, axisHeight - 1, canvasWidth, 1);

  const targetTickDistancePx = 100;
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

    ctx.fillStyle = theme.fgSecondaryColor;
    ctx.fillRect(xPos - 0.5, 0, 1, axisHeight - 1);

    ctx.fillStyle = theme.fgPrimaryColor;
    ctx.fillText(formatValue(tickWeight), xPos, axisHeight - textPadding);
  }
}
