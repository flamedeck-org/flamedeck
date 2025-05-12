// Imports now relative to process-ai-turn folder
import { Frame, ProfileGroup } from '../../../packages/speedscope-core/src/profile.ts';
import { formatPercent } from '../../../packages/speedscope-import/src/index.ts';
import { z } from 'https://esm.sh/zod@3.23.8';

// --- Tool Schema for OpenAI ---
export const getTopFunctionsToolSchema = {
  type: 'function' as const,
  function: {
    name: 'get_top_functions',
    description:
      'Retrieves a list of the top N functions from the loaded trace profile based on their execution time...',
    parameters: {
      type: 'object' as const,
      properties: {
        sortBy: { type: 'string' as const, enum: ['self', 'total'] /*...*/ },
        count: { type: 'number' as const /*...*/ },
      },
      required: ['sortBy'],
    },
  },
};

// --- Tool Schema: Get Snapshot ---
export const getSnapshotToolSchema = {
  type: 'function' as const,
  function: {
    name: 'get_flamegraph_snapshot',
    description:
      'Captures and returns a real-time visual snapshot of the flamegraph from the currently loaded trace. Use this whenever a user asks to see or visualize the flamegraph, or when you need to analyze the visual structure of the profile. The snapshot will be returned as an image that you can then analyze and describe to the user.',
    parameters: {
      type: 'object' as const,
      properties: {
        viewType: {
          type: 'string' as const,
          enum: ['time_ordered', 'left_heavy', 'sandwich_caller', 'sandwich_callee'],
          description:
            "The specific flamegraph view to capture: 'time_ordered' (chronological view), 'left_heavy' (aggregated by call frequency), 'sandwich_caller' (who calls a function), or 'sandwich_callee' (who a function calls).",
        },
        // Optional: Add frame identifier if needed for sandwich view
        // frameIdentifier: {
        //   type: "string" as const,
        //   description: "The name or key of the frame required for 'sandwich_caller' or 'sandwich_callee' views."
        // }
      },
      required: ['viewType'],
    },
  },
};

// --- Tool Execution Logic ---
const toolArgsSchema = z.object({
  sortBy: z.enum(['self', 'total']),
  count: z.number().int().positive().optional().default(10),
});

export function executeGetTopFunctions(profileGroup: ProfileGroup | null, args: unknown): string {
  if (!profileGroup?.profiles?.length) {
    return 'Error: Profile data is missing or invalid.';
  }
  const profile = profileGroup.profiles[0];

  const parseResult = toolArgsSchema.safeParse(args);
  if (!parseResult.success) {
    console.error('[Tool executeGetTopFunctions] Invalid arguments:', parseResult.error);
    return `Error: Invalid arguments provided to tool: ${parseResult.error.message}`;
  }
  const { sortBy, count } = parseResult.data;

  try {
    console.log(`[Tool] Calculating top ${count} functions by ${sortBy} time.`);
    const totalNonIdle = profile.getTotalNonIdleWeight();

    // Use forEachFrame to gather frames
    const frameList: Frame[] = [];
    profile.forEachFrame((frame) => {
      // Store all frames initially
      frameList.push(frame);
    });

    // Filter out the root frame(s) by name
    const allFrames = frameList.filter(
      (frame) => frame.name !== '[root]' && frame.name !== '(speedscope root)'
    );

    // Sort the filtered frames
    allFrames.sort((a, b) => {
      const weightA = sortBy === 'self' ? a.getSelfWeight() : a.getTotalWeight();
      const weightB = sortBy === 'self' ? b.getSelfWeight() : b.getTotalWeight();
      // Sort descending (highest weight first)
      return weightB - weightA;
    });

    // Take top N (or fewer if not enough frames)
    const topN = allFrames.slice(0, count);

    // Format output string
    const results = topN.map((frame, index) => {
      const totalWeight = frame.getTotalWeight();
      const selfWeight = frame.getSelfWeight();
      // Handle division by zero if totalNonIdle is 0
      const totalPerc = totalNonIdle === 0 ? 0 : (100.0 * totalWeight) / totalNonIdle;
      const selfPerc = totalNonIdle === 0 ? 0 : (100.0 * selfWeight) / totalNonIdle;
      return (
        `${index + 1}. ${frame.name || '(unknown)'}: ` +
        `Total: ${profile.formatValue(totalWeight)} (${formatPercent(totalPerc)}), ` +
        `Self: ${profile.formatValue(selfWeight)} (${formatPercent(selfPerc)})`
      );
    });

    if (results.length === 0) {
      return 'No function data found in the profile.'; // Explicit return
    }

    // Explicit return of formatted results
    return `Top ${results.length} functions sorted by ${sortBy} time:\n${results.join('\n')}`;
  } catch (toolError) {
    console.error(`[Tool executeGetTopFunctions] Error:`, toolError);
    // Explicit return on error
    return `Error executing tool: ${toolError.message}`;
  }
}
