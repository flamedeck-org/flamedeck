// Imports now relative to process-ai-turn folder
import { Frame, ProfileGroup } from '../../../packages/speedscope-core/src/profile.ts';
import { formatPercent } from '../../../packages/speedscope-core/src/lib-utils.ts';
import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding/base64';

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
    console.log(`[TopFunctionsTool] Called with sortBy: ${sortBy}, count: ${count}`);

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
        : profile.getTotalWeight(); // Fallback if getTotalNonIdleWeight is not present

      const frameList: Frame[] = [];
      profile.forEachFrame((frame: Frame) => {
        // Explicitly type frame
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
      console.error(`[TopFunctionsTool] Error:`, toolError);
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
    private flamechartServerUrl: string,
    private profileArrayBuffer: ArrayBuffer,
    private userId: string,
    private traceId: string
  ) {
    super();
  }

  protected async _call(args: z.infer<typeof snapshotSchema>): Promise<string> {
    console.log('[GenerateFlamegraphSnapshotTool] Called with args:', args);

    if (!this.profileArrayBuffer || this.profileArrayBuffer.byteLength === 0) {
      const errorMessage = 'Error: profileArrayBuffer is missing or empty.';
      console.error(`[GenerateFlamegraphSnapshotTool] ${errorMessage}`);
      return JSON.stringify({ status: 'Error', error: errorMessage });
    }

    const queryParams = new URLSearchParams();
    queryParams.set('viewType', args.viewType);
    if (args.width) queryParams.set('width', args.width.toString());
    if (args.height) queryParams.set('height', args.height.toString());
    if (args.startTimeMs !== undefined) queryParams.set('startTimeMs', args.startTimeMs.toString());
    if (args.endTimeMs !== undefined) queryParams.set('endTimeMs', args.endTimeMs.toString());
    if (args.startDepth !== undefined) queryParams.set('startDepth', args.startDepth.toString());

    const renderUrl = `${this.flamechartServerUrl}/render?${queryParams.toString()}`;
    console.log(`[GenerateFlamegraphSnapshotTool] Calling flamechart server: ${renderUrl}`);

    try {
      const renderResponse = await fetch(renderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: this.profileArrayBuffer,
      });

      if (!renderResponse.ok) {
        const errorText = await renderResponse.text();
        const errorMessage = `Error: Failed to render flamechart (status ${renderResponse.status}): ${errorText}`;
        console.error(`[GenerateFlamegraphSnapshotTool] ${errorMessage}`);
        return JSON.stringify({ status: 'Error', error: errorMessage });
      }

      const pngBuffer = await renderResponse.arrayBuffer();
      if (!pngBuffer || pngBuffer.byteLength === 0) {
        const msg = 'Error: Received empty PNG buffer from flamechart server.';
        console.error('[GenerateFlamegraphSnapshotTool]', msg);
        return JSON.stringify({ status: 'Error', error: msg });
      }
      console.log(
        `[GenerateFlamegraphSnapshotTool] PNG buffer received, length: ${pngBuffer.byteLength}`
      );

      const timestamp = Date.now();
      const storagePath = `ai-snapshots/${this.userId}/trace-${this.traceId}-${timestamp}.png`;
      console.log(`[GenerateFlamegraphSnapshotTool] Uploading PNG to storage: ${storagePath}`);

      const { error: uploadError } = await this.supabaseAdmin.storage
        .from('ai-snapshots')
        .upload(storagePath, pngBuffer, { contentType: 'image/png', upsert: true });

      if (uploadError) {
        const errorMessage = `Error: Storage upload failed: ${uploadError.message}`;
        console.error('[GenerateFlamegraphSnapshotTool] Failed to upload snapshot:', uploadError);
        return JSON.stringify({ status: 'Error', error: errorMessage });
      }

      const { data: publicUrlData } = this.supabaseAdmin.storage
        .from('ai-snapshots')
        .getPublicUrl(storagePath);

      if (!publicUrlData?.publicUrl) {
        const errorMessage = 'Error: Could not get public URL for generated snapshot.';
        console.error('[GenerateFlamegraphSnapshotTool] Failed to get public URL.');
        const base64Image = encodeBase64(pngBuffer);
        return JSON.stringify({
          status: 'SuccessWithWarning',
          publicUrl: null,
          base64Image: base64Image,
          message: `Snapshot generated and base64 encoded, but failed to get public URL. ${errorMessage}`,
          error: errorMessage,
        });
      }

      const base64Image = encodeBase64(pngBuffer);
      const successMessage = `Snapshot generated. Public URL: ${publicUrlData.publicUrl}. Image data included.`;
      console.log(`[GenerateFlamegraphSnapshotTool] ${successMessage}`);

      return JSON.stringify({
        status: 'Success',
        publicUrl: publicUrlData.publicUrl,
        base64Image: base64Image,
        message: successMessage,
      });
    } catch (fetchError) {
      const errorMessage = `Error: Exception during flamechart server call: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
      console.error(`[GenerateFlamegraphSnapshotTool] ${errorMessage}`);
      return JSON.stringify({ status: 'Error', error: errorMessage });
    }
  }
}
