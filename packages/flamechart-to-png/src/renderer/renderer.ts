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
  totalCanvasWidth: number; // Width of the entire canvas this flamechart is part of
  finalHeight: number; // Height of the specific section this flamechart will occupy
  flamechartAreaWidth: number; // Width for the flamechart bars (totalCanvasWidth - DEPTH_AXIS_WIDTH_PX)
  // Add a field to indicate if a time axis is part of this section's rendering
  includeTimeAxisInThisSection: boolean;
}

export interface InternalRenderOptions {
  profile: Profile;
  flamechart: Flamechart;
  canvas: Canvas;
  ctx: CanvasRenderingContext2D; // This context is for the *entire section* this flamechart occupies
  theme: Theme;
  frameToColorBucket: Map<string | number, number>;
  startDepth: number;
  renderRange: RenderRangeResult;
  metrics: InternalRenderMetrics;
  orientation: 'top-down' | 'bottom-up';
}

export function renderFlamechart(opts: InternalRenderOptions): void {
  const {
    ctx,
    theme,
    startDepth,
    renderRange,
    metrics,
    flamechart,
    profile,
    frameToColorBucket,
    orientation,
  } = opts;

  const { startWeight, endWeight, xFactor, isValidTimeRange, visibleWeight } = renderRange;
  const {
    frameHeightPx,
    font,
    finalHeight: sectionHeight, // Height of this flamechart's allocated section
    flamechartAreaWidth,
    totalCanvasWidth: sectionCanvasWidth,
    includeTimeAxisInThisSection,
  } = metrics;

  // Background for the entire section this flamechart will occupy.
  // The caller (e.g., renderLeftHeavyFlamechart or renderSandwichFlamechart) sets up the main canvas background.
  // This specific fill is for this flamechart's own designated rectangle (e.g. top half or bottom half).
  // It assumes ctx is already translated to the top-left of this section.
  ctx.fillStyle = theme.bgPrimaryColor;
  ctx.fillRect(0, 0, sectionCanvasWidth, sectionHeight);

  const totalWeight = flamechart.getTotalWeight();
  if (totalWeight <= 0) {
    ctx.fillStyle = theme.fgPrimaryColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Profile is empty or has zero total weight.',
      sectionCanvasWidth / 2,
      sectionHeight / 2
    );
    return;
  }

  if (visibleWeight <= 0 && isValidTimeRange) {
    ctx.fillStyle = theme.fgPrimaryColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Selected time range is empty or too small.',
      sectionCanvasWidth / 2,
      sectionHeight / 2
    );
    return;
  }

  const numLayers = flamechart.getLayers().length;
  const maxDepth = numLayers > 0 ? startDepth + numLayers - 1 : startDepth;

  // Y-coordinate where the stack frames (and depth axis alongside them) begin.
  // This depends on whether a time axis is drawn at the top of *this section*.
  const stackFramesStartY =
    includeTimeAxisInThisSection && orientation === 'top-down' ? AXIS_HEIGHT_PX : 0;
  // Height available for the stack frames area (and depth axis).
  const stackFramesHeight = sectionHeight - (includeTimeAxisInThisSection ? AXIS_HEIGHT_PX : 0);

  // --- Draw Depth Axis ---
  // Save context, translate to depth axis position, draw, then restore.
  ctx.save();
  ctx.translate(0, stackFramesStartY); // Position depth axis correctly if there's a time axis above
  drawDepthAxis({
    ctx,
    canvasHeight: stackFramesHeight, // It draws within the height allocated for frames
    depthAxisWidth: DEPTH_AXIS_WIDTH_PX,
    frameHeight: frameHeightPx,
    maxDepth,
    startDepth,
    theme,
    orientation,
  });
  ctx.restore();

  // --- Draw Time Axis (if included in this section and orientation is top-down) ---
  if (includeTimeAxisInThisSection && orientation === 'top-down') {
    ctx.save();
    // Time axis is drawn at the top of this section, to the right of depth axis.
    // No vertical translation needed as it starts at y=0 of this section's context.
    // Horizontal translation is to skip depth axis area.
    // ctx.translate(DEPTH_AXIS_WIDTH_PX, 0);
    drawTimeAxis({
      ctx, // This context is for the time axis area
      canvasWidth: flamechartAreaWidth,
      axisHeight: AXIS_HEIGHT_PX,
      xAxisOffset: DEPTH_AXIS_WIDTH_PX, // Offset from left edge of section
      startWeight,
      endWeight,
      xFactor,
      theme,
      formatValue: profile.formatValue.bind(profile),
    });
    ctx.restore();
  }
  // Note: For 'bottom-up' orientation, if a time axis were part of this section,
  // it would be at the bottom. renderSandwichFlamechart will handle the central time axis.

  // --- Draw Flame Frames ---
  ctx.save();
  // Translate context to where flame frames start: right of depth axis, and below time axis (if any).
  ctx.translate(DEPTH_AXIS_WIDTH_PX, stackFramesStartY);
  const layersToRender = flamechart.getLayers().slice(startDepth);

  layersToRender.forEach((layer, visibleLayerIndex) => {
    let y;
    if (orientation === 'top-down') {
      y = visibleLayerIndex * frameHeightPx;
    } else {
      // bottom-up
      // `stackFramesHeight` is the height of the area for drawing frames.
      // Layers are drawn from bottom of this area upwards.
      y = stackFramesHeight - (visibleLayerIndex + 1) * frameHeightPx;
    }

    layer.forEach((frame) => {
      drawFrame({
        ctx, // Context is now translated to the top-left of the flame frame drawing area
        frame,
        y,
        frameHeightPx,
        startWeight,
        endWeight,
        xFactor,
        xAxisOffset: 0, // Frames are drawn starting at x=0 of this translated context
        theme,
        frameToColorBucket,
        font,
        textPadding: TEXT_PADDING,
      });
    });
  });
  ctx.restore();

  console.log(`[flamechart-to-png] Core ${orientation} flamechart rendering pass complete.`);
}
