import type { Frame, Profile, ProfileGroup } from '@flamedeck/speedscope-core/profile';
import { Flamechart, type FlamechartDataSource } from '@flamedeck/speedscope-core/flamechart';
import { createCanvas, type CanvasRenderingContext2D } from 'canvas';

export interface RenderToPngOptions {
  width?: number;
  height?: number;
  frameHeight?: number;
  font?: string;
  // TODO: Add theme/color options
}

// Simple numeric hash for color bucketing
function getNumericHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Placeholder for getColorBucketForFrame
function getColorBucketForFramePlaceholder(frame: Frame): number {
  // You can make this more sophisticated later, e.g., based on frame.file or keywords
  return getNumericHash(frame.name) % 16; // e.g., 16 color buckets
}

function simpleHashColor(str: string, bucket: number): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  // Incorporate bucket into hue calculation for variety
  const hue = ((Math.abs(hash) % 255) + bucket * 20) % 360;
  return `hsl(${hue}, 70%, 60%)`; // Use HSL for easier color variations
}

function getFrameColor(frame: Frame, colorBucket: number): string {
  if (frame.file && frame.file.includes('node_modules')) {
    return 'hsl(0, 0%, 80%)'; // lightgray
  }
  if (frame.name.startsWith('gc') || frame.name.startsWith('GC')) {
    return 'hsl(39, 100%, 50%)'; // orange
  }
  return simpleHashColor(frame.name, colorBucket);
}

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

  console.log(
    `[flamechart-to-png] Rendering profile: ${activeProfile.getName() || 'Unnamed Profile'}`
  );

  const flamechartDataSource: FlamechartDataSource = {
    getTotalWeight: activeProfile.getTotalWeight.bind(activeProfile),
    forEachCall: activeProfile.forEachCall.bind(activeProfile),
    formatValue: activeProfile.formatValue.bind(activeProfile),
    getColorBucketForFrame: getColorBucketForFramePlaceholder, // Use our placeholder
  };

  const flamechart = new Flamechart(flamechartDataSource);

  const canvasWidth = options.width || 1200;
  const frameHeightPx = options.frameHeight || 18;
  const estimatedCanvasHeight = (flamechart.getLayers().length + 2) * frameHeightPx; // +2 for padding/axis
  const canvasHeight = options.height || Math.max(200, estimatedCanvasHeight);

  const font = options.font || '10px Arial';
  const textPadding = 3;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

  // Set background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const totalWeight = flamechart.getTotalWeight();
  if (totalWeight <= 0) {
    console.warn('[flamechart-to-png] Total weight of the flamechart is 0, nothing to render.');
    // Render a message on the canvas?
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Profile is empty or has zero total weight.', canvasWidth / 2, canvasHeight / 2);
    return canvas.toBuffer('image/png');
  }

  const xFactor = canvasWidth / totalWeight;

  flamechart.getLayers().forEach((layer, layerIndex) => {
    const y = layerIndex * frameHeightPx;
    layer.forEach((frame) => {
      const x = frame.start * xFactor;
      const rectWidth = (frame.end - frame.start) * xFactor;

      if (rectWidth < 0.1) {
        // Skip drawing extremely small rectangles
        return;
      }

      const colorBucket = flamechartDataSource.getColorBucketForFrame(frame.node.frame);
      ctx.fillStyle = getFrameColor(frame.node.frame, colorBucket);
      ctx.fillRect(x, y, rectWidth, frameHeightPx);

      // Draw border for visibility
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, rectWidth, frameHeightPx);

      // Draw text label if there's enough space
      const minWidthForText = 20; // Arbitrary minimum width to attempt drawing text
      if (rectWidth > minWidthForText) {
        ctx.font = font;
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const frameName = frame.node.frame.name;
        const maxTextWidth = rectWidth - 2 * textPadding;
        let displayText = frameName;
        if (ctx.measureText(displayText).width > maxTextWidth) {
          // Simple truncation, could be more sophisticated (e.g., ellipsis middle)
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
          // Final check
          ctx.fillText(displayText, x + textPadding, y + frameHeightPx / 2);
        }
      }
    });
  });

  console.log('[flamechart-to-png] Flamegraph rendering pass complete.');
  return canvas.toBuffer('image/png');
}
