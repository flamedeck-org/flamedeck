#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { renderToPng } from '../dist/index.js'; // Assuming renderToPng is exported from dist
import { JSON_parse } from 'uint8array-json-parser';
import Long from 'long';
import * as pako from 'pako';
import { OpenAI } from 'openai'; // Import OpenAI
import { z } from 'zod'; // Added for argument validation

export function formatPercent(percent) {
  let formattedPercent = `${percent.toFixed(0)}%`;
  if (percent === 100) formattedPercent = '100%';
  else if (percent > 99) formattedPercent = '>99%';
  else if (percent < 0.01) formattedPercent = '<0.01%';
  else if (percent < 1) formattedPercent = `${percent.toFixed(2)}%`;
  else if (percent < 10) formattedPercent = `${percent.toFixed(1)}%`;
  return formattedPercent;
}

// --- OpenAI Client Initialization ---
// Ensure OPENAI_API_KEY environment variable is set
const openai = new OpenAI();
const AI_MODEL = 'o4-mini';

// Importer dependencies (similar to test-render.js)
const importerDeps = {
  inflate: pako.inflate,
  parseJsonUint8Array: JSON_parse,
  isLong: Long.isLong,
};

// --- Tool Definition for OpenAI ---
const tools = [
  {
    type: 'function',
    function: {
      name: 'generate_flamegraph_screenshot',
      description:
        'Generates a PNG screenshot of the flamegraph for a specific time range, theme, or depth. Used to visualize different parts or states of the performance profile.',
      parameters: {
        type: 'object',
        properties: {
          // Explicitly define parameters the AI can control
          startTimeMs: {
            type: 'number',
            description:
              'The start time in milliseconds for the section of the flamegraph to render. Optional.',
          },
          endTimeMs: {
            type: 'number',
            description:
              'The end time in milliseconds for the section of the flamegraph to render. Optional.',
          },
          mode: {
            type: 'string',
            enum: ['light', 'dark'],
            description: "The color theme mode ('light' or 'dark'). Optional, defaults to light.",
          },
          startDepth: {
            type: 'integer',
            description:
              'The starting depth level to render in the flamegraph view, with 0 being the top-most layer. Optional, defaults to 0.',
          },
        },
        required: [],
      },
    },
  },
  // --- NEW: get_top_functions Tool Definition ---
  {
    type: 'function',
    function: {
      name: 'get_top_functions',
      description:
        'Retrieves a list of the top N functions from the loaded trace profile based on their total or self execution time. Used to quickly identify computationally expensive functions.',
      parameters: {
        type: 'object',
        properties: {
          sortBy: {
            type: 'string',
            enum: ['self', 'total'],
            description:
              "Sort functions by 'self' time (time spent only in the function) or 'total' time (time spent in the function and its children).",
          },
          count: {
            type: 'integer',
            description: 'The maximum number of top functions to return. Defaults to 10.',
            minimum: 1,
          },
        },
        required: ['sortBy'],
      },
    },
  },
  // --- End NEW Tool ---
];

/**
 * Tool function wrapper to be called by the agent.
 * Handles argument parsing and calls the core renderToPng function.
 */
async function callGenerateFlamegraphScreenshotTool(
  profileGroup,
  outputDir,
  baseFilename,
  step,
  args // Arguments provided by the AI model
) {
  console.log(`[Agent Tool] AI requested screenshot generation with args:`, args);

  // Define defaults or use AI provided values
  const options = {
    mode: args.mode || 'light', // Default to light if not specified by AI
    startTimeMs: args.startTimeMs,
    endTimeMs: args.endTimeMs,
    startDepth: args.startDepth,
    width: 1200, // Keep consistent dimensions for analysis unless specified otherwise
    height: 800,
  };

  // Construct a descriptive filename
  let filenameSuffix = `step${step}`;
  if (options.startTimeMs !== undefined || options.endTimeMs !== undefined) {
    filenameSuffix += `-time_${options.startTimeMs ?? 'start'}-${options.endTimeMs ?? 'end'}`;
  }
  if (options.startDepth !== undefined) {
    filenameSuffix += `-depth_${options.startDepth}`;
  }
  if (options.mode) {
    filenameSuffix += `-${options.mode}`;
  }
  filenameSuffix += '.png';

  const outputPath = path.join(outputDir, `${baseFilename}-${filenameSuffix}`);

  console.log(`[Agent Tool] Generating screenshot with options:`, options);
  console.log(`[Agent Tool] Output path:`, outputPath);

  try {
    const pngBuffer = await renderToPng(profileGroup, options);

    if (pngBuffer && pngBuffer.length > 0) {
      await fs.writeFile(outputPath, pngBuffer);
      console.log(`[Agent Tool] Screenshot saved to: ${outputPath}`);
      // Return the path and potentially other metadata useful for the AI
      return { success: true, outputPath: outputPath, generatedOptions: options };
    } else {
      console.error('[Agent Tool] Failed to generate PNG buffer.');
      return { success: false, error: 'Failed to generate PNG buffer.' };
    }
  } catch (error) {
    console.error('[Agent Tool] Error generating screenshot:', error);
    return { success: false, error: error.message || 'Unknown error during rendering.' };
  }
}

/**
 * Reads an image file and encodes it to base64.
 * @param {string} filePath - Path to the image file.
 * @returns {Promise<string>} Base64 encoded string.
 */
async function encodeImageToBase64(filePath) {
  try {
    const imageBuffer = await fs.readFile(filePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    console.error(`[Agent] Error reading image file for encoding: ${filePath}`, error);
    throw new Error(`Failed to read image file: ${filePath}`);
  }
}

const INITIAL_PROMPT = `You are a performance analysis assistant. Analyze the provided flamegraph screenshot (which shows the entire flamegraph) to identify potential performance bottlenecks. Use the 'generate_flamegraph_screenshot' tool to request zoomed-in views or different perspectives (e.g., different time ranges or depths) to investigate further. You can use the get_top_functions tool to get a list of the top functions by self or total time. Your goal is to pinpoint areas of high resource consumption or latency. Describe your observations and reasoning for each step. Stop when you have identified a likely bottleneck or after a few investigation steps.`;

// --- NEW: get_top_functions Tool Execution Logic ---
const getTopFunctionsArgsSchema = z.object({
  sortBy: z.enum(['self', 'total']),
  count: z.number().int().positive().optional().default(10),
});

/**
 * Tool function wrapper to be called by the agent for get_top_functions.
 * Handles argument parsing and calls the core logic.
 * @param {import('@flamedeck/speedscope-core/dist/profile').ProfileGroup} profileGroup
 * @param {object} args Arguments provided by the AI model
 * @returns {object} Result object with success status and data/error message.
 */
async function callGetTopFunctionsTool(profileGroup, args) {
  console.log(`[Agent Tool] AI requested top functions with args:`, args);

  if (!profileGroup?.profiles?.length) {
    console.error('[Agent Tool getTopFunctions] Profile data is missing or invalid.');
    return { success: false, error: 'Profile data is missing or invalid.' };
  }
  const profile = profileGroup.profiles[0];

  // Validate arguments using Zod
  const parseResult = getTopFunctionsArgsSchema.safeParse(args);
  if (!parseResult.success) {
    const errorMsg = `Invalid arguments provided to get_top_functions: ${parseResult.error.message}`;
    console.error(`[Agent Tool getTopFunctions] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  const { sortBy, count } = parseResult.data;

  try {
    console.log(`[Agent Tool] Calculating top ${count} functions by ${sortBy} time.`);
    const totalNonIdle = profile.getTotalNonIdleWeight();

    // Use forEachFrame to gather frames
    const frameList = [];
    profile.forEachFrame((frame) => {
      frameList.push(frame); // Store all frames initially
    });

    // Filter out the root frame(s) by name
    const allFrames = frameList.filter(
      (frame) => frame.name !== '[root]' && frame.name !== '(speedscope root)'
    );

    // Sort the filtered frames
    allFrames.sort((a, b) => {
      const weightA = sortBy === 'self' ? a.getSelfWeight() : a.getTotalWeight();
      const weightB = sortBy === 'self' ? b.getSelfWeight() : b.getTotalWeight();
      return weightB - weightA; // Sort descending
    });

    // Take top N
    const topN = allFrames.slice(0, count);

    // Format output string
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

    const resultString =
      results.length === 0
        ? 'No function data found matching the criteria.'
        : `Top ${results.length} functions sorted by ${sortBy} time:\n${results.join('\n')}`;

    console.log(`[Agent Tool getTopFunctions] Success.`);
    return { success: true, data: resultString };
  } catch (error) {
    console.error('[Agent Tool getTopFunctions] Error executing:', error);
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown error calculating top functions.';
    return { success: false, error: `Error executing tool: ${errorMsg}` };
  }
}
// --- End NEW Tool Execution Logic ---

/**
 * Main agent logic.
 *
 * @param {import('@flamedeck/speedscope-core/profile').ProfileGroup} profileGroup
 * @param {string} outputDir
 */
async function runAgent(profileGroup, outputDir) {
  console.log(`[Agent] Starting analysis for profile: ${profileGroup.name || 'Unnamed'}`);
  console.log(`[Agent] Output directory: ${outputDir}`);

  const baseFilename = path.basename(
    profileGroup.name || 'profile',
    path.extname(profileGroup.name || 'profile')
  );
  let currentAnalysisStep = 0;
  let conversationHistory = []; // Store messages for OpenAI API

  try {
    // --- Initial Screenshot ---
    currentAnalysisStep++;
    const initialOptions = { mode: 'light' };
    const initialToolResult = await callGenerateFlamegraphScreenshotTool(
      profileGroup,
      outputDir,
      baseFilename,
      currentAnalysisStep,
      initialOptions
    );

    if (!initialToolResult.success || !initialToolResult.outputPath) {
      console.error('[Agent] Failed to generate initial screenshot. Aborting.');
      return;
    }
    const initialScreenshotPath = initialToolResult.outputPath;
    console.log(`[Agent] Initial screenshot generated: ${initialScreenshotPath}`);

    const initialBase64Image = await encodeImageToBase64(initialScreenshotPath);

    // Start the conversation with the initial prompt and image
    conversationHistory.push({
      role: 'user',
      content: [
        { type: 'text', text: INITIAL_PROMPT },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${initialBase64Image}`,
          },
        },
      ],
    });

    console.log(`[Agent] Starting AI interaction loop...`);
    let iterations = 0;
    const maxIterations = 5; // Limit interactions

    while (iterations < maxIterations) {
      console.log(`
[Agent] Iteration ${iterations + 1} / ${maxIterations}`);
      console.log('[Agent] Sending request to OpenAI...');

      try {
        const response = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: conversationHistory,
          tools: tools,
          tool_choice: 'auto', // Let the model decide when to use tools
        });

        const message = response.choices[0].message;
        conversationHistory.push(message); // Add AI response to history

        // Check for tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          console.log('[Agent] AI requested tool call(s):', message.tool_calls);

          // Process tool calls sequentially
          for (const toolCall of message.tool_calls) {
            if (toolCall.function.name === 'generate_flamegraph_screenshot') {
              currentAnalysisStep++;
              const args = JSON.parse(toolCall.function.arguments || '{}');

              const toolResult = await callGenerateFlamegraphScreenshotTool(
                profileGroup,
                outputDir,
                baseFilename,
                currentAnalysisStep,
                args
              );

              let toolResponseContent;
              let nextUserMessageContent = [];

              if (toolResult.success && toolResult.outputPath) {
                // Prepare response for AI and next prompt
                toolResponseContent = JSON.stringify({
                  outputPath: path.basename(toolResult.outputPath),
                  status: 'Success',
                  optionsUsed: toolResult.generatedOptions,
                });
                console.log(`[Agent] Tool success. New screenshot: ${toolResult.outputPath}`);
                // Provide the new image to the AI for the next turn
                const newBase64Image = await encodeImageToBase64(toolResult.outputPath);
                nextUserMessageContent.push({
                  type: 'text',
                  text: `Screenshot generated: ${path.basename(toolResult.outputPath)}. Please analyze this new view.`,
                });
                nextUserMessageContent.push({
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${newBase64Image}` },
                });
              } else {
                // Inform AI about the tool failure
                toolResponseContent = JSON.stringify({ status: 'Error', error: toolResult.error });
                console.error(`[Agent] Tool failed: ${toolResult.error}`);
                // Ask AI how to proceed after failure
                nextUserMessageContent.push({
                  type: 'text',
                  text: `Tool execution failed: ${toolResult.error}. How should we proceed?`,
                });
              }

              // Add tool result message to history
              conversationHistory.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: toolResponseContent,
              });

              // If the tool succeeded and produced an image, we immediately follow up
              // with a user message containing that image.
              // If the tool failed, we ask the AI what to do next.
              if (nextUserMessageContent.length > 0) {
                // We remove the last message (the tool result) temporarily
                // to send the new user message containing the image/question,
                // then add the tool result back before the *next* API call.
                // This feels slightly hacky, maybe there's a better pattern?
                // Let's try adding the user message directly after the tool message.
                conversationHistory.push({
                  role: 'user',
                  content: nextUserMessageContent,
                });
              }
            } else if (toolCall.function.name === 'get_top_functions') {
              // --- NEW: Handle get_top_functions ---
              console.log('[Agent] Handling get_top_functions tool call');
              const args = JSON.parse(toolCall.function.arguments || '{}');
              const toolResult = await callGetTopFunctionsTool(profileGroup, args);

              let toolResponseContent;
              if (toolResult.success) {
                toolResponseContent = JSON.stringify({
                  status: 'Success',
                  data: toolResult.data,
                });
                console.log(`[Agent] Tool get_top_functions success. Result:
${toolResult.data}`);
              } else {
                toolResponseContent = JSON.stringify({
                  status: 'Error',
                  error: toolResult.error,
                });
                console.error(`[Agent] Tool get_top_functions failed: ${toolResult.error}`);
              }

              // Add tool result message to history
              conversationHistory.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: toolResponseContent,
              });

              // Unlike the screenshot tool, we don't necessarily need to send a new user message
              // immediately after getting top functions, unless the AI needs prompting.
              // The AI should respond based on the tool result in the next iteration.

              // --- End NEW Handling ---
            } else {
              console.warn(`[Agent] Received unhandled tool call: ${toolCall.function.name}`);
              // Add a placeholder tool result for unhandled tools
              conversationHistory.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: JSON.stringify({
                  status: 'Error',
                  error: 'Tool not implemented by agent.',
                }),
              });
              // Ask AI to proceed without the unhandled tool
              conversationHistory.push({
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `The tool '${toolCall.function.name}' is not available. Please proceed based on the information you have.`,
                  },
                ],
              });
            }
          }
          // After processing tool calls, continue the loop to get the AI's next response
          iterations++;
          continue; // Go back to the start of the loop to call OpenAI again with updated history
        } else if (message.content) {
          // No tool calls, AI provided a text response
          console.log('[Agent] AI response:', message.content);
          // You might check the content for a stopping condition indicated by the AI
          if (
            message.content.toLowerCase().includes('bottleneck identified') ||
            message.content.toLowerCase().includes('analysis complete')
          ) {
            console.log('[Agent] AI indicated analysis is complete.');
            break;
          }
          // If AI didn't use a tool and didn't stop, maybe prompt it again?
          // Or just end the loop if no tool call is made. For now, let's break.
          console.log('[Agent] AI did not request a tool. Ending interaction.');
          break;
        } else {
          console.log('[Agent] Received response with no content or tool calls. Stopping.');
          break;
        }
      } catch (error) {
        console.error('[Agent] Error calling OpenAI API:', error);
        // Decide how to handle API errors (retry, abort, etc.)
        break; // Stop the loop on API error
      }

      iterations++;
      if (iterations >= maxIterations) {
        console.log('[Agent] Reached max iterations.');
      }

      // Optional delay between iterations
      // await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('[Agent] Analysis loop finished.');
  } catch (error) {
    console.error('[Agent] Error during agent execution:', error);
  }
}

// --- Main Execution ---
async function main() {
  const args = process.argv.slice(2);
  const profileFilePath = args[0];
  const outputDir = args[1];

  if (!profileFilePath || !outputDir) {
    console.error(
      'Usage: node packages/flamechart-to-png/src/performance-agent.js <path-to-profile-file> <output-directory>\n' +
        'Ensure OPENAI_API_KEY environment variable is set.'
    );
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  const resolvedProfilePath = path.resolve(profileFilePath);
  const resolvedOutputDir = path.resolve(outputDir);

  try {
    // Ensure output directory exists
    await fs.mkdir(resolvedOutputDir, { recursive: true });

    console.log(`[Main] Loading profile from: ${resolvedProfilePath}`);
    const fileContent = await fs.readFile(resolvedProfilePath, 'utf-8');

    // Dynamically import the necessary function
    const { importProfileGroupFromText } = await import('@flamedeck/speedscope-import');

    const importResult = await importProfileGroupFromText(
      path.basename(resolvedProfilePath),
      fileContent,
      importerDeps
    );

    const profileGroup = importResult.profileGroup;

    if (!profileGroup) {
      console.error(`[Main] Failed to import profile from ${resolvedProfilePath}.`);
      process.exit(1);
    }

    console.log(
      `[Main] Profile group "${profileGroup.name || 'Unnamed Profile Group'}" imported successfully.`
    );

    // Start the agent logic
    await runAgent(profileGroup, resolvedOutputDir);

    console.log('[Main] Script finished.');
  } catch (error) {
    console.error('[Main] Error during script execution:');
    console.error(error);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace: ', error.stack);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Main] Unhandled error in main promise chain:');
  console.error(err);
  if (err instanceof Error && err.stack) {
    console.error('Stack trace: ', err.stack);
  }
  process.exit(1);
});
