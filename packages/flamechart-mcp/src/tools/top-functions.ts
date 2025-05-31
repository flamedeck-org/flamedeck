import { z } from 'zod';
import type { FastMCP } from 'fastmcp';
import { loadProfileFromTrace } from '../utils/profile-loader.js';
import type { Frame } from '@flamedeck/speedscope-core/profile';
import { formatPercent } from '@flamedeck/speedscope-core/lib-utils';

const topFunctionsSchema = z.object({
    trace: z.string().describe('Absolute local file path or Flamedeck URL'),
    sortBy: z.enum(['self', 'total']).default('total').describe("Sort by 'self' or 'total' time."),
    offset: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .default(0)
        .describe('0-indexed offset for the starting function in the sorted list.'),
    limit: z
        .number()
        .int()
        .positive()
        .optional()
        .default(15)
        .describe('Number of functions to return, starting from the offset.'),
});

export function addTopFunctionsTool(server: FastMCP) {
    server.addTool({
        name: 'get_top_functions',
        description: 'Get top functions by performance metrics from a trace file or Flamedeck URL - you can offset the start with `offset` and limit the number with `limit`',
        parameters: topFunctionsSchema,
        execute: async (args) => {
            const { trace, sortBy, offset, limit } = args;
            console.log(
                `[TopFunctionsTool] Called with trace: ${trace}, sortBy: ${sortBy}, offset: ${offset}, limit: ${limit}`
            );

            try {
                const { profileGroup } = await loadProfileFromTrace(trace);

                if (!profileGroup || !profileGroup.profiles || profileGroup.profiles.length === 0) {
                    return 'Error: Profile data is not loaded or is empty.';
                }

                const profile = profileGroup.profiles[0];
                if (!profile) {
                    return 'Error: No profile found in the profile group.';
                }

                const totalNonIdle = profile.getTotalNonIdleWeight
                    ? profile.getTotalNonIdleWeight()
                    : profile.getTotalWeight();

                const frameList: Frame[] = [];
                profile.forEachFrame((frame: Frame) => {
                    frameList.push(frame);
                });

                const allFrames = frameList.filter(
                    (frame) => frame.name !== '[root]' && frame.name !== '(speedscope root)'
                );

                allFrames.sort((a, b) => {
                    const weightA = sortBy === 'self' ? a.getSelfWeight() : a.getTotalWeight();
                    const weightB = sortBy === 'self' ? b.getSelfWeight() : b.getTotalWeight();
                    return weightB - weightA;
                });

                const topN = allFrames.slice(offset, offset + limit);

                const results = topN.map((frame, index) => {
                    const totalWeight = frame.getTotalWeight();
                    const selfWeight = frame.getSelfWeight();
                    const totalPerc = totalNonIdle === 0 ? 0 : (100.0 * totalWeight) / totalNonIdle;
                    const selfPerc = totalNonIdle === 0 ? 0 : (100.0 * selfWeight) / totalNonIdle;
                    return (
                        `${offset + index + 1}. ${frame.name || '(unknown)'}: ` +
                        `Total: ${profile.formatValue(totalWeight)} (${formatPercent(totalPerc)}), ` +
                        `Self: ${profile.formatValue(selfWeight)} (${formatPercent(selfPerc)})`
                    );
                });

                if (results.length === 0) {
                    return 'No function data found in the profile for the specified range.';
                }

                return `Displaying functions ${offset + 1} to ${offset + results.length} (sorted by ${sortBy} time):\n${results.join('\n')}`;
            } catch (error) {
                console.error(`[TopFunctionsTool] Error:`, error);
                const errorMsg = error instanceof Error ? error.message : String(error);
                return `Error executing TopFunctionsTool: ${errorMsg}`;
            }
        },
    });
} 