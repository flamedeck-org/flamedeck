#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { renderToPng } from '../dist/index.js';
import { JSON_parse } from 'uint8array-json-parser';
import Long from 'long';
import * as pako from 'pako';

// Removed dynamic import for theme validation

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
  let mode = 'light'; // Default to light mode
  let flamegraphThemeName = undefined; // Default (system)

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1]; // Potential value for the argument

    if (arg === '--start-time-ms' && value !== undefined) {
      startTimeMs = parseFloat(value);
      i++; // Skip the value
    } else if (arg === '--end-time-ms' && value !== undefined) {
      endTimeMs = parseFloat(value);
      i++; // Skip the value
    } else if (arg === '--mode' && value !== undefined) {
      // No validation, just pass through
      mode = value;
      i++; // Skip the value
    } else if (arg === '--flamegraph-theme' && value !== undefined) {
      // No validation, just pass through
      flamegraphThemeName = value;
      i++; // Skip the value
    } else if (!profileFilePath) {
      profileFilePath = path.resolve(arg);
    } else if (!outputFilePath) {
      outputFilePath = arg;
    }
    // If none of the above, it might be a flag without a value or unrecognized
    // We just ignore it in this simple parser
  }

  if (!profileFilePath) {
    console.error(
      'Usage: node packages/flamechart-to-png/dist/test-render.js <path-to-profile-file> [output-path.png] [--start-time-ms <ms>] [--end-time-ms <ms>] [--mode <mode>] [--flamegraph-theme <theme>]'
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

    // Plain JavaScript object for options
    const renderOptions = {
      width: defaultWidth,
      height: defaultHeight,
      mode: mode,
    };

    if (flamegraphThemeName) {
      renderOptions.flamegraphThemeName = flamegraphThemeName;
      console.log(`Using flamegraph theme: ${flamegraphThemeName}`);
    }

    if (startTimeMs !== undefined && !isNaN(startTimeMs)) {
      renderOptions.startTimeMs = startTimeMs;
      console.log(`Using start time: ${startTimeMs}ms`);
    }
    if (endTimeMs !== undefined && !isNaN(endTimeMs)) {
      renderOptions.endTimeMs = endTimeMs;
      console.log(`Using end time: ${endTimeMs}ms`);
    }

    console.log(`Using mode: ${mode}`);

    // Call renderToPng without type assertion
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
