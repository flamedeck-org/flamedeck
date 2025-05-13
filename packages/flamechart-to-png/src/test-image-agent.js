#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { renderToPng } from '../dist/index.js'; // Assuming renderToPng is exported from dist
import { JSON_parse } from 'uint8array-json-parser';
import Long from 'long';
import * as pako from 'pako';
import { z } from 'zod'; // Added for argument validation

// LangChain and LangGraph related imports
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { StructuredTool } from '@langchain/core/tools';
import { StateGraph, END } from '@langchain/langgraph'; // Corrected import
import { ToolNode } from '@langchain/langgraph/prebuilt'; // Corrected import

/**
 * Formats a template string by removing leading/trailing newlines and unnecessary indentation.
 */
export function formatPrompt(strings, ...values) {
  // Join the strings and values to get the full template string
  const result = strings.reduce(
    (acc, str, i) => acc + str + (values[i] !== undefined ? values[i] : ''),
    ''
  );

  // Find the minimum leading whitespace in the non-empty lines
  const lines = result.split('\n');
  const leadingWhitespace = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0]?.length ?? 0)
  );

  // Remove the leading whitespace
  const trimmedResult = lines.map((line) => line.slice(leadingWhitespace)).join('\n');

  return trimmedResult.replace(/^\n+|\n+$/g, '');
}

function formatPercent(percent) {
  let formattedPercent = `${percent.toFixed(0)}%`;
  if (percent === 100) formattedPercent = '100%';
  else if (percent > 99) formattedPercent = '>99%';
  else if (percent < 0.01) formattedPercent = '<0.01%';
  else if (percent < 1) formattedPercent = `${percent.toFixed(2)}%`;
  else if (percent < 10) formattedPercent = `${percent.toFixed(1)}%`;
  return formattedPercent;
}

const AI_MODEL = 'o4-mini';
const chatModel = new ChatOpenAI({
  modelName: AI_MODEL,
});

// Importer dependencies (similar to test-render.js)
const importerDeps = {
  inflate: pako.inflate,
  parseJsonUint8Array: JSON_parse,
  isLong: Long.isLong,
};

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

const generateFlamegraphScreenshotSchema = z.object({
  startTimeMs: z
    .number()
    .optional()
    .describe('The start time in milliseconds for the section of the flamegraph to render.'),
  endTimeMs: z
    .number()
    .optional()
    .describe('The end time in milliseconds for the section of the flamegraph to render.'),
  mode: z
    .enum(['light', 'dark'])
    .default('light')
    .optional()
    .describe("The color theme mode ('light' or 'dark')."),
  startDepth: z
    .number()
    .int()
    .optional()
    .describe('The starting depth level to render in the flamegraph view (0 is top).'),
});

class GenerateFlamegraphScreenshotTool extends StructuredTool {
  name = 'generate_flamegraph_screenshot';
  description =
    'Generates a PNG screenshot of the flamegraph. Returns a JSON string with the outputPath and a message.';
  schema = generateFlamegraphScreenshotSchema;

  profileGroup;
  outputDir;
  baseFilename;
  analysisState;

  constructor(profileGroup, outputDir, baseFilename, analysisState) {
    super();
    this.profileGroup = profileGroup;
    this.outputDir = outputDir;
    this.baseFilename = baseFilename;
    this.analysisState = analysisState;
  }

  async _call(args) {
    this.analysisState.currentAnalysisStep++;
    console.log(
      `[Tool: Screenshot] AI requested screenshot (step ${this.analysisState.currentAnalysisStep}) with args:`,
      args
    );

    const options = {
      mode: args.mode || 'light',
      startTimeMs: args.startTimeMs,
      endTimeMs: args.endTimeMs,
      startDepth: args.startDepth,
      width: 1200,
      height: 800,
    };

    let filenameSuffix = `step${this.analysisState.currentAnalysisStep}`;
    if (options.startTimeMs !== undefined || options.endTimeMs !== undefined)
      filenameSuffix += `-time_${options.startTimeMs ?? 'start'}-${options.endTimeMs ?? 'end'}`;
    if (options.startDepth !== undefined) filenameSuffix += `-depth_${options.startDepth}`;
    if (options.mode) filenameSuffix += `-${options.mode}`;
    filenameSuffix += '.png';
    const outputPath = path.join(this.outputDir, `${this.baseFilename}-${filenameSuffix}`);

    console.log(`[Tool: Screenshot] Generating with options:`, options, `Output: ${outputPath}`);

    try {
      const pngBuffer = await renderToPng(this.profileGroup, options);
      if (!pngBuffer || pngBuffer.length === 0) {
        console.error('[Tool: Screenshot] Failed to generate PNG buffer.');
        return JSON.stringify({ status: 'Error', error: 'Failed to generate PNG buffer.' });
      }
      await fs.writeFile(outputPath, pngBuffer);
      console.log(`[Tool: Screenshot] Saved to: ${outputPath}.`);

      return JSON.stringify({
        status: 'Success',
        outputPath: outputPath,
        message: `Screenshot (step ${this.analysisState.currentAnalysisStep}, ${path.basename(outputPath)}) generated with options: ${JSON.stringify(options)}. Path provided.`,
      });
    } catch (error) {
      console.error('[Tool: Screenshot] Error generating screenshot:', error);
      return JSON.stringify({ status: 'Error', error: error.message || 'Unknown error' });
    }
  }
}

const getTopFunctionsSchema = z.object({
  sortBy: z.enum(['self', 'total']).describe("Sort functions by 'self' time or 'total' time."),
  count: z
    .number()
    .int()
    .positive()
    .default(10)
    .optional()
    .describe('The maximum number of top functions to return.'),
});

class GetTopFunctionsTool extends StructuredTool {
  name = 'get_top_functions';
  description =
    'Retrieves a list of the top N functions from the loaded trace profile based on their total or self execution time.';
  schema = getTopFunctionsSchema;

  profileGroup;

  constructor(profileGroup) {
    super();
    this.profileGroup = profileGroup;
  }

  async _call(args) {
    console.log(`[Tool: TopFunctions] AI requested top functions with args:`, args);
    if (!this.profileGroup?.profiles?.length) {
      return 'Error: Profile data is missing or invalid for GetTopFunctionsTool.';
    }
    const profile = this.profileGroup.profiles[0];
    const { sortBy, count = 10 } = args;

    try {
      const totalNonIdle = profile.getTotalNonIdleWeight
        ? profile.getTotalNonIdleWeight()
        : profile.getTotalWeight();
      const frameList = [];
      profile.forEachFrame((frame) => frameList.push(frame));
      const allFrames = frameList.filter(
        (f) => f.name !== '[root]' && f.name !== '(speedscope root)'
      );
      allFrames.sort((a, b) =>
        sortBy === 'self'
          ? b.getSelfWeight() - a.getSelfWeight()
          : b.getTotalWeight() - a.getTotalWeight()
      );
      const topN = allFrames.slice(0, count);

      const results = topN.map((frame, index) => {
        const totalWeight = frame.getTotalWeight();
        const selfWeight = frame.getSelfWeight();
        const totalPerc = totalNonIdle === 0 ? 0 : (100.0 * totalWeight) / totalNonIdle;
        const selfPerc = totalNonIdle === 0 ? 0 : (100.0 * selfWeight) / totalNonIdle;
        return `${index + 1}. ${frame.name || '(unknown)'}: Total: ${profile.formatValue(totalWeight)} (${formatPercent(totalPerc)}), Self: ${profile.formatValue(selfWeight)} (${formatPercent(selfPerc)})`;
      });
      const resultString =
        results.length === 0
          ? 'No function data found.'
          : `Top ${results.length} functions by ${sortBy}:\n${results.join('\n')}`;
      console.log(`[Tool: TopFunctions] Success.`);
      return resultString;
    } catch (error) {
      console.error('[Tool: TopFunctions] Error:', error);
      return `Error in GetTopFunctionsTool: ${error.message || 'Unknown error'}`;
    }
  }
}

const INITIAL_PROMPT_TEXT = formatPrompt`
You are a performance analysis assistant. 

- Your goal is to pinpoint areas of high resource consumption or latency. 
- Describe your observations and reasoning for each step. 
- Stop when you have identified a likely bottleneck or after a few investigation steps (max 5 tool uses).

- You can use the 'generate_flamegraph_screenshot' tool to request zoomed-in views or different perspectives. The image will be provided to you IF the tool call is successful.
- You can use the 'get_top_functions' tool to get a list of the top functions by self or total time. 

If you think you have identified a bottleneck, you can stop the analysis and provide a concise summary of your findings, and why you think it's a bottleneck.
The initial flamegraph image is provided below. Start your analysis.
`;

// --- LangGraph Agent Logic ---

async function runAgentWithLangGraph(profileGroup, outputDir) {
  console.log(
    `[Agent] Starting analysis with LangGraph for profile: ${profileGroup.name || 'Unnamed'}`
  );
  const baseFilename = path.basename(
    profileGroup.name || 'profile',
    path.extname(profileGroup.name || 'profile')
  );

  const analysisState = { currentAnalysisStep: 0 };

  const tools = [
    new GenerateFlamegraphScreenshotTool(profileGroup, outputDir, baseFilename, analysisState),
    new GetTopFunctionsTool(profileGroup),
  ];
  const toolNode = new ToolNode(tools);

  const modelWithTools = chatModel.bindTools(tools);

  // Agent node: calls the model. Handles image if previous tool was screenshot.
  async function callModel(state) {
    console.log(`[Graph Agent Node] Calling model. Iteration: ${state.iterationCount}`);
    let messagesToModel = [...state.messages];
    const lastMessage = state.messages[state.messages.length - 1];

    // Check if the last message is a successful screenshot tool call
    if (
      lastMessage instanceof ToolMessage &&
      lastMessage.name === 'generate_flamegraph_screenshot'
    ) {
      try {
        const toolOutput = JSON.parse(lastMessage.content);
        if (toolOutput.status === 'Success' && toolOutput.outputPath) {
          console.log(
            `[Graph Agent Node] Previous tool was screenshot. Encoding image from: ${toolOutput.outputPath}`
          );
          const base64Image = await encodeImageToBase64(toolOutput.outputPath);
          // Add a new user message with the image for the LLM
          // The ToolMessage itself remains as is (textual JSON output)
          messagesToModel.push(
            new HumanMessage({
              content: [
                {
                  type: 'text',
                  text: `Here is the screenshot you requested (${path.basename(toolOutput.outputPath)}). Please analyze it.`,
                },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
              ],
            })
          );
          console.log('[Graph Agent Node] Added HumanMessage with image for LLM.');
        } else {
          console.log(
            '[Graph Agent Node] Screenshot tool reported an error or no outputPath, not adding image.'
          );
        }
      } catch (e) {
        console.error(
          '[Graph Agent Node] Error processing screenshot tool output for image encoding:',
          e
        );
      }
    }

    const response = await modelWithTools.invoke(messagesToModel);
    return { messages: [...state.messages, response] }; // Return original state.messages + new AI response
    // The HumanMessage with image is only for the *current* call to modelWithTools
  }

  const workflow = new StateGraph({
    channels: {
      messages: { value: (x, y) => x.concat(y), default: () => [] },
      iterationCount: { value: (x, y) => x + 1, default: () => 0 },
      maxIterations: { value: (x, y) => y, default: () => 5 }, // Set default here or in initial state
      // Removed static state from graph definition as it's passed in initial state
    },
  });

  workflow.addNode('agent', callModel);
  workflow.addNode('tools', toolNode);
  workflow.setEntryPoint('agent');

  workflow.addConditionalEdges(
    'agent',
    (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return 'tools';
      }
      if (state.iterationCount >= state.maxIterations) {
        console.log('[Graph Router] Max iterations reached.');
        return END;
      }
      if (
        lastMessage.content &&
        typeof lastMessage.content === 'string' &&
        (lastMessage.content.toLowerCase().includes('bottleneck identified') ||
          lastMessage.content.toLowerCase().includes('analysis complete'))
      ) {
        console.log('[Graph Router] AI indicated analysis complete.');
        return END;
      }
      console.log('[Graph Router] No tool calls, AI provided text. Ending iteration or loop.');
      // If no tools called and not explicitly stopping, decide whether to loop or end.
      // Forcing a stop if no tool call after processing to avoid immediate re-loop without change.
      return END;
    },
    {
      tools: 'tools',
      [END]: END,
    }
  );

  workflow.addEdge('tools', 'agent');
  const app = workflow.compile();

  analysisState.currentAnalysisStep++;
  console.log(`[Agent] Generating initial screenshot (step ${analysisState.currentAnalysisStep})`);

  // Use the tool class directly for the initial screenshot
  const initialScreenshotGenTool = new GenerateFlamegraphScreenshotTool(
    profileGroup,
    outputDir,
    baseFilename,
    analysisState
  );
  const initialArgs = { mode: 'light' };
  const initialToolCallOutput = await initialScreenshotGenTool._call(initialArgs); // This returns JSON string

  let initialMessages;
  let initialScreenshotBase64 = null;
  let initialScreenshotText = '(Initial screenshot failed to load or was not generated)';

  try {
    const parsedInitialOutput = JSON.parse(initialToolCallOutput);
    if (parsedInitialOutput.status === 'Success' && parsedInitialOutput.outputPath) {
      initialScreenshotBase64 = await encodeImageToBase64(parsedInitialOutput.outputPath);
      initialScreenshotText =
        parsedInitialOutput.message ||
        `Initial screenshot generated: ${path.basename(parsedInitialOutput.outputPath)}`;
      console.log(`[Agent] Initial screenshot generated: ${parsedInitialOutput.outputPath}`);
    } else {
      console.error(
        '[Agent] Initial screenshot generation reported an error:',
        parsedInitialOutput.error
      );
    }
  } catch (e) {
    console.error('[Agent] Error processing initial screenshot tool output:', e);
  }

  const initialHumanMessageContent = [
    { type: 'text', text: INITIAL_PROMPT_TEXT + '\n' + initialScreenshotText },
  ];
  if (initialScreenshotBase64) {
    initialHumanMessageContent.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${initialScreenshotBase64}` },
    });
  }
  initialMessages = [new HumanMessage({ content: initialHumanMessageContent })];

  console.log('[Agent] Invoking LangGraph app...');
  const initialState = {
    messages: initialMessages,
    // profileGroup, outputDir, baseFilename, currentAnalysisStep are not part of graph state
    // they are passed to tools via their constructor (closure)
    iterationCount: 0,
    maxIterations: 5,
  };

  const finalState = await app.invoke(initialState, { recursionLimit: 25 });

  console.log('\n[Agent] LangGraph execution finished.');
  console.log('[Agent] Final AI Response:');
  const lastAIMessage = finalState.messages.filter((m) => m instanceof AIMessage).pop();
  if (lastAIMessage && lastAIMessage.content) {
    if (typeof lastAIMessage.content === 'string') {
      console.log(lastAIMessage.content);
    } else if (Array.isArray(lastAIMessage.content)) {
      lastAIMessage.content.forEach((part) => {
        if (part.type === 'text') console.log(part.text);
      });
    }
  } else {
    console.log('No final text response from AI, or an error occurred.');
  }
  // console.log('\n[Agent] Full conversation history:', finalState.messages);
}

async function main() {
  const args = process.argv.slice(2);
  const profileFilePath = args[0];
  const outputDir = args[1];

  if (!profileFilePath || !outputDir) {
    console.error(
      'Usage: node packages/flamechart-to-png/src/test-image-agent.js <path-to-profile-file> <output-directory>\n' +
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
    await fs.mkdir(resolvedOutputDir, { recursive: true });
    console.log(`[Main] Loading profile from: ${resolvedProfilePath}`);
    const fileContent = await fs.readFile(resolvedProfilePath, 'utf-8');
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
    console.log(`[Main] Profile "${profileGroup.name || 'Unnamed'}" imported.`);

    await runAgentWithLangGraph(profileGroup, resolvedOutputDir);

    console.log('[Main] Script finished.');
  } catch (error) {
    console.error('[Main] Error during script execution:', error);
    if (error.pregelTaskId) console.error('Pregel Task ID:', error.pregelTaskId);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Main] Unhandled error in main promise chain:', err);
  if (err.pregelTaskId) console.error('Pregel Task ID:', err.pregelTaskId);
  process.exit(1);
});
