import express, { Request, Response } from 'express';
import { renderToPng, RenderToPngOptions } from '@flamedeck/flamechart-to-png';
import { importProfileGroupFromText } from '@flamedeck/speedscope-import';
import type { FlamegraphThemeName } from '@flamedeck/speedscope-theme/types';
import pako from 'pako';
import Long from 'long';
import { JSON_parse } from 'uint8array-json-parser';

const app = express();
const port = process.env.PORT || 3000;

const importerDeps = {
  inflate: pako.inflate,
  parseJsonUint8Array: JSON_parse,
  isLong: Long.isLong,
};

// Middleware to parse text/plain request bodies
app.use(express.text({ type: 'text/plain', limit: '10mb' })); // Adjust limit as needed

app.post('/render', async (req: Request, res: Response) => {
  console.log('Received /render request');
  try {
    const profileText = req.body;
    if (typeof profileText !== 'string' || profileText.length === 0) {
      return res.status(400).send('Request body must contain profile data as plain text.');
    }

    console.log(`Profile text received, length: ${profileText.length}`);

    // Extract options from query parameters
    const {
      width,
      height,
      startTimeMs,
      endTimeMs,
      mode,
      flamegraphThemeName,
      startDepth: startDepthStr,
    } = req.query;

    const renderOptions: RenderToPngOptions = {};

    // Parse options (no height restriction here)
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
      'uploaded-profile', // filename placeholder
      profileText,
      importerDeps
    );

    const profileGroup = importResult.profileGroup;

    if (!profileGroup) {
      console.error('Failed to import profile group.');
      return res.status(500).send('Failed to import profile group.');
    }
    console.log(`Profile group "${profileGroup.name || 'Unnamed'}" imported successfully.`);

    console.log('Rendering PNG with options:', renderOptions);
    const pngBuffer = await renderToPng(profileGroup, renderOptions);

    if (!pngBuffer || pngBuffer.length === 0) {
      console.error('renderToPng returned empty buffer.');
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

app.get('/', (req: Request, res: Response) => {
  res.send(
    'Flamechart Server is running. POST to /render with profile data in text/plain body to generate a PNG.'
  );
});

app.listen(port, () => {
  console.log(`Flamechart server listening on port ${port}`);
});
