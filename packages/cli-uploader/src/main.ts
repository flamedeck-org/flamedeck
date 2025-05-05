#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { 
    uploadTraceToApi,
    UploadError,
    UploadOptions 
} from '@flamedeck/trace-uploader-core';

// Helper function to read a stream into an ArrayBuffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).buffer));
    });
}

async function main() {
    const program = new Command();

    program
        .name('flamedeck-upload')
        .description('CLI tool to upload trace files to Flamedeck')
        .version('0.0.1') // TODO: Pull version from package.json dynamically?
        .argument('[file_path]', 'Path to the trace file (reads from stdin if omitted)')
        .option('-k, --api-key <key>', 'Flamedeck API Key (can also use FLAMEDECK_API_KEY env var)')
        .option('-n, --file-name <name>', 'Required filename when reading from stdin')
        .requiredOption('-s, --scenario <description>', 'Scenario description (REQUIRED)')
        .option('-c, --commit <sha>', 'Git commit SHA')
        .option('-b, --branch <name>', 'Git branch name')
        .option('--notes <text>', 'Notes for the trace')
        .option('--folder-id <uuid>', 'UUID of the target folder')
        .option('--metadata <json_string>', 'Optional JSON metadata as a string')
        .option('--supabase-url <url>', 'Override Supabase functions base URL')
        .action(async (filePath, options) => {
            try {
                const apiKey = options.apiKey || process.env['FLAMEDECK_API_KEY'];
                if (!apiKey) {
                    console.error('Error: API Key is required. Provide via --api-key flag or FLAMEDECK_API_KEY environment variable.');
                    process.exit(1);
                }

                let traceData: ArrayBuffer;
                let fileName = options.fileName;

                if (filePath) {
                    // Input from file path
                    const absolutePath = path.resolve(filePath);
                    if (!fs.existsSync(absolutePath)) {
                        console.error(`Error: File not found at ${absolutePath}`);
                        process.exit(1);
                    }
                    if (!fileName) {
                        fileName = path.basename(absolutePath);
                    }
                    const fileStream = fs.createReadStream(absolutePath);
                    traceData = await streamToBuffer(fileStream);
                    console.log(`Reading trace from: ${absolutePath}`);
                } else {
                    // Input from stdin
                    if (!fileName) {
                        console.error('Error: --file-name is required when reading from stdin.');
                        process.exit(1);
                    }
                    console.log('Reading trace from stdin...');
                    traceData = await streamToBuffer(process.stdin);
                }
                
                if (!traceData || traceData.byteLength === 0) {
                     console.error('Error: Input trace data is empty.');
                     process.exit(1);
                }
                console.log(`Trace size: ${traceData.byteLength} bytes`);

                // Initialize with required fields
                const uploadOptions: UploadOptions = {
                    apiKey: apiKey,
                    traceData,
                    fileName: fileName,
                    scenario: options.scenario,
                };

                // Conditionally add other optional metadata
                if (options.commit) uploadOptions.commitSha = options.commit;
                if (options.branch) uploadOptions.branch = options.branch;
                if (options.notes) uploadOptions.notes = options.notes;
                if (options.folderId) uploadOptions.folderId = options.folderId;
                if (options.metadata) uploadOptions.metadata = options.metadata;
                if (options.supabaseUrl) uploadOptions.supabaseFunctionsUrl = options.supabaseUrl;

                console.log(`Uploading trace '${fileName}' (Scenario: ${options.scenario})...`);
                const result = await uploadTraceToApi(uploadOptions);

                console.log('Upload successful!');
                console.log(`View trace at: ${result.viewUrl}`);

            } catch (error: unknown) {
                console.error('\n--- Upload Failed ---');
                if (error instanceof UploadError) {
                    console.error(`Error (${error.status}): ${error.message}`);
                    if (error.details) {
                        try {
                             console.error('Details:', JSON.stringify(error.details, null, 2));
                        } catch { 
                             console.error('Details:', error.details);
                        }
                    }
                } else if (error instanceof Error) {
                    console.error(`Unexpected Error: ${error.message}`);
                    console.error(error.stack);
                } else {
                    console.error('An unknown error occurred:', error);
                }
                console.error('---------------------');
                process.exit(1);
            }
        });

    await program.parseAsync(process.argv);
}

main().catch((err) => {
    console.error("Critical CLI Error:", err);
    process.exit(1);
}); 