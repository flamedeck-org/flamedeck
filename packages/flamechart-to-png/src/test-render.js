#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { renderToPng } from '../dist/index.js';
import { JSON_parse } from 'uint8array-json-parser';
import Long from 'long';
import * as pako from 'pako';

const importerDeps = {
  inflate: pako.inflate,
  parseJsonUint8Array: JSON_parse,
  isLong: Long.isLong,
};

async function main() {
  console.log('!!!!!!!!!!!! FULL TEST-RENDER.TS SCRIPT STARTED !!!!!!!!!!!!');
  const args = process.argv.slice(2);

  // Simple argument parsing
  let profileFilePath = null;
  let outputFilePath = null;
  let startTimeMs = undefined;
  let endTimeMs = undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-time-ms' && i + 1 < args.length) {
      startTimeMs = parseFloat(args[i + 1]);
      i++; // Skip the value
    } else if (args[i] === '--end-time-ms' && i + 1 < args.length) {
      endTimeMs = parseFloat(args[i + 1]);
      i++; // Skip the value
    } else if (!profileFilePath) {
      profileFilePath = path.resolve(args[i]);
    } else if (!outputFilePath) {
      outputFilePath = args[i];
    }
  }

  if (!profileFilePath) {
    console.error(
      'Usage: ts-node packages/flamechart-to-png/src/test-render.ts <path-to-profile-file> [output-path.png] [--start-time-ms <ms>] [--end-time-ms <ms>]'
    );
    process.exit(1);
  }

  if (!outputFilePath) {
    outputFilePath = `${path.basename(profileFilePath, path.extname(profileFilePath))}-flamechart.png`;
  }
  const resolvedOutputFilePath = path.resolve(outputFilePath);

  try {
    console.log(`Loading profile from: ${profileFilePath}`);
    const fileContent = await fs.readFile(profileFilePath, 'utf-8');

    // Dynamically import the actual function from speedscope-import
    const { importProfileGroupFromText } = await import('@flamedeck/speedscope-import');

    const importResult = await importProfileGroupFromText(
      path.basename(profileFilePath),
      fileContent,
      importerDeps
    );

    const profileGroup = importResult.profileGroup;

    if (!profileGroup) {
      console.error(`Failed to import profile from ${profileFilePath}.`);
      process.exit(1);
    }

    console.log(
      `Profile group "${profileGroup.name || 'Unnamed Profile Group'}" imported successfully.`
    );

    const defaultWidth = 1200;
    const defaultHeight = 800;

    const renderOptions = {
      width: defaultWidth,
      height: defaultHeight,
    };

    if (startTimeMs !== undefined && !isNaN(startTimeMs)) {
      renderOptions.startTimeMs = startTimeMs;
      console.log(`Using start time: ${startTimeMs}ms`);
    }
    if (endTimeMs !== undefined && !isNaN(endTimeMs)) {
      renderOptions.endTimeMs = endTimeMs;
      console.log(`Using end time: ${endTimeMs}ms`);
    }

    const pngBuffer = await renderToPng(profileGroup, renderOptions);

    if (pngBuffer && pngBuffer.length > 0) {
      await fs.writeFile(resolvedOutputFilePath, pngBuffer);
      console.log(`Flamegraph PNG saved to: ${resolvedOutputFilePath}`);
    } else {
      console.log(
        'renderToPng did not return a PNG buffer (or returned an empty one). Check console for logs.'
      );
    }
    console.log('Test script finished.');
  } catch (error) {
    console.error('Error during test rendering (inside main try/catch):');
    console.error(error);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:\n', error.stack);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in main promise chain (main().catch):');
  console.error(err);
  if (err instanceof Error && err.stack) {
    console.error('Stack trace:\n', err.stack);
  }
  process.exit(1);
});
