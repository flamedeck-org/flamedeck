import { z } from 'zod';
import type { FastMCP } from 'fastmcp';
import { imageContent, UserError } from 'fastmcp';
import { loadProfileFromTrace } from '../utils/profile-loader.js';
import {
  renderSandwichFlamechart,
  type RenderSandwichFlamechartOptions,
} from '@flamedeck/flamechart-to-png';
import type { Frame } from '@flamedeck/speedscope-core/profile';

const sandwichSnapshotSchema = z.object({
  trace: z.string().describe('Absolute local file path or Flamedeck URL'),
  frameName: z
    .string()
    .describe('The exact name of the function/frame to focus the sandwich view on.'),
});

export function addSandwichSnapshotTool(server: FastMCP) {
  server.addTool({
    name: 'generate_sandwich_flamegraph_screenshot',
    description:
      'Generates a sandwich flamegraph screenshot (PNG) for a specific function name, showing a flamegraph of both the aggregated callers and callees of that function. The x-axis shows the total aggregated time spent in just this function and its callees, not the total time spent in the entire trace.',
    parameters: sandwichSnapshotSchema,
    execute: async (args, { log }) => {
      log.info('SandwichSnapshotTool called', args);

      try {
        const { profileGroup } = await loadProfileFromTrace(args.trace);

        if (!profileGroup) {
          throw new UserError(
            'Failed to load profile group from trace. Please check that the trace file exists and is valid.'
          );
        }

        const activeProfile = profileGroup.profiles[profileGroup.indexToView];
        if (!activeProfile) {
          throw new UserError('Could not get active profile from group.');
        }

        // Validate frame name
        if (!args.frameName || args.frameName.trim().length === 0) {
          throw new UserError('Frame name cannot be empty.');
        }

        // Find the target frame
        let targetFrame: Frame | null = null;
        let maxWeight = -1;
        activeProfile.forEachFrame((frame: Frame) => {
          if (frame.name === args.frameName) {
            const totalWeight = frame.getTotalWeight();
            if (totalWeight > maxWeight) {
              maxWeight = totalWeight;
              targetFrame = frame;
            }
          }
        });

        if (!targetFrame) {
          throw new UserError(
            `Frame with name "${args.frameName}" not found. Please check the function name and try again.`
          );
        }

        log.info('Found target frame', {
          // @ts-expect-error idk why this is never here
          frameName: targetFrame.name,
          weight: maxWeight,
        });

        // Use default rendering options
        const renderOptions: RenderSandwichFlamechartOptions = {};

        log.info('Rendering PNG locally for frame', {
          frameName: args.frameName,
        });
        const pngBuffer = await renderSandwichFlamechart(activeProfile, targetFrame, renderOptions);

        if (!pngBuffer || pngBuffer.length === 0) {
          throw new UserError(
            `Failed to generate sandwich flamegraph for function "${args.frameName}". The rendering process returned an empty result.`
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

        log.error('SandwichSnapshotTool error', {
          error: error instanceof Error ? error.message : String(error),
          trace: args.trace,
          frameName: args.frameName,
        });
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new UserError(`Failed to generate sandwich flamegraph: ${errorMessage}`);
      }
    },
  });
}
