import type { Profile, Frame } from '@flamedeck/speedscope-core/profile';
import { Flamechart, } from '@flamedeck/speedscope-core/flamechart';
import { createCanvas } from 'canvas';
import type { RenderLeftHeavyFlamechartOptions } from './leftHeavy'; // Assuming this is the base
import { getFrameToColorBucket, createGetColorBucketForFrame } from './renderer/color';
import { composeTheme } from './renderer/theme';
import {
  DEFAULT_FRAME_HEIGHT,
  DEFAULT_FONT,
  DEFAULT_WIDTH,
  AXIS_HEIGHT_PX,
  DEPTH_AXIS_WIDTH_PX,
  TEXT_PADDING,
  calculateRenderRange,
  calculateFinalCanvasHeight,
} from './renderer/layout';
import {
  renderFlamechart,
  type InternalRenderMetrics,
} from './renderer/renderer';
import { drawTimeAxis } from './renderer/drawing';

export interface RenderSandwichFlamechartOptions extends RenderLeftHeavyFlamechartOptions {
  sidebarWidth?: number;
  centralAxisHeight?: number;
  // Potentially, allow separate height definitions for caller/callee sections if not using options.height
  callerHeight?: number;
  calleeHeight?: number;
}

const DEFAULT_SIDEBAR_WIDTH = 20; // px, narrower than depth axis
const DEFAULT_CENTRAL_AXIS_HEIGHT = AXIS_HEIGHT_PX;

/**
 * Renders a sandwich flamegraph view from a Profile and a selected Frame to a PNG buffer.
 */
export async function renderSandwichFlamechart(
  mainProfile: Profile,
  selectedFrame: Frame, // Now takes a Frame object directly
  options: RenderSandwichFlamechartOptions = {}
): Promise<Buffer> {
  if (!mainProfile) {
    console.error('[flamechart-to-png] Main profile not provided for sandwich view.');
    // Return a small error image
    const errCanvas = createCanvas(300, 100);
    const errCtx = errCanvas.getContext('2d');
    errCtx.font = '16px Arial';
    errCtx.textAlign = 'center';
    errCtx.fillText('Main profile missing.', 150, 50);
    return errCanvas.toBuffer('image/png');
  }
  if (!selectedFrame) {
    console.error('[flamechart-to-png] Selected frame not provided for sandwich view.');
    const errCanvas = createCanvas(300, 100);
    const errCtx = errCanvas.getContext('2d');
    errCtx.font = '16px Arial';
    errCtx.textAlign = 'center';
    errCtx.fillText('Selected frame missing.', 150, 50);
    return errCanvas.toBuffer('image/png');
  }

  console.log(`[flamechart-to-png] Rendering sandwich view for frame: "${selectedFrame.name}"`);

  const callerProfileInput = mainProfile.getInvertedProfileForCallersOf(selectedFrame);
  const calleeProfileInput = mainProfile.getProfileForCalleesOf(selectedFrame);

  const callerProfile = callerProfileInput
    ? callerProfileInput.getProfileWithRecursionFlattened()
    : null;
  const calleeProfile = calleeProfileInput
    ? calleeProfileInput.getProfileWithRecursionFlattened()
    : null;

  if (!callerProfile || callerProfile.getTotalWeight() === 0) {
    console.warn('[flamechart-to-png] No significant caller data for selected frame.');
    // Potentially render only callee Profile or an error message
  }
  if (!calleeProfile || calleeProfile.getTotalWeight() === 0) {
    console.warn('[flamechart-to-png] No significant callee data for selected frame.');
    // Potentially render only caller Profile or an error message
  }

  // If both are empty, it's not a very useful sandwich
  if (
    (!callerProfile || callerProfile.getTotalWeight() === 0) &&
    (!calleeProfile || calleeProfile.getTotalWeight() === 0)
  ) {
    console.error('[flamechart-to-png] No caller or callee data for selected frame.');
    const errCanvas = createCanvas(400, 100);
    const errCtx = errCanvas.getContext('2d');
    errCtx.font = '16px Arial';
    errCtx.textAlign = 'center';
    errCtx.fillText(`No caller or callee data for "${selectedFrame.name}"`, 200, 50);
    return errCanvas.toBuffer('image/png');
  }

  const finalTheme = composeTheme({
    mode: options.mode,
    flamegraphThemeName: options.flamegraphThemeName,
  });
  const frameToColorBucket = getFrameToColorBucket(mainProfile); // Colors based on main profile

  // --- Layout Calculations ---
  const sidebarWidth = options.sidebarWidth || DEFAULT_SIDEBAR_WIDTH;
  const centralAxisHeight = options.centralAxisHeight || DEFAULT_CENTRAL_AXIS_HEIGHT;
  const overallCanvasWidth = options.width || DEFAULT_WIDTH;
  const flamechartRenderWidth = overallCanvasWidth - sidebarWidth; // Width for flamegraph + its depth axis

  const frameHeightPx = options.frameHeight || DEFAULT_FRAME_HEIGHT;
  const font = options.font || DEFAULT_FONT;

  // Heights for caller and callee sections
  let callerSectionHeight: number;
  let calleeSectionHeight: number;

  const baseFlamechartOptions = {
    // Options to pass to calculateFinalCanvasHeight & calculateRenderRange
    ...options,
    width: flamechartRenderWidth - DEPTH_AXIS_WIDTH_PX, // Width for flamechart bars itself
  };

  if (options.height) {
    // User specified total height, divide it, excluding central axis
    const availableHeightPerSection = Math.max(
      DEFAULT_FRAME_HEIGHT * 3,
      (options.height - centralAxisHeight) / 2
    );
    callerSectionHeight = options.callerHeight ?? availableHeightPerSection;
    calleeSectionHeight = options.calleeHeight ?? availableHeightPerSection;
  } else {
    // Estimate heights dynamically
    const estimateSectionHeight = (profile: Profile | null) => {
      if (!profile) return DEFAULT_FRAME_HEIGHT * 3; // Min height
      const flamechart = new Flamechart({
        getTotalWeight: profile.getTotalWeight.bind(profile),
        forEachCall: profile.forEachCall.bind(profile),
        formatValue: profile.formatValue.bind(profile),
        getColorBucketForFrame: () => 0, // Not used for height calculation
      });
      const numLayers = flamechart.getLayers().slice(options.startDepth ?? 0).length;
      const estimatedContentHeight =
        AXIS_HEIGHT_PX + (numLayers > 0 ? numLayers + 1 : 2) * frameHeightPx;
      // Use calculateFinalCanvasHeight to apply capping logic etc.
      // Cap by width available for flamechart bars, not total render width
      return calculateFinalCanvasHeight(
        undefined,
        flamechartRenderWidth - DEPTH_AXIS_WIDTH_PX,
        estimatedContentHeight,
        AXIS_HEIGHT_PX,
        frameHeightPx
      );
    };
    callerSectionHeight = options.callerHeight ?? estimateSectionHeight(callerProfile);
    calleeSectionHeight = options.calleeHeight ?? estimateSectionHeight(calleeProfile);
  }

  const totalCanvasHeight = callerSectionHeight + centralAxisHeight + calleeSectionHeight;

  // --- Canvas Setup ---
  const canvas = createCanvas(overallCanvasWidth, totalCanvasHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = finalTheme.bgSecondaryColor || finalTheme.bgPrimaryColor; // A slightly different bg for the whole area
  ctx.fillRect(0, 0, overallCanvasWidth, totalCanvasHeight);

  // --- Time Range for Central Axis & Sub-charts ---
  // Use selected frame's actual timing from mainProfile to center the view initially
  // Speedscope converts these to weight units. Here we assume options.startTimeMs etc. will be used by calculateRenderRange
  // For now, we won't enforce a strict common time range on sub-charts via options,
  // but the central axis will be drawn based on the main profile's view of the selected frame.
  // If options.startTimeMs/endTimeMs are given, they will override.
  let commonStartTimeMs = options.startTimeMs;
  let commonEndTimeMs = options.endTimeMs;

  // If not specified, try to use selected frame's duration, converting weight to ms if possible.
  // This is a simplification; Speedscope's calculation is more nuanced based on profile units.
  // For now, let sub-charts determine their own range unless options provide specific ms.

  // Calculate the render range for the central axis first, as it will dictate the grid for caller/callee.
  const centralRenderRange = calculateRenderRange(
    mainProfile, // For unit conversion (ms -> weight) and value formatting.
    selectedFrame.getTotalWeight(), // Scope the axis to this duration.
    flamechartRenderWidth - DEPTH_AXIS_WIDTH_PX, // Width available for the ticks/labels part of axis.
    options // Pass all options, including potential startTimeMs/endTimeMs
    // which will be interpreted relative to selectedFrameTotalWeight by calculateRenderRange.
  );

  // --- Render Caller Flamegraph (Top, Inverted) ---
  if (callerProfile && callerProfile.getTotalWeight() > 0) {
    ctx.save();
    ctx.translate(sidebarWidth, 0); // Translate to top-right of sidebar

    const callerChart = new Flamechart({
      getTotalWeight: callerProfile.getTotalWeight.bind(callerProfile),
      forEachCall: callerProfile.forEachCall.bind(callerProfile),
      formatValue: callerProfile.formatValue.bind(callerProfile),
      getColorBucketForFrame: createGetColorBucketForFrame(frameToColorBucket),
    });
    const callerRenderRange = calculateRenderRange(
      callerProfile,
      callerChart.getTotalWeight(),
      flamechartRenderWidth - DEPTH_AXIS_WIDTH_PX, // width for bars
      { ...options, height: callerSectionHeight } // Pass section-specific height
    );
    const callerMetrics: InternalRenderMetrics = {
      frameHeightPx,
      font,
      totalCanvasWidth: flamechartRenderWidth, // Section width
      finalHeight: callerSectionHeight, // Section height
      flamechartAreaWidth: flamechartRenderWidth - DEPTH_AXIS_WIDTH_PX,
      includeTimeAxisInThisSection: false,
    };
    renderFlamechart({
      profile: callerProfile,
      flamechart: callerChart,
      canvas,
      ctx,
      theme: finalTheme,
      frameToColorBucket,
      startDepth: options.startDepth ?? 0,
      renderRange: callerRenderRange,
      metrics: callerMetrics,
      orientation: 'bottom-up',
      gridRenderRange: centralRenderRange,
    });
    ctx.restore();
  }

  // --- Render Callee Flamegraph (Bottom, Normal) ---
  if (calleeProfile && calleeProfile.getTotalWeight() > 0) {
    ctx.save();
    ctx.translate(sidebarWidth, callerSectionHeight + centralAxisHeight); // Translate below caller and central axis

    const calleeChart = new Flamechart({
      getTotalWeight: calleeProfile.getTotalWeight.bind(calleeProfile),
      forEachCall: calleeProfile.forEachCall.bind(calleeProfile),
      formatValue: calleeProfile.formatValue.bind(calleeProfile),
      getColorBucketForFrame: createGetColorBucketForFrame(frameToColorBucket),
    });
    const calleeRenderRange = calculateRenderRange(
      calleeProfile,
      calleeChart.getTotalWeight(),
      flamechartRenderWidth - DEPTH_AXIS_WIDTH_PX, // width for bars
      { ...options, height: calleeSectionHeight } // Pass section-specific height
    );
    const calleeMetrics: InternalRenderMetrics = {
      frameHeightPx,
      font,
      totalCanvasWidth: flamechartRenderWidth, // Section width
      finalHeight: calleeSectionHeight, // Section height
      flamechartAreaWidth: flamechartRenderWidth - DEPTH_AXIS_WIDTH_PX,
      includeTimeAxisInThisSection: false,
    };
    renderFlamechart({
      profile: calleeProfile,
      flamechart: calleeChart,
      canvas,
      ctx,
      theme: finalTheme,
      frameToColorBucket,
      startDepth: options.startDepth ?? 0,
      renderRange: calleeRenderRange,
      metrics: calleeMetrics,
      orientation: 'top-down',
      gridRenderRange: centralRenderRange,
    });
    ctx.restore();
  }

  // --- Draw Central Time Axis ---
  // This axis should ideally use a combined range or a range focused on the selected frame.
  // We use the mainProfile for formatting and overall timeline context.
  // The xFactor needs to be calculated for flamechartRenderWidth.
  // Let's use the render range of the selected frame in the main profile for the central axis.
  // The total duration this axis should represent is the total weight of the selected frame.
  // const selectedFrameTotalWeight = selectedFrame.getTotalWeight();

  // const centralRenderRange = calculateRenderRange(
  //   mainProfile, // For unit conversion (ms -> weight) and value formatting.
  //   selectedFrameTotalWeight, // Scope the axis to this duration.
  //   flamechartRenderWidth - DEPTH_AXIS_WIDTH_PX, // Width available for the ticks/labels part of axis.
  //   options // Pass all options, including potential startTimeMs/endTimeMs
  //   // which will be interpreted relative to selectedFrameTotalWeight by calculateRenderRange.
  // );

  ctx.save();
  ctx.translate(sidebarWidth, callerSectionHeight); // Position at the start of central axis slot
  drawTimeAxis({
    ctx,
    canvasWidth: flamechartRenderWidth - DEPTH_AXIS_WIDTH_PX, // Width for the actual labels/ticks area
    axisHeight: centralAxisHeight,
    xAxisOffset: DEPTH_AXIS_WIDTH_PX, // Offset to align with content area of caller/callee
    startWeight: centralRenderRange.startWeight,
    endWeight: centralRenderRange.endWeight,
    xFactor: centralRenderRange.xFactor,
    theme: finalTheme,
    formatValue: mainProfile.formatValue.bind(mainProfile),
    flamechartVisibleHeight: 0, // For the central axis, lines are contained within its own height
  });
  ctx.restore();

  // --- Draw Sidebar Labels ---
  ctx.save();
  ctx.font = `bold ${DEFAULT_FONT}`; // Slightly bolder/larger for sidebar
  ctx.fillStyle = finalTheme.fgPrimaryColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Callers Label
  if (callerProfile && callerProfile.getTotalWeight() > 0) {
    ctx.save();
    const callerLabelX = sidebarWidth / 2;
    const callerLabelY = callerSectionHeight / 2;
    ctx.translate(callerLabelX, callerLabelY);
    ctx.rotate(-Math.PI / 2); // Rotate -90 degrees
    ctx.fillText('Callers', 0, 0);
    ctx.restore();
  }

  // Callees Label
  if (calleeProfile && calleeProfile.getTotalWeight() > 0) {
    ctx.save();
    const calleeLabelX = sidebarWidth / 2;
    const calleeLabelY = callerSectionHeight + centralAxisHeight + calleeSectionHeight / 2;
    ctx.translate(calleeLabelX, calleeLabelY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Callees', 0, 0);
    ctx.restore();
  }
  ctx.restore(); // Restore from main save for sidebar

  console.log('[flamechart-to-png] Sandwich flamegraph rendering complete.');
  return canvas.toBuffer('image/png');
}
