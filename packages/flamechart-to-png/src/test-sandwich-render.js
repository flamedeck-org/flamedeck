#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { renderSandwichFlamechart } from '../dist/index.js'; // Changed import
import { JSON_parse } from 'uint8array-json-parser';
import Long from 'long';
import * as pako from 'pako';

const importerDeps = {
  inflate: pako.inflate,
  parseJsonUint8Array: JSON_parse,
  isLong: Long.isLong,
};

async function main() {
  console.log('!!!!!!!!!!!! SANDWICH TEST-RENDER SCRIPT STARTED !!!!!!!!!!!!');
  const args = process.argv.slice(2);

  let profileFilePath = null;
  let outputFilePath = null;
  let frameName = null; // New argument for the frame name to search for
  let startTimeMs = undefined;
  let endTimeMs = undefined;
  let mode = 'light';
  let flamegraphThemeName = undefined;
  let width = undefined;
  let height = undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    if (arg === '--frame-name' && value !== undefined) {
      frameName = value;
      i++;
    } else if (arg === '--start-time-ms' && value !== undefined) {
      startTimeMs = parseFloat(value);
      i++;
    } else if (arg === '--end-time-ms' && value !== undefined) {
      endTimeMs = parseFloat(value);
      i++;
    } else if (arg === '--mode' && value !== undefined) {
      mode = value;
      i++;
    } else if (arg === '--flamegraph-theme' && value !== undefined) {
      flamegraphThemeName = value;
      i++;
    } else if (arg === '--width' && value !== undefined) {
      width = parseInt(value, 10);
      i++;
    } else if (arg === '--height' && value !== undefined) {
      height = parseInt(value, 10);
      i++;
    } else if (!profileFilePath) {
      profileFilePath = path.resolve(arg);
    } else if (!outputFilePath) {
      outputFilePath = arg;
    }
  }

  if (!profileFilePath || !frameName) {
    console.error(
      'Usage: node packages/flamechart-to-png/dist/test-sandwich-render.js <path-to-profile-file> --frame-name <name> [output-path.png] [--start-time-ms <ms>] [--end-time-ms <ms>] [--mode <mode>] [--flamegraph-theme <theme>] [--width <px>] [--height <px>]'
    );
    process.exit(1);
  }

  if (!outputFilePath) {
    outputFilePath = `${path.basename(profileFilePath, path.extname(profileFilePath))}-sandwich-${frameName.replace(/[^a-z0-9]/gi, '_')}.png`;
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

    const activeProfile = profileGroup.profiles[profileGroup.indexToView];
    if (!activeProfile) {
      console.error('Could not get active profile from group.');
      process.exit(1);
    }

    // Find the frame with the most total time matching the name
    let targetFrame = null;
    let maxWeight = -1;

    activeProfile.forEachFrame((frame) => {
      if (frame.name === frameName) {
        const totalWeight = frame.getTotalWeight();
        if (totalWeight > maxWeight) {
          maxWeight = totalWeight;
          targetFrame = frame;
        }
      }
    });

    if (!targetFrame) {
      console.error(`Frame with name "${frameName}" not found in the profile.`);
      process.exit(1);
    }

    console.log(
      `Found target frame "${targetFrame.name}" with key ${targetFrame.key} and total weight ${maxWeight}`
    );

    const renderOptions = {
      mode: mode,
      // selectedFrame will be passed directly to renderSandwichFlamechart
    };

    if (width !== undefined) renderOptions.width = width;
    if (height !== undefined) renderOptions.height = height;

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

    const pngBuffer = await renderSandwichFlamechart(activeProfile, targetFrame, renderOptions);

    if (pngBuffer && pngBuffer.length > 0) {
      await fs.writeFile(resolvedOutputFilePath, pngBuffer);
      console.log(`Sandwich flamegraph PNG saved to: ${resolvedOutputFilePath}`);
    } else {
      console.log(
        'renderSandwichFlamechart did not return a PNG buffer (or returned an empty one). Check console for logs.'
      );
    }
    console.log('Test script finished.');
  } catch (error) {
    console.error('Error during sandwich test rendering (inside main try/catch):');
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
