import type { Canvas, CanvasRenderingContext2D } from 'canvas';
import type { Profile } from '@flamedeck/speedscope-core/profile';
import type { Flamechart, FlamechartFrame } from '@flamedeck/speedscope-core/flamechart';
import type { Theme } from '@flamedeck/speedscope-theme/types';
import type { RenderRangeResult } from './layout';
import {
  drawFrameRectangle,
  drawFrameText,
  drawDepthAxis,
  drawTimeAxis,
  drawVerticalTimeGridLines,
} from './drawing';
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
  gridRenderRange?: RenderRangeResult; // Optional: for drawing grid/axis, defaults to renderRange
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

  // Determine the effective range for grid and axis drawing
  const effectiveGridRange = opts.gridRenderRange || renderRange;

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

  // --- Draw Flame Frame Rectangles ---
  // The context is already translated to the top-left of the flame frame drawing area by the end of depth axis drawing.
  // So, no need for additional translation here if we consider drawing frames immediately after depth axis.
  // However, for clarity and safety, let's explicitly manage the transform for the flame-related drawing parts.

  ctx.save();
  ctx.translate(DEPTH_AXIS_WIDTH_PX, stackFramesStartY); // Translate to where flame frames start

  const layersToRender = flamechart.getLayers().slice(startDepth);
  const frameRenderData: Array<{ params: Parameters<typeof drawFrameText>[0], frame: FlamechartFrame, y: number, rectData: { x: number, rectWidth: number } }> = [];

  layersToRender.forEach((layer, visibleLayerIndex) => {
    let y;
    if (orientation === 'top-down') {
      y = visibleLayerIndex * frameHeightPx;
    } else {
      // bottom-up
      y = stackFramesHeight - (visibleLayerIndex + 1) * frameHeightPx;
    }

    layer.forEach((frame) => {
      const rectData = drawFrameRectangle({
        ctx,
        frame,
        y,
        frameHeightPx,
        startWeight,
        endWeight,
        xFactor,
        xAxisOffset: 0, // Frames are drawn starting at x=0 of this translated context
        theme,
        frameToColorBucket,
        // These are not used by drawFrameRectangle, but satisfy DrawFrameParams for now
        font,
        textPadding: TEXT_PADDING,
      });
      if (rectData) {
        frameRenderData.push({ frame, y, rectData, params: {} as any }); // Placeholder for params
      }
    });
  });
  // Rectangles are drawn. Now restore the context from flame area translation.
  ctx.restore();

  // --- Draw Time Axis OR Vertical Time Grid Lines ---
  // These will be drawn on top of frame rectangles.
  // The context for these functions should be the section's context (0,0 being top-left of section)
  if (includeTimeAxisInThisSection && orientation === 'top-down') {
    ctx.save();
    drawTimeAxis({
      ctx,
      canvasWidth: flamechartAreaWidth,
      axisHeight: AXIS_HEIGHT_PX,
      xAxisOffset: DEPTH_AXIS_WIDTH_PX,
      startWeight: effectiveGridRange.startWeight,
      endWeight: effectiveGridRange.endWeight,
      xFactor: effectiveGridRange.xFactor,
      theme,
      formatValue: profile.formatValue.bind(profile),
      flamechartVisibleHeight: stackFramesHeight,
    });
    ctx.restore();
  } else if (!includeTimeAxisInThisSection) {
    ctx.save();
    drawVerticalTimeGridLines({
      ctx,
      canvasWidth: flamechartAreaWidth,
      totalSectionHeight: sectionHeight,
      xAxisOffset: DEPTH_AXIS_WIDTH_PX,
      startWeight: effectiveGridRange.startWeight,
      endWeight: effectiveGridRange.endWeight,
      xFactor: effectiveGridRange.xFactor,
      theme,
    });
    ctx.restore();
  }

  // --- Draw Flame Frame Text ---
  // Text is drawn last, on top of rectangles and grid lines.
  ctx.save();
  ctx.translate(DEPTH_AXIS_WIDTH_PX, stackFramesStartY); // Translate again to the flame frame area

  frameRenderData.forEach(data => {
    drawFrameText({
      ctx,
      frame: data.frame,
      y: data.y,
      frameHeightPx,
      font,
      textPadding: TEXT_PADDING,
      theme,
      rectX: data.rectData.x,
      rectWidth: data.rectData.rectWidth,
    });
  });
  ctx.restore();

  console.log(`[flamechart-to-png] Core ${orientation} flamechart rendering pass complete.`);
}
