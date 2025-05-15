import './instrument';
import 'dotenv/config'; // Ensure environment variables are loaded

import express, { Request, Response } from 'express';
import {
  renderLeftHeavyFlamechart,
  type RenderLeftHeavyFlamechartOptions,
  renderSandwichFlamechart,
  type RenderSandwichFlamechartOptions,
} from '@flamedeck/flamechart-to-png';
import { importProfileGroupFromText } from '@flamedeck/speedscope-import';
import type { Frame } from '@flamedeck/speedscope-core/profile';
import type { FlamegraphThemeName } from '@flamedeck/speedscope-theme/types';
import pako from 'pako';
import Long from 'long';
import { JSON_parse } from 'uint8array-json-parser';

import { processAiTurnLogic, ProcessAiTurnPayload } from './ai-processor'; // Import the AI processing logic

const app = express();
const port = process.env.PORT || 3000;

const importerDeps = {
  inflate: pako.inflate,
  parseJsonUint8Array: JSON_parse,
  LongType: Long,
};

// Middleware to parse text/plain request bodies for /api/v1/render
app.use('/api/v1/render', express.raw({ type: 'text/plain', limit: '10mb' }));
// Middleware to parse text/plain request bodies for /api/v1/render-sandwich
app.use('/api/v1/render-sandwich', express.raw({ type: 'text/plain', limit: '10mb' }));
// Middleware to parse JSON request bodies for /api/v1/ai/process-turn
app.use('/api/v1/ai/process-turn', express.json({ limit: '1mb' })); // Use express.json for this route

app.post('/api/v1/render', async (req: Request, res: Response) => {
  console.log('Received /api/v1/render request');
  try {
    const bodyBuffer = req.body as Buffer;

    if (!(bodyBuffer instanceof Buffer) || bodyBuffer.length === 0) {
      return res.status(400).send('Request body must contain profile data and cannot be empty.');
    }

    console.log(`Raw body buffer received, length: ${bodyBuffer.length}`);

    let profileJsonText: string;

    if (bodyBuffer.length > 2 && bodyBuffer[0] === 0x1f && bodyBuffer[1] === 0x8b) {
      console.log('Detected gzipped input. Inflating...');
      try {
        profileJsonText = pako.inflate(bodyBuffer, { to: 'string' });
      } catch (e: any) {
        console.error('Failed to decompress gzipped input:', e);
        return res.status(400).send(`Invalid gzipped data: ${e.message}`);
      }
    } else {
      console.log('Input is not gzipped or too short. Assuming plain text UTF-8.');
      profileJsonText = bodyBuffer.toString('utf-8');
    }

    if (profileJsonText.length === 0) {
      return res.status(400).send('Processed profile data is empty.');
    }

    console.log(
      `First 100 chars of processed profile JSON text: ${profileJsonText.substring(0, 100)}`
    );

    const {
      width,
      height,
      startTimeMs,
      endTimeMs,
      mode,
      flamegraphThemeName,
      startDepth: startDepthStr,
    } = req.query;

    const renderOptions: RenderLeftHeavyFlamechartOptions = {};

    if (width && !isNaN(parseInt(width as string))) {
      renderOptions.width = parseInt(width as string);
    }
    if (height && !isNaN(parseInt(height as string))) {
      renderOptions.height = parseInt(height as string);
    }
    if (startTimeMs && !isNaN(parseFloat(startTimeMs as string))) {
      renderOptions.startTimeMs = parseFloat(startTimeMs as string);
    }
    if (endTimeMs && !isNaN(parseFloat(endTimeMs as string))) {
      renderOptions.endTimeMs = parseFloat(endTimeMs as string);
    }
    if (mode === 'light' || mode === 'dark') {
      renderOptions.mode = mode;
    }
    if (flamegraphThemeName) {
      const validThemes: FlamegraphThemeName[] = ['system', 'fire', 'peach', 'ice'];
      if (validThemes.includes(flamegraphThemeName as FlamegraphThemeName)) {
        renderOptions.flamegraphThemeName = flamegraphThemeName as FlamegraphThemeName;
      } else {
        console.warn(`Invalid flamegraphThemeName: ${flamegraphThemeName}, using default.`);
      }
    }
    if (startDepthStr && !isNaN(parseInt(startDepthStr as string))) {
      renderOptions.startDepth = parseInt(startDepthStr as string);
    }

    console.log('Importing profile...');
    const importResult = await importProfileGroupFromText(
      'uploaded-profile',
      profileJsonText,
      importerDeps
    );

    const profileGroup = importResult.profileGroup;

    if (!profileGroup) {
      console.error('Failed to import profile group.');
      return res.status(500).send('Failed to import profile group.');
    }
    console.log(`Profile group "${profileGroup.name || 'Unnamed'}" imported successfully.`);

    console.log('Rendering PNG with options:', renderOptions);
    const pngBuffer = await renderLeftHeavyFlamechart(profileGroup, renderOptions);

    if (!pngBuffer || pngBuffer.length === 0) {
      console.error('renderLeftHeavyFlamechart returned empty buffer.');
      return res.status(500).send('Failed to render flamechart: empty buffer.');
    }

    console.log(`PNG buffer generated, length: ${pngBuffer.length}. Sending response...`);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length.toString());
    res.send(pngBuffer);
    console.log('Response sent.');
  } catch (error) {
    console.error('Error during flamechart rendering:', error);
    if (error instanceof Error) {
      res.status(500).send(`Error rendering flamechart: ${error.message}`);
    } else {
      res.status(500).send('An unknown error occurred during flamechart rendering.');
    }
  }
});

app.post('/api/v1/render-sandwich', async (req: Request, res: Response) => {
  console.log('Received /api/v1/render-sandwich request');
  try {
    const bodyBuffer = req.body as Buffer;
    if (!(bodyBuffer instanceof Buffer) || bodyBuffer.length === 0) {
      return res.status(400).send('Request body must contain profile data and cannot be empty.');
    }

    let profileJsonText: string;
    if (bodyBuffer.length > 2 && bodyBuffer[0] === 0x1f && bodyBuffer[1] === 0x8b) {
      try {
        profileJsonText = pako.inflate(bodyBuffer, { to: 'string' });
      } catch (e: any) {
        return res.status(400).send(`Invalid gzipped data: ${e.message}`);
      }
    } else {
      profileJsonText = bodyBuffer.toString('utf-8');
    }

    if (profileJsonText.length === 0) {
      return res.status(400).send('Processed profile data is empty.');
    }

    const { frameName, ...queryParams } = req.query;

    if (!frameName || typeof frameName !== 'string') {
      return res.status(400).send('Query parameter "frameName" is required.');
    }

    const renderOptions: RenderSandwichFlamechartOptions = {};
    const {
      width,
      height,
      startTimeMs,
      endTimeMs,
      mode,
      flamegraphThemeName,
      startDepth,
      sidebarWidth,
      centralAxisHeight,
      callerHeight,
      calleeHeight,
    } = queryParams;

    if (width && !isNaN(parseInt(width as string))) renderOptions.width = parseInt(width as string);
    if (height && !isNaN(parseInt(height as string)))
      renderOptions.height = parseInt(height as string);
    if (startTimeMs && !isNaN(parseFloat(startTimeMs as string)))
      renderOptions.startTimeMs = parseFloat(startTimeMs as string);
    if (endTimeMs && !isNaN(parseFloat(endTimeMs as string)))
      renderOptions.endTimeMs = parseFloat(endTimeMs as string);
    if (mode === 'light' || mode === 'dark') renderOptions.mode = mode;
    if (flamegraphThemeName) {
      const validThemes: FlamegraphThemeName[] = ['system', 'fire', 'peach', 'ice']; // Ensure this list is accurate
      if (validThemes.includes(flamegraphThemeName as FlamegraphThemeName)) {
        renderOptions.flamegraphThemeName = flamegraphThemeName as FlamegraphThemeName;
      }
    }
    if (startDepth && !isNaN(parseInt(startDepth as string)))
      renderOptions.startDepth = parseInt(startDepth as string);
    if (sidebarWidth && !isNaN(parseInt(sidebarWidth as string)))
      renderOptions.sidebarWidth = parseInt(sidebarWidth as string);
    if (centralAxisHeight && !isNaN(parseInt(centralAxisHeight as string)))
      renderOptions.centralAxisHeight = parseInt(centralAxisHeight as string);
    if (callerHeight && !isNaN(parseInt(callerHeight as string)))
      renderOptions.callerHeight = parseInt(callerHeight as string);
    if (calleeHeight && !isNaN(parseInt(calleeHeight as string)))
      renderOptions.calleeHeight = parseInt(calleeHeight as string);

    console.log('Importing profile for sandwich view...');
    const importResult = await importProfileGroupFromText(
      'sandwich-profile',
      profileJsonText,
      importerDeps
    );
    const profileGroup = importResult.profileGroup;

    if (!profileGroup || profileGroup.profiles.length === 0) {
      return res.status(500).send('Failed to import profile group or profile group is empty.');
    }
    const activeProfile = profileGroup.profiles[profileGroup.indexToView];
    if (!activeProfile) {
      return res.status(500).send('Could not get active profile from group.');
    }

    let targetFrame: Frame | null = null;
    let maxWeight = -1;
    activeProfile.forEachFrame((frame: Frame) => {
      if (frame.name === frameName) {
        const totalWeight = frame.getTotalWeight();
        if (totalWeight > maxWeight) {
          maxWeight = totalWeight;
          targetFrame = frame;
        }
      }
    });

    if (!targetFrame) {
      return res.status(404).send(`Frame with name "${frameName}" not found.`);
    }

    console.log(
      `Rendering sandwich PNG for frame "${targetFrame.name}" with options:`,
      renderOptions
    );
    const pngBuffer = await renderSandwichFlamechart(activeProfile, targetFrame, renderOptions);

    if (!pngBuffer || pngBuffer.length === 0) {
      return res.status(500).send('Failed to render sandwich flamechart: empty buffer.');
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length.toString());
    res.send(pngBuffer);
    console.log('Sandwich flamechart response sent.');
  } catch (error) {
    console.error('Error during sandwich flamechart rendering:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    res.status(500).send(`Error rendering sandwich flamechart: ${errorMessage}`);
  }
});

app.post('/api/v1/ai/process-turn', async (req: Request, res: Response) => {
  console.log('[Express] Received /api/v1/ai/process-turn request');
  const internalAuthToken = req.headers['x-internal-auth-token'] as string | undefined;
  const expectedSecret = process.env.PROCESS_AI_TURN_SECRET;

  if (internalAuthToken !== expectedSecret) {
    console.warn(
      '[Express] Unauthorized attempt to access /api/v1/ai/process-turn. Secrets do not match.'
    );
    return res.status(401).send('Unauthorized');
  }

  try {
    const { userId, prompt, traceId, sessionId } = req.body as ProcessAiTurnPayload;

    if (!userId || !prompt || !traceId || !sessionId) {
      console.warn(
        '[Express] Missing required fields for /api/v1/ai/process-turn. Expected userId, prompt, traceId, sessionId. Body:',
        req.body
      );
      return res
        .status(400)
        .json({ error: 'Missing required fields: userId, prompt, traceId, sessionId' });
    }

    const payload: ProcessAiTurnPayload = { userId, prompt, traceId, sessionId };
    console.log(
      `[Express] AI turn processing task accepted for userId: ${userId}, traceId: ${traceId}, sessionId: ${sessionId}`
    );

    res.status(202).json({ success: true, message: 'AI processing task accepted.' });

    processAiTurnLogic(payload).catch((error) => {
      console.error(
        `[Express /api/v1/ai/process-turn] Critical asynchronous error after HTTP response sent for userId ${payload.userId}, traceId ${payload.traceId}, sessionId: ${payload.sessionId}:`,
        error
      );
    });
  } catch (error) {
    console.error('[Express /api/v1/ai/process-turn] Synchronous error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown server error occurred.';
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error during AI processing initiation.',
        details: errorMessage,
      });
    }
  }
});

app.get('/', (req: Request, res: Response) => {
  res.send(
    'Flamechart Server is running. POST to /api/v1/render with profile data in text/plain body to generate a PNG. POST to /api/v1/ai/process-turn for AI trace analysis.'
  );
});

app.listen(port, () => {
  console.log(`Flamechart server listening on port ${port}`);
});
