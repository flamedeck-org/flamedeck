import type { Profile, ProfileGroup } from '@flamedeck/speedscope-core/profile';
import { Flamechart, type FlamechartDataSource } from '@flamedeck/speedscope-core/flamechart';
import { createCanvas, type CanvasRenderingContext2D } from 'canvas';
import type { FlamegraphThemeName } from '@flamedeck/speedscope-theme/types';
import { getFrameToColorBucket, createGetColorBucketForFrame } from './renderer/color';
import { composeTheme } from './renderer/theme';
import {
  DEFAULT_FRAME_HEIGHT,
  DEFAULT_FONT,
  DEFAULT_WIDTH,
  AXIS_HEIGHT_PX,
  DEPTH_AXIS_WIDTH_PX,
  calculateRenderRange,
  calculateFinalCanvasHeight,
} from './renderer/layout';
import {
  renderFlamechart,
  type InternalRenderOptions,
  type InternalRenderMetrics,
} from './renderer/renderer';

export interface RenderLeftHeavyFlamechartOptions {
  width?: number;
  height?: number;
  frameHeight?: number;
  font?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  mode?: 'light' | 'dark';
  flamegraphThemeName?: FlamegraphThemeName;
  startDepth?: number;
}

/**
 * Renders a left-heavy flamegraph from a ProfileGroup to a PNG buffer.
 *
 * @param profileGroup The ProfileGroup object from @flamedeck/speedscope-core.
 * @param options Optional rendering parameters.
 * @returns A Promise that resolves with a Buffer containing the PNG data.
 */
export async function renderLeftHeavyFlamechart(
  profileGroup: ProfileGroup,
  options: RenderLeftHeavyFlamechartOptions = {}
): Promise<Buffer> {
  if (!profileGroup.profiles || profileGroup.profiles.length === 0) {
    console.error('[flamechart-to-png] Profile group contains no profiles.');
    const errCanvas = createCanvas(300, 100);
    const errCtx = errCanvas.getContext('2d');
    errCtx.font = '16px Arial';
    errCtx.textAlign = 'center';
    errCtx.fillText('Profile group empty.', 150, 50);
    return errCanvas.toBuffer('image/png');
  }

  const activeProfile: Profile =
    profileGroup.profiles[profileGroup.indexToView].getProfileWithRecursionFlattened();

  if (!activeProfile) {
    console.error('[flamechart-to-png] Active profile not found.');
    const errCanvas = createCanvas(300, 100);
    const errCtx = errCanvas.getContext('2d');
    errCtx.font = '16px Arial';
    errCtx.textAlign = 'center';
    errCtx.fillText('Active profile not found.', 150, 50);
    return errCanvas.toBuffer('image/png');
  }

  const finalTheme = composeTheme({
    mode: options.mode,
    flamegraphThemeName: options.flamegraphThemeName,
  });

  console.log(
    `[flamechart-to-png] Rendering profile: ${activeProfile.getName() || 'Unnamed Profile'} using ${options.mode || 'light'} mode` +
      (options.flamegraphThemeName ? ` (${options.flamegraphThemeName} flame theme)` : '')
  );

  const frameToColorBucket = getFrameToColorBucket(activeProfile);
  const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket);

  const flamechartDataSource: FlamechartDataSource = {
    getTotalWeight: activeProfile.getTotalWeight.bind(activeProfile),
    forEachCall: activeProfile.forEachCall.bind(activeProfile),
    formatValue: activeProfile.formatValue.bind(activeProfile),
    getColorBucketForFrame: getColorBucketForFrame,
  };

  const flamechart = new Flamechart(flamechartDataSource);

  let startDepth = options.startDepth !== undefined ? Number(options.startDepth) : 0;
  if (isNaN(startDepth)) {
    console.warn(
      `[flamechart-to-png] Invalid startDepth value provided (${options.startDepth}), defaulting to 0.`
    );
    startDepth = 0;
  }

  const frameHeightPx = options.frameHeight || DEFAULT_FRAME_HEIGHT;
  const font = options.font || DEFAULT_FONT;
  const totalCanvasWidth = options.width || DEFAULT_WIDTH;
  const flamechartAreaWidth = totalCanvasWidth - DEPTH_AXIS_WIDTH_PX;

  const numLayers = flamechart.getLayers().length;
  const estimatedHeightBasedOnFrames =
    AXIS_HEIGHT_PX + (numLayers > 0 ? numLayers + 1 : 2) * frameHeightPx;
  const finalHeight = calculateFinalCanvasHeight(
    options.height,
    flamechartAreaWidth,
    estimatedHeightBasedOnFrames,
    AXIS_HEIGHT_PX,
    frameHeightPx
  );

  const canvas = createCanvas(totalCanvasWidth, finalHeight);
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

  ctx.fillStyle = finalTheme.bgPrimaryColor;
  ctx.fillRect(0, 0, totalCanvasWidth, finalHeight);

  const totalWeight = flamechart.getTotalWeight();

  const renderRange = calculateRenderRange(
    activeProfile,
    totalWeight,
    flamechartAreaWidth,
    options
  );

  const metrics: InternalRenderMetrics = {
    frameHeightPx,
    font,
    totalCanvasWidth,
    finalHeight,
    flamechartAreaWidth,
    includeTimeAxisInThisSection: true,
  };

  const renderOpts: InternalRenderOptions = {
    profile: activeProfile,
    flamechart,
    canvas,
    ctx,
    theme: finalTheme,
    frameToColorBucket,
    startDepth,
    renderRange,
    metrics,
    orientation: 'top-down',
  };

  renderFlamechart(renderOpts);

  console.log('[flamechart-to-png] Flamegraph rendering pass complete. Preparing buffer.');
  return canvas.toBuffer('image/png');
}
