import { Frame, ProfileGroup } from '@flamedeck/speedscope-core/profile';
import { formatPercent } from '@flamedeck/speedscope-core/lib-utils';
import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import type { SupabaseClient } from '@supabase/supabase-js';

// --- Get Top Functions Tool ---
const topFunctionsSchema = z.object({
  sortBy: z.enum(['self', 'total']).default('total').describe("Sort by 'self' or 'total' time."),
  count: z.number().int().positive().default(10).describe('Number of top functions to return.'),
});

export class TopFunctionsTool extends StructuredTool {
  readonly name = 'get_top_functions';
  readonly description =
    'Get a list of the top N functions by self or total time from the performance profile.';
  readonly schema = topFunctionsSchema;

  constructor(private profileData: ProfileGroup | null) {
    super();
  }

  protected async _call(args: z.infer<typeof topFunctionsSchema>): Promise<string> {
    const { sortBy, count } = args;
    console.log(`[Node TopFunctionsTool] Called with sortBy: ${sortBy}, count: ${count}`);

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

      const topN = allFrames.slice(0, count);

      const results = topN.map((frame, index) => {
        const totalWeight = frame.getTotalWeight();
        const selfWeight = frame.getSelfWeight();
        const totalPerc = totalNonIdle === 0 ? 0 : (100.0 * totalWeight) / totalNonIdle;
        const selfPerc = totalNonIdle === 0 ? 0 : (100.0 * selfWeight) / totalNonIdle;
        return (
          `${index + 1}. ${frame.name || '(unknown)'}: ` +
          `Total: ${profile.formatValue(totalWeight)} (${formatPercent(totalPerc)}), ` +
          `Self: ${profile.formatValue(selfWeight)} (${formatPercent(selfPerc)})`
        );
      });

      if (results.length === 0) {
        return 'No function data found in the profile.';
      }

      return `Top ${results.length} functions sorted by ${sortBy} time:\n${results.join('\n')}`;
    } catch (toolError) {
      console.error(`[Node TopFunctionsTool] Error:`, toolError);
      const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
      return `Error executing TopFunctionsTool: ${errorMsg}`;
    }
  }
}

// --- Generate Flamegraph Snapshot Tool ---
const snapshotSchema = z.object({
  viewType: z
    .enum(['time_ordered', 'left_heavy', 'sandwich_caller', 'sandwich_callee'])
    .default('time_ordered')
    .describe(
      "The specific flamegraph view to capture: 'time_ordered', 'left_heavy', 'sandwich_caller', or 'sandwich_callee'."
    ),
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
});

export class GenerateFlamegraphSnapshotTool extends StructuredTool {
  readonly name = 'generate_flamegraph_screenshot';
  readonly description =
    'Generates a flamegraph screenshot (PNG). Returns JSON string with {status, publicUrl, base64Image, message}.';
  readonly schema = snapshotSchema;

  constructor(
    private supabaseAdmin: SupabaseClient,
    private flamechartServerUrl: string, // This will be the URL of the current flamechart-server itself
    private profileArrayBuffer: ArrayBuffer,
    private userId: string,
    private traceId: string
  ) {
    super();
  }

  protected async _call(args: z.infer<typeof snapshotSchema>): Promise<string> {
    console.log('[Node GenerateFlamegraphSnapshotTool] Called with args:', args);

    if (!this.profileArrayBuffer || this.profileArrayBuffer.byteLength === 0) {
      const errorMessage =
        'Error: profileArrayBuffer is missing or empty for GenerateFlamegraphSnapshotTool.';
      console.error(`[Node GenerateFlamegraphSnapshotTool] ${errorMessage}`);
      return JSON.stringify({
        status: 'Error',
        error: errorMessage,
        base64Image: null,
        publicUrl: null,
        message: errorMessage,
      });
    }

    const queryParams = new URLSearchParams();
    queryParams.set('viewType', args.viewType);
    if (args.width) queryParams.set('width', args.width.toString());
    if (args.height) queryParams.set('height', args.height.toString());
    if (args.startTimeMs !== undefined) queryParams.set('startTimeMs', args.startTimeMs.toString());
    if (args.endTimeMs !== undefined) queryParams.set('endTimeMs', args.endTimeMs.toString());
    if (args.startDepth !== undefined) queryParams.set('startDepth', args.startDepth.toString());

    // The /api/v1/render endpoint was recently moved
    const renderUrl = `${this.flamechartServerUrl}/api/v1/render?${queryParams.toString()}`;
    console.log(`[Node GenerateFlamegraphSnapshotTool] Calling flamechart server: ${renderUrl}`);

    try {
      const renderResponse = await fetch(renderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // flamechart-server expects text/plain for the buffer
        body: Buffer.from(this.profileArrayBuffer), // Convert ArrayBuffer to Buffer for Node.js fetch body
      });

      console.log(
        `[Node GenerateFlamegraphSnapshotTool] Render server responded with status: ${renderResponse.status}`
      );

      if (!renderResponse.ok) {
        let errorText = 'Failed to get error text from response.';
        try {
          errorText = await renderResponse.text();
        } catch (textError: any) {
          console.error(
            '[Node GenerateFlamegraphSnapshotTool] Error getting text from error response:',
            textError
          );
          errorText = `Status ${renderResponse.status}, but failed to parse error body: ${textError.message || String(textError)}`;
        }
        const errorMessage = `Error: Failed to render flamechart (status ${renderResponse.status}): ${errorText}`;
        console.error(`[Node GenerateFlamegraphSnapshotTool] ${errorMessage}`);
        return JSON.stringify({
          status: 'Error',
          error: errorMessage,
          base64Image: null,
          publicUrl: null,
          message: errorMessage,
        });
      }

      const pngBuffer = await renderResponse.arrayBuffer();
      if (!pngBuffer || pngBuffer.byteLength === 0) {
        const msg = 'Error: Received empty PNG buffer from flamechart server.';
        console.error('[Node GenerateFlamegraphSnapshotTool]', msg);
        return JSON.stringify({
          status: 'Error',
          error: msg,
          base64Image: null,
          publicUrl: null,
          message: msg,
        });
      }
      console.log(
        `[Node GenerateFlamegraphSnapshotTool] PNG buffer received, length: ${pngBuffer.byteLength}`
      );

      const timestamp = Date.now();
      const storagePath = `ai-snapshots/${this.userId}/trace-${this.traceId}-${timestamp}.png`;
      console.log(`[Node GenerateFlamegraphSnapshotTool] Uploading PNG to storage: ${storagePath}`);

      const { error: uploadError } = await this.supabaseAdmin.storage
        .from('ai-snapshots')
        .upload(storagePath, Buffer.from(pngBuffer), { contentType: 'image/png', upsert: true }); // Convert ArrayBuffer to Buffer for Supabase upload

      if (uploadError) {
        const errorMessage = `Error: Storage upload failed: ${uploadError.message}`;
        console.error(
          '[Node GenerateFlamegraphSnapshotTool] Failed to upload snapshot:',
          uploadError
        );
        return JSON.stringify({
          status: 'Error',
          error: errorMessage,
          base64Image: null,
          publicUrl: null,
          message: errorMessage,
        });
      }

      const { data: publicUrlData } = this.supabaseAdmin.storage
        .from('ai-snapshots')
        .getPublicUrl(storagePath);

      // Use Node.js Buffer for Base64 encoding
      const base64Image = Buffer.from(pngBuffer).toString('base64');

      if (!publicUrlData?.publicUrl) {
        const warningMessage =
          'Warning: Could not get public URL for generated snapshot, but PNG was created and encoded.';
        console.warn(`[Node GenerateFlamegraphSnapshotTool] ${warningMessage}`);
        return JSON.stringify({
          status: 'SuccessWithWarning',
          publicUrl: null,
          base64Image: base64Image,
          message: warningMessage,
          error: 'Failed to get public URL after successful upload.',
        });
      }

      const successMessage = `Snapshot generated. Public URL: ${publicUrlData.publicUrl}. Image data included.`;
      console.log(`[Node GenerateFlamegraphSnapshotTool] ${successMessage}`);

      return JSON.stringify({
        status: 'Success',
        publicUrl: publicUrlData.publicUrl,
        base64Image: base64Image,
        message: successMessage,
      });
    } catch (fetchError: any) {
      const errorMessage = `Error: Exception during flamechart server interaction or subsequent processing: ${fetchError.message || String(fetchError)}`;
      console.error(
        `[Node GenerateFlamegraphSnapshotTool] Unhandled exception in _call:`,
        fetchError
      );
      return JSON.stringify({
        status: 'Error',
        error: errorMessage,
        base64Image: null,
        publicUrl: null,
        message: errorMessage,
      });
    }
  }
}
