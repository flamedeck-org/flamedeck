import { z } from 'zod';
import type { FastMCP } from 'fastmcp';
import { imageContent, UserError } from 'fastmcp';
import { loadProfileFromTrace } from '../utils/profile-loader.js';
import {
  renderLeftHeavyFlamechart,
  type RenderLeftHeavyFlamechartOptions,
} from '@flamedeck/flamechart-to-png';

const snapshotSchema = z.object({
  trace: z.string().describe('Absolute local file path or Flamedeck URL'),
  width: z
    .number()
    .int()
    .optional()
    .default(1200)
    .describe('Width of the flamegraph image in pixels.'),
  height: z
    .number()
    .int()
    .optional()
    .default(800)
    .describe('Height of the flamegraph image in pixels.'),
  startTimeMs: z.number().optional().describe('Start time in milliseconds for a zoomed view.'),
  endTimeMs: z.number().optional().describe('End time in milliseconds for a zoomed view.'),
  startDepth: z.number().int().optional().describe('Start depth for a zoomed view (stack depth).'),
  mode: z.enum(['light', 'dark']).optional().default('light').describe('Color mode for the theme.'),
});

export function addFlamegraphSnapshotTool(server: FastMCP) {
  server.addTool({
    name: 'generate_flamegraph_screenshot',
    description: 'Generates a flamegraph screenshot (PNG) and returns it as an image.',
    parameters: snapshotSchema,
    execute: async (args, { log }) => {
      log.info('FlamegraphSnapshotTool called', args);

      try {
        const { profileGroup } = await loadProfileFromTrace(args.trace);

        if (!profileGroup) {
          throw new UserError(
            'Failed to load profile group from trace. Please check that the trace file exists and is valid.'
          );
        }

        log.info('Profile group loaded', {
          profileName: profileGroup.name || 'Unnamed',
        });

        // Validate dimensions
        if (args.width && (args.width < 100 || args.width > 4000)) {
          throw new UserError('Width must be between 100 and 4000 pixels.');
        }
        if (args.height && (args.height < 100 || args.height > 4000)) {
          throw new UserError('Height must be between 100 and 4000 pixels.');
        }

        // Prepare render options from tool arguments
        const renderOptions: RenderLeftHeavyFlamechartOptions = {};
        if (args.width) renderOptions.width = args.width;
        if (args.height) renderOptions.height = args.height;
        if (args.startTimeMs !== undefined) renderOptions.startTimeMs = args.startTimeMs;
        if (args.endTimeMs !== undefined) renderOptions.endTimeMs = args.endTimeMs;
        if (args.startDepth !== undefined) renderOptions.startDepth = args.startDepth;
        if (args.mode) renderOptions.mode = args.mode;

        log.info('Rendering PNG locally', {
          width: renderOptions.width,
          height: renderOptions.height,
          startTimeMs: renderOptions.startTimeMs,
          endTimeMs: renderOptions.endTimeMs,
          startDepth: renderOptions.startDepth,
          mode: renderOptions.mode,
        });
        const pngBuffer = await renderLeftHeavyFlamechart(profileGroup, renderOptions);

        if (!pngBuffer || pngBuffer.length === 0) {
          throw new UserError(
            'Failed to generate flamegraph image. The rendering process returned an empty result.'
          );
        }

        log.info('PNG buffer generated', {
          bufferLength: pngBuffer.length,
        });

        // Return the image using FastMCP's imageContent
        return imageContent({
          buffer: pngBuffer,
        });
      } catch (error) {
        if (error instanceof UserError) {
          throw error; // Re-throw UserError as-is
        }

        log.error('FlamegraphSnapshotTool error', {
          error: error instanceof Error ? error.message : String(error),
          trace: args.trace,
        });
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new UserError(`Failed to generate flamegraph: ${errorMessage}`);
      }
    },
  });
}
