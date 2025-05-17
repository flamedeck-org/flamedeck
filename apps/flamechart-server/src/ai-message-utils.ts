import { BaseMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { type FlamegraphSnapshotToolResponse } from './trace-tools';

/**
 * Creates a HumanMessage with a base64 image if the provided ToolMessage
 * represents a successful screenshot generation.
 *
 * @param toolMessage - The ToolMessage to process.
 * @returns A HumanMessage containing the image and analysis prompt, or null.
 */
export function createImageHumanMessageFromToolResult(
  toolMessage: ToolMessage
): HumanMessage | null {
  if (
    !(
      toolMessage.name === 'generate_flamegraph_screenshot' ||
      toolMessage.name === 'generate_sandwich_flamegraph_screenshot'
    ) ||
    !toolMessage.tool_call_id
  ) {
    return null; // Not a relevant tool message for image extraction
  }

  try {
    const toolOutput = toolMessage.content as unknown as FlamegraphSnapshotToolResponse;
    if (toolOutput.status === 'success' || toolOutput.status === 'success_with_warning') {
      console.log(
        '[Node AI Processor - createImageHumanMessageFromToolResult] Creating HumanMessage with screenshot image.'
      );
      return new HumanMessage({
        content: [
          {
            type: 'text',
            text: `The ${toolMessage.name === 'generate_sandwich_flamegraph_screenshot' ? 'sandwich ' : ''}flamegraph screenshot from tool call ID ${toolMessage.tool_call_id} is provided. Please analyze this image and describe your key observations or findings from it before deciding on the next step.`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${toolOutput.base64Image}` },
          },
        ],
      });
    }
  } catch (e) {
    console.warn(
      '[Node AI Processor - createImageHumanMessageFromToolResult] Error parsing tool_result content:',
      e
    );
  }
  return null;
}
