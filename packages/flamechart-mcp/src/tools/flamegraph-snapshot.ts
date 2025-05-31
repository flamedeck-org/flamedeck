import { z } from 'zod';
import type { FastMCP } from 'fastmcp';
import { loadProfileFromTrace } from '../utils/profile-loader.js';
import {
    renderLeftHeavyFlamechart,
    type RenderLeftHeavyFlamechartOptions,
} from '@flamedeck/flamechart-to-png';
import type { FlamegraphSnapshotResult } from '../types.js';

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
        description: 'Generates a flamegraph screenshot (PNG) locally. Returns JSON string with {status, publicUrl, base64Image, message}.',
        parameters: snapshotSchema,
        execute: async (args): Promise<string> => {
            console.log('[FlamegraphSnapshotTool] Called with args:', args);

            try {
                const { profileGroup } = await loadProfileFromTrace(args.trace);

                if (!profileGroup) {
                    const errorMessage = 'Failed to load profile group from trace.';
                    console.error(`[FlamegraphSnapshotTool] ${errorMessage}`);
                    return JSON.stringify({
                        status: 'error',
                        base64Image: null,
                        publicUrl: null,
                        message: errorMessage,
                    } as FlamegraphSnapshotResult);
                }

                console.log(
                    `[FlamegraphSnapshotTool] Profile group "${profileGroup.name || 'Unnamed'}" loaded.`
                );

                // Prepare render options from tool arguments
                const renderOptions: RenderLeftHeavyFlamechartOptions = {};
                if (args.width) renderOptions.width = args.width;
                if (args.height) renderOptions.height = args.height;
                if (args.startTimeMs !== undefined) renderOptions.startTimeMs = args.startTimeMs;
                if (args.endTimeMs !== undefined) renderOptions.endTimeMs = args.endTimeMs;
                if (args.startDepth !== undefined) renderOptions.startDepth = args.startDepth;
                if (args.mode) renderOptions.mode = args.mode;

                console.log(
                    '[FlamegraphSnapshotTool] Rendering PNG locally with options:',
                    renderOptions
                );
                const pngBuffer = await renderLeftHeavyFlamechart(profileGroup, renderOptions);

                if (!pngBuffer || pngBuffer.length === 0) {
                    const renderError = 'renderLeftHeavyFlamechart returned empty buffer.';
                    console.error('[FlamegraphSnapshotTool]', renderError);
                    return JSON.stringify({
                        status: 'error',
                        base64Image: null,
                        publicUrl: null,
                        message: renderError,
                    } as FlamegraphSnapshotResult);
                }

                console.log(
                    `[FlamegraphSnapshotTool] PNG buffer generated locally, length: ${pngBuffer.length}`
                );

                const base64Image = Buffer.from(pngBuffer).toString('base64');
                const successMessage = `Flamegraph screenshot generated successfully. Image data included as base64.`;
                console.log(`[FlamegraphSnapshotTool] ${successMessage}`);

                return JSON.stringify({
                    status: 'success',
                    publicUrl: null, // No cloud storage in MCP version
                    base64Image: base64Image,
                    message: successMessage,
                } as FlamegraphSnapshotResult);
            } catch (toolError: any) {
                const errorMessage = `Error: Exception during flamechart generation: ${toolError.message || String(toolError)}`;
                console.error(`[FlamegraphSnapshotTool] Unhandled exception:`, toolError);
                return JSON.stringify({
                    status: 'error',
                    base64Image: null,
                    publicUrl: null,
                    message: errorMessage,
                } as FlamegraphSnapshotResult);
            }
        },
    });
} 