import type { Canvas, CanvasRenderingContext2D } from 'canvas';
import type { Profile } from '@flamedeck/speedscope-core/profile';
import type { Flamechart } from '@flamedeck/speedscope-core/flamechart';
import type { Theme } from '@flamedeck/speedscope-theme/types';
import type { RenderRangeResult } from './layout';
import { drawFrame, drawDepthAxis, drawTimeAxis } from './drawing';
import { AXIS_HEIGHT_PX, DEPTH_AXIS_WIDTH_PX, TEXT_PADDING } from './layout';

export interface InternalRenderMetrics {
  frameHeightPx: number;
  font: string;
  totalCanvasWidth: number;
  finalHeight: number;
  flamechartAreaWidth: number;
}

export interface InternalRenderOptions {
  profile: Profile;
  flamechart: Flamechart; // Pass the flamechart instance
  canvas: Canvas; // Keep canvas for potential direct drawing not in flamechart
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  frameToColorBucket: Map<string | number, number>;
  startDepth: number;
  renderRange: RenderRangeResult;
  metrics: InternalRenderMetrics;
  // orientation: 1 | -1; // To be added for sandwich view
}

export function renderFlamechart(opts: InternalRenderOptions): void {
  const {
    ctx,
    theme,
    startDepth,
    renderRange,
    metrics,
    flamechart,
    profile, // Added profile for formatValue
    frameToColorBucket,
  } = opts;

  const { startWeight, endWeight, xFactor, isValidTimeRange, visibleWeight } = renderRange;
  const { frameHeightPx, font, finalHeight, flamechartAreaWidth, totalCanvasWidth } = metrics;

  // Background (Entire canvas) - This is done in index.ts for now.
  // ctx.fillStyle = theme.bgPrimaryColor;
  // ctx.fillRect(0, 0, metrics.totalCanvasWidth, metrics.finalHeight);

  // Check for valid profile weight (totalWeight comes from flamechart)
  const totalWeight = flamechart.getTotalWeight();
  if (totalWeight <= 0) {
    console.warn('[flamechart-to-png] Total weight of the flamechart is 0, nothing to render.');
    ctx.fillStyle = theme.fgPrimaryColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Profile is empty or has zero total weight.',
      totalCanvasWidth / 2,
      finalHeight / 2
    );
    return; // Return early if nothing to render
  }

  // Handle empty/invalid range before drawing axes
  if (visibleWeight <= 0 && isValidTimeRange) {
    console.warn(
      '[flamechart-to-png] Calculated visible weight is 0 or negative, nothing to render in the specified range.'
    );
    ctx.fillStyle = theme.fgPrimaryColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Selected time range is empty or too small.',
      totalCanvasWidth / 2,
      finalHeight / 2
    );
    return; // Return early
  }

  // --- Draw Axes ---
  const numLayers = flamechart.getLayers().length;
  const maxDepth = numLayers > 0 ? startDepth + numLayers - 1 : startDepth;

  drawDepthAxis({
    ctx,
    canvasHeight: finalHeight,
    depthAxisWidth: DEPTH_AXIS_WIDTH_PX,
    timeAxisHeight: AXIS_HEIGHT_PX,
    frameHeight: frameHeightPx,
    maxDepth,
    startDepth,
    theme,
  });

  drawTimeAxis({
    ctx,
    canvasWidth: flamechartAreaWidth,
    axisHeight: AXIS_HEIGHT_PX,
    xAxisOffset: DEPTH_AXIS_WIDTH_PX,
    startWeight,
    endWeight,
    xFactor,
    theme,
    formatValue: profile.formatValue.bind(profile), // Pass formatValue from profile
  });
  // --- End Draw Axes ---

  // Get the relevant layers based on startDepth
  const layersToRender = flamechart.getLayers().slice(startDepth);

  layersToRender.forEach((layer, visibleLayerIndex) => {
    const y = AXIS_HEIGHT_PX + visibleLayerIndex * frameHeightPx;

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
        theme,
        frameToColorBucket,
        font,
        textPadding: TEXT_PADDING,
      });
    });
  });

  console.log('[flamechart-to-png] Core flamechart rendering pass complete.');
}
