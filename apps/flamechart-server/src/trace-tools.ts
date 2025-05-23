import { Frame, ProfileGroup } from '@flamedeck/speedscope-core/profile';
import { formatPercent } from '@flamedeck/speedscope-core/lib-utils';
import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import type { SupabaseClient } from '@supabase/supabase-js';

// Imports needed for direct rendering logic
import {
  renderLeftHeavyFlamechart,
  type RenderLeftHeavyFlamechartOptions,
  renderSandwichFlamechart,
  type RenderSandwichFlamechartOptions,
} from '@flamedeck/flamechart-to-png';
import {
  importProfileGroupFromText,
  type ImporterDependencies,
} from '@flamedeck/speedscope-import';
import pako from 'pako';
import Long from 'long';
import { JSON_parse } from 'uint8array-json-parser';

// --- Get Top Functions Tool ---
const topFunctionsSchema = z.object({
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

export class TopFunctionsTool extends StructuredTool {
  readonly name = 'get_top_functions';
  readonly description =
    'Get a list of the top N functions by self or total time from the performance profile - you can offset the start with `offset` and limit the number with `limit`';
  readonly schema = topFunctionsSchema;

  constructor(private profileData: ProfileGroup | null) {
    super();
  }

  protected async _call(args: z.infer<typeof topFunctionsSchema>): Promise<string> {
    const { sortBy, offset, limit } = args;
    console.log(
      `[Node TopFunctionsTool] Called with sortBy: ${sortBy}, offset: ${offset}, limit: ${limit}`
    );

    if (!this.profileData || !this.profileData.profiles || this.profileData.profiles.length === 0) {
      return 'Error: Profile data is not loaded or is empty.';
    }

    const profile = this.profileData.profiles[0];
    if (!profile) {
      return 'Error: No profile found in the profile group.';
    }

    try {
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
    } catch (toolError) {
      console.error(`[Node TopFunctionsTool] Error:`, toolError);
      const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
      return `Error executing TopFunctionsTool: ${errorMsg}`;
    }
  }
}

// --- Generate Flamegraph Snapshot Tool ---
const snapshotSchema = z.object({
  // viewType is not directly used by renderToPng, but influences options for it often.
  // We keep width, height, startTimeMs, endTimeMs, startDepth as primary renderOptions.
  // theme is also an option for renderToPng
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

const importerDeps: ImporterDependencies = {
  inflate: pako.inflate,
  parseJsonUint8Array: JSON_parse,
  LongType: Long,
};

export type FlamegraphSnapshotToolResponse = {
  status: 'success' | 'error' | 'success_with_warning';
  publicUrl: string | null;
  base64Image: string | null;
  message: string;
};

export class GenerateFlamegraphSnapshotTool extends StructuredTool {
  readonly name = 'generate_flamegraph_screenshot';
  readonly description =
    'Generates a flamegraph screenshot (PNG) locally. Returns JSON string with {status, publicUrl, base64Image, message}.';
  readonly schema = snapshotSchema;

  constructor(
    private supabaseAdmin: SupabaseClient,
    private profileArrayBuffer: ArrayBuffer, // This is the raw buffer, possibly gzipped
    private userId: string,
    private traceId: string
  ) {
    super();
  }

  protected async _call(
    args: z.infer<typeof snapshotSchema>
  ): Promise<FlamegraphSnapshotToolResponse> {
    console.log('[Node GenerateFlamegraphSnapshotTool - Local Render] Called with args:', args);

    if (!this.profileArrayBuffer || this.profileArrayBuffer.byteLength === 0) {
      const errorMessage =
        'Error: profileArrayBuffer is missing or empty for GenerateFlamegraphSnapshotTool.';
      console.error(`[Node GenerateFlamegraphSnapshotTool] ${errorMessage}`);
      return {
        status: 'error',
        base64Image: null,
        publicUrl: null,
        message: errorMessage,
      };
    }

    try {
      let profileJsonText: string;
      const bodyBuffer = new Uint8Array(this.profileArrayBuffer);

      // Check for gzip magic bytes (0x1f, 0x8b)
      if (bodyBuffer.length > 2 && bodyBuffer[0] === 0x1f && bodyBuffer[1] === 0x8b) {
        console.log('[Node GenerateFlamegraphSnapshotTool] Detected gzipped input. Inflating...');
        try {
          profileJsonText = pako.inflate(bodyBuffer, { to: 'string' });
        } catch (e: any) {
          const inflateError = `Invalid gzipped data: ${e.message}`;
          console.error(
            '[Node GenerateFlamegraphSnapshotTool] Failed to decompress gzipped input:',
            e
          );
          return {
            status: 'error',
            base64Image: null,
            publicUrl: null,
            message: inflateError,
          };
        }
      } else {
        console.log(
          '[Node GenerateFlamegraphSnapshotTool] Input is not gzipped. Assuming plain text UTF-8.'
        );
        profileJsonText = Buffer.from(bodyBuffer).toString('utf-8'); // Use Buffer for robust conversion
      }

      if (profileJsonText.length === 0) {
        const emptyError = 'Processed profile data is empty.';
        console.error('[Node GenerateFlamegraphSnapshotTool]', emptyError);
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: emptyError,
        };
      }

      console.log('[Node GenerateFlamegraphSnapshotTool] Importing profile group from text...');
      const importResult = await importProfileGroupFromText(
        `trace-${this.traceId}-snapshot`, // filename placeholder
        profileJsonText,
        importerDeps
      );

      const profileGroup = importResult?.profileGroup;

      if (!profileGroup) {
        const importError = 'Failed to import profile group from processed data.';
        console.error('[Node GenerateFlamegraphSnapshotTool]', importError);
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: importError,
        };
      }
      console.log(
        `[Node GenerateFlamegraphSnapshotTool] Profile group "${profileGroup.name || 'Unnamed'}" imported.`
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
        '[Node GenerateFlamegraphSnapshotTool] Rendering PNG locally with options:',
        renderOptions
      );
      const pngBuffer = await renderLeftHeavyFlamechart(profileGroup, renderOptions);

      if (!pngBuffer || pngBuffer.length === 0) {
        const renderError = 'renderToPng returned empty buffer.';
        console.error('[Node GenerateFlamegraphSnapshotTool]', renderError);
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: renderError,
        };
      }
      console.log(
        `[Node GenerateFlamegraphSnapshotTool] PNG buffer generated locally, length: ${pngBuffer.length}`
      );

      const timestamp = Date.now();
      const storagePath = `${this.userId}/trace-${this.traceId}-${timestamp}.png`;
      console.log(`[Node GenerateFlamegraphSnapshotTool] Uploading PNG to storage: ${storagePath}`);

      const { error: uploadError } = await this.supabaseAdmin.storage
        .from('ai-snapshots')
        .upload(storagePath, pngBuffer, { contentType: 'image/png', upsert: true }); // renderToPng returns Buffer directly

      if (uploadError) {
        const storageErrorMessage = `Error: Storage upload failed: ${uploadError.message}`;
        console.error(
          '[Node GenerateFlamegraphSnapshotTool] Failed to upload snapshot:',
          uploadError
        );
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: storageErrorMessage,
        };
      }

      const { data: publicUrlData } = this.supabaseAdmin.storage
        .from('ai-snapshots')
        .getPublicUrl(storagePath);

      const base64Image = Buffer.from(pngBuffer).toString('base64');

      if (!publicUrlData?.publicUrl) {
        const warningMessage =
          'Warning: Could not get public URL for generated snapshot, but PNG was created and encoded.';
        console.warn(`[Node GenerateFlamegraphSnapshotTool] ${warningMessage}`);
        return {
          status: 'success_with_warning',
          publicUrl: null,
          base64Image: base64Image,
          message: warningMessage,
        };
      }

      const successMessage = `Snapshot generated. Public URL: ${publicUrlData.publicUrl}. Image data included.`;
      console.log(`[Node GenerateFlamegraphSnapshotTool] ${successMessage}`);

      return {
        status: 'success',
        publicUrl: publicUrlData.publicUrl,
        base64Image: base64Image,
        message: successMessage,
      };
    } catch (toolError: any) {
      const errorMessage = `Error: Exception during local flamechart generation or Supabase interaction: ${toolError.message || String(toolError)}`;
      console.error(
        `[Node GenerateFlamegraphSnapshotTool] Unhandled exception in _call:`,
        toolError
      );
      return {
        status: 'error',
        base64Image: null,
        publicUrl: null,
        message: errorMessage,
      };
    }
  }
}

// --- Generate Sandwich Flamegraph Snapshot Tool ---
const sandwichSnapshotSchema = z.object({
  frameName: z
    .string()
    .describe('The exact name of the function/frame to focus the sandwich view on.'),
});

export class GenerateSandwichSnapshotTool extends StructuredTool {
  readonly name = 'generate_sandwich_flamegraph_screenshot';
  readonly description =
    'Generates a sandwich flamegraph screenshot (PNG) for a specific function name, showing a flamegraph of both the aggregated callers and callees of that function. The x-axis shows the total aggregated time spent in just this function and its callees, not the total time spent in the entire trace.';
  readonly schema = sandwichSnapshotSchema;

  constructor(
    private supabaseAdmin: SupabaseClient,
    private profileArrayBuffer: ArrayBuffer,
    private userId: string,
    private traceId: string
  ) {
    super();
  }

  protected async _call(
    args: z.infer<typeof sandwichSnapshotSchema>
  ): Promise<FlamegraphSnapshotToolResponse> {
    console.log('[Node GenerateSandwichSnapshotTool - Local Render] Called with args:', args);

    if (!this.profileArrayBuffer || this.profileArrayBuffer.byteLength === 0) {
      const errorMessage = 'Error: profileArrayBuffer is missing or empty.';
      console.error(`[Node GenerateSandwichSnapshotTool] ${errorMessage}`);
      return { status: 'error', base64Image: null, publicUrl: null, message: errorMessage };
    }

    try {
      let profileJsonText: string;
      const bodyBuffer = new Uint8Array(this.profileArrayBuffer);
      if (bodyBuffer.length > 2 && bodyBuffer[0] === 0x1f && bodyBuffer[1] === 0x8b) {
        try {
          profileJsonText = pako.inflate(bodyBuffer, { to: 'string' });
        } catch (e: any) {
          return {
            status: 'error',
            base64Image: null,
            publicUrl: null,
            message: `Invalid gzipped data: ${e.message}`,
          };
        }
      } else {
        profileJsonText = Buffer.from(bodyBuffer).toString('utf-8');
      }

      if (profileJsonText.length === 0) {
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: 'Processed profile data is empty.',
        };
      }

      const importResult = await importProfileGroupFromText(
        `trace-${this.traceId}-sandwich-snapshot`,
        profileJsonText,
        importerDeps
      );
      const profileGroup = importResult?.profileGroup;
      if (!profileGroup) {
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: 'Failed to import profile group.',
        };
      }

      const activeProfile = profileGroup.profiles[profileGroup.indexToView];
      if (!activeProfile) {
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: 'Could not get active profile from group.',
        };
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
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: `Frame with name "${args.frameName}" not found.`,
        };
      }
      console.log(`[Node GenerateSandwichSnapshotTool] Found target frame "${targetFrame.name}"`);

      // All optional rendering parameters are removed.
      // renderSandwichFlamechart will use its defaults.
      const renderOptions: RenderSandwichFlamechartOptions = {};

      console.log(
        '[Node GenerateSandwichSnapshotTool] Rendering PNG locally with default options for frame:',
        args.frameName
      );
      const pngBuffer = await renderSandwichFlamechart(activeProfile, targetFrame, renderOptions);

      if (!pngBuffer || pngBuffer.length === 0) {
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: 'renderSandwichFlamechart returned empty buffer.',
        };
      }
      console.log(
        `[Node GenerateSandwichSnapshotTool] PNG buffer generated, length: ${pngBuffer.length}`
      );

      const timestamp = Date.now();
      const storagePath = `${this.userId}/trace-${this.traceId}-sandwich-${args.frameName.replace(/[^a-z0-9]/gi, '_')}-${timestamp}.png`;
      const { error: uploadError } = await this.supabaseAdmin.storage
        .from('ai-snapshots')
        .upload(storagePath, pngBuffer, { contentType: 'image/png', upsert: true });

      if (uploadError) {
        return {
          status: 'error',
          base64Image: null,
          publicUrl: null,
          message: `Storage upload failed: ${uploadError.message}`,
        };
      }

      const { data: publicUrlData } = this.supabaseAdmin.storage
        .from('ai-snapshots')
        .getPublicUrl(storagePath);
      const base64Image = Buffer.from(pngBuffer).toString('base64');

      if (!publicUrlData?.publicUrl) {
        const warnMsg = 'Warning: Could not get public URL, but PNG was created.';
        console.warn(`[Node GenerateSandwichSnapshotTool] ${warnMsg}`);
        return { status: 'success_with_warning', publicUrl: null, base64Image, message: warnMsg };
      }

      const successMsg = `Sandwich snapshot generated. Public URL: ${publicUrlData.publicUrl}.`;
      console.log(`[Node GenerateSandwichSnapshotTool] ${successMsg}`);
      return {
        status: 'success',
        publicUrl: publicUrlData.publicUrl,
        base64Image,
        message: successMsg,
      };
    } catch (toolError: any) {
      const errorMsg = `Exception: ${toolError.message || String(toolError)}`;
      console.error('[Node GenerateSandwichSnapshotTool] Unhandled exception:', toolError);
      return { status: 'error', base64Image: null, publicUrl: null, message: errorMsg };
    }
  }
}
