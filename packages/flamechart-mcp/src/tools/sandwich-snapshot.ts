import { z } from 'zod';
import type { FastMCP } from 'fastmcp';
import { loadProfileFromTrace } from '../utils/profile-loader.js';
import {
    renderSandwichFlamechart,
    type RenderSandwichFlamechartOptions,
} from '@flamedeck/flamechart-to-png';
import type { Frame } from '@flamedeck/speedscope-core/profile';
import type { FlamegraphSnapshotResult } from '../types.js';

const sandwichSnapshotSchema = z.object({
    trace: z.string().describe('Absolute local file path or Flamedeck URL'),
    frameName: z
        .string()
        .describe('The exact name of the function/frame to focus the sandwich view on.'),
});

export function addSandwichSnapshotTool(server: FastMCP) {
    server.addTool({
        name: 'generate_sandwich_flamegraph_screenshot',
        description: 'Generates a sandwich flamegraph screenshot (PNG) for a specific function name, showing a flamegraph of both the aggregated callers and callees of that function. The x-axis shows the total aggregated time spent in just this function and its callees, not the total time spent in the entire trace.',
        parameters: sandwichSnapshotSchema,
        execute: async (args): Promise<string> => {
            console.log('[SandwichSnapshotTool] Called with args:', args);

            try {
                const { profileGroup } = await loadProfileFromTrace(args.trace);

                if (!profileGroup) {
                    return JSON.stringify({
                        status: 'error',
                        base64Image: null,
                        publicUrl: null,
                        message: 'Failed to load profile group from trace.',
                    } as FlamegraphSnapshotResult);
                }

                const activeProfile = profileGroup.profiles[profileGroup.indexToView];
                if (!activeProfile) {
                    return JSON.stringify({
                        status: 'error',
                        base64Image: null,
                        publicUrl: null,
                        message: 'Could not get active profile from group.',
                    } as FlamegraphSnapshotResult);
                }

                // Find the target frame
                let targetFrame: Frame | null = null;
                let maxWeight = -1;
                activeProfile.forEachFrame((frame) => {
                    if (frame.name === args.frameName) {
                        const totalWeight = frame.getTotalWeight();
                        if (totalWeight > maxWeight) {
                            maxWeight = totalWeight;
                            targetFrame = frame;
                        }
                    }
                });

                if (!targetFrame) {
                    return JSON.stringify({
                        status: 'error',
                        base64Image: null,
                        publicUrl: null,
                        message: `Frame with name "${args.frameName}" not found.`,
                    } as FlamegraphSnapshotResult);
                }

                console.log(`[SandwichSnapshotTool] Found target frame "${targetFrame.name}"`);

                // Use default rendering options
                const renderOptions: RenderSandwichFlamechartOptions = {};

                console.log(
                    '[SandwichSnapshotTool] Rendering PNG locally with default options for frame:',
                    args.frameName
                );
                const pngBuffer = await renderSandwichFlamechart(activeProfile, targetFrame, renderOptions);

                if (!pngBuffer || pngBuffer.length === 0) {
                    return JSON.stringify({
                        status: 'error',
                        base64Image: null,
                        publicUrl: null,
                        message: 'renderSandwichFlamechart returned empty buffer.',
                    } as FlamegraphSnapshotResult);
                }

                console.log(
                    `[SandwichSnapshotTool] PNG buffer generated, length: ${pngBuffer.length}`
                );

                const base64Image = Buffer.from(pngBuffer).toString('base64');
                const successMsg = `Sandwich flamegraph screenshot generated successfully for function "${args.frameName}".`;
                console.log(`[SandwichSnapshotTool] ${successMsg}`);

                return JSON.stringify({
                    status: 'success',
                    publicUrl: null, // No cloud storage in MCP version
                    base64Image,
                    message: successMsg,
                } as FlamegraphSnapshotResult);
            } catch (toolError: any) {
                const errorMsg = `Exception during sandwich flamechart generation: ${toolError.message || String(toolError)}`;
                console.error('[SandwichSnapshotTool] Unhandled exception:', toolError);
                return JSON.stringify({
                    status: 'error',
                    base64Image: null,
                    publicUrl: null,
                    message: errorMsg,
                } as FlamegraphSnapshotResult);
            }
        },
    });
} 