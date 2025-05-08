console.log('Test script started...');

import { uploadTraceToApi, UploadOptions, UploadError } from '@flamedeck/upload';

console.log('Import of uploadTraceToApi type:', typeof uploadTraceToApi);
console.log('Import of UploadOptions type:', typeof UploadOptions); // This will likely log undefined as it's an interface
console.log('Import of UploadError type:', typeof UploadError);

/* // Temporarily comment out the rest of the script
import fs from 'node:fs/promises';
import path from 'node:path';

// Ensure FLAMEDECK_API_KEY is set in your environment
const apiKey = process.env.FLAMEDECK_API_KEY;
const dummyTracePath = path.join(__dirname, 'dummy-trace.json');

async function runNodeUploadTest() {
  if (!apiKey) {
    console.error('Error: FLAMEDECK_API_KEY environment variable is not set.');
    console.error('Please set it before running the test script:');
    console.error('export FLAMEDECK_API_KEY="your_actual_api_key_here"');
    process.exit(1);
  }

  try {
    console.log(`Reading dummy trace file from: ${dummyTracePath}`);
    const traceDataBuffer = await fs.readFile(dummyTracePath);
    const fileName = path.basename(dummyTracePath);

    const options: UploadOptions = {
      apiKey: apiKey,
      traceData: traceDataBuffer,
      fileName: fileName,
      scenario: 'Node.js Test Script Upload',
      commitSha: 'testcommit123',
      branch: 'test-branch',
      notes: 'This trace was uploaded by the @flamedeck/upload test script from Node.js.',
      public: false, // You can set this to true to test public uploads
      // folderId: 'your-folder-id', // Optionally specify a folder ID
      // metadata: { testRunId: 'run-456', environment: 'staging' }, // Optional metadata
    };

    console.log(`Attempting to upload '${fileName}' for scenario '${options.scenario}'...`);
    const result = await uploadTraceToApi(options);

    console.log('\n--- Upload Successful! ---');
    console.log(`Trace ID: ${result.id}`);
    console.log(`View URL: ${result.viewUrl}`);
    console.log('------------------------\n');

  } catch (error) {
    console.error('\n--- Upload Failed ---');
    if (error instanceof UploadError) {
      console.error(`Status: ${error.status}`);
      console.error(`Message: ${error.message}`);
      if (error.details) {
        console.error('Details:', error.details);
      }
    } else {
      console.error('An unexpected error occurred:', error);
    }
    console.log('---------------------\n');
    process.exit(1);
  }
}

runNodeUploadTest()
  .then(() => {
    console.log('Test script finished.');
  })
  .catch(() => {
    // Error already logged in runNodeUploadTest
    console.error('Test script encountered an error.');
  });
*/
