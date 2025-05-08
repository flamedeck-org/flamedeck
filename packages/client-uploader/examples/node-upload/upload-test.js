import { uploadTraceToApi } from '@flamedeck/upload'; // Assuming UploadError and UploadOptions are not strictly needed for a basic JS test run
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM-friendly way to get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure FLAMEDECK_API_KEY is set in your environment
const apiKey = process.env.FLAMEDECK_API_KEY;
const dummyTracePath = path.join(__dirname, 'dummy-trace.json');

async function runNodeUploadTestJs() {
  console.log('[JS Test] Script started...');

  if (!apiKey) {
    console.error('[JS Test] Error: FLAMEDECK_API_KEY environment variable is not set.');
    console.error('[JS Test] Please set it before running the test script:');
    console.error('[JS Test] export FLAMEDECK_API_KEY="your_actual_api_key_here"');
    process.exit(1);
  }

  try {
    console.log(`[JS Test] Reading dummy trace file from: ${dummyTracePath}`);
    const traceDataBuffer = await fs.readFile(dummyTracePath);
    const fileName = path.basename(dummyTracePath);

    // Not using UploadOptions type here, just creating the object literal
    const options = {
      apiKey: apiKey,
      traceData: traceDataBuffer,
      fileName: fileName,
      scenario: 'Node.js PLAIN JS Test Script Upload',
      commitSha: 'testcommitjs123',
      branch: 'test-branch-js',
      notes: 'This trace was uploaded by the @flamedeck/upload PLAIN JS test script from Node.js.',
      public: false,
    };

    console.log(`[JS Test] Attempting to upload '${fileName}' for scenario '${options.scenario}'...`);
    const result = await uploadTraceToApi(options);

    console.log('\n[JS Test] --- Upload Successful! ---');
    console.log(`[JS Test] Trace ID: ${result.id}`);
    console.log(`[JS Test] View URL: ${result.viewUrl}`);
    console.log('[JS Test] ------------------------\n');

  } catch (error) {
    console.error('\n[JS Test] --- Upload Failed ---');
    // Basic error logging for JS, as instanceof UploadError might not work if types aren't perfectly aligned or if it's not exported/imported
    console.error('[JS Test] Error message:', error.message);
    if (error.status) {
        console.error('[JS Test] Status:', error.status);
    }
    if (error.details) {
        console.error('[JS Test] Details:', error.details);
    }
    console.error('[JS Test] Full error object:', error);
    console.log('[JS Test] ---------------------\n');
    process.exit(1);
  }
}

runNodeUploadTestJs()
  .then(() => {
    console.log('[JS Test] Test script finished.');
  })
  .catch((e) => {
    console.error('[JS Test] Test script encountered an unhandled error at the top level:', e);
  }); 