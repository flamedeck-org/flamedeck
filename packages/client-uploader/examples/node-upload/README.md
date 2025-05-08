# Node.js Upload Test Script

This script demonstrates how to use the `@flamedeck/upload` package to upload a trace file from a Node.js environment.

## Prerequisites

1.  **Build the `@flamedeck/upload` package**:
    Ensure that the `@flamedeck/upload` package has been built locally so that the test script can import it. From the monorepo root or within the `packages/client-uploader` directory, run:
    ```bash
    # From monorepo root
    yarn nx run @flamedeck/upload:build
    # Or from packages/client-uploader
    # yarn build
    ```

2.  **Set API Key**:
    You must have a valid Flamedeck API key with `trace:upload` scope. Set it as an environment variable:
    ```bash
    export FLAMEDECK_API_KEY="your_actual_api_key_here"
    ```
    Replace `your_actual_api_key_here` with your actual API key.

## Running the Script

Once the prerequisites are met, you can run the test script using `ts-node` (if you have it installed globally or as a dev dependency) or by compiling it with `tsc` and then running the JavaScript output with `node`.

### Using `ts-node` (Recommended for simplicity)

Navigate to the `packages/client-uploader/examples/node-upload` directory and run:

```bash
cd packages/client-uploader/examples/node-upload
npx ts-node upload-test.ts
```

### Compiling and Running with Node

1.  Navigate to the `packages/client-uploader/examples/node-upload` directory.
2.  Compile the TypeScript file (ensure you have `typescript` installed, perhaps as a dev dependency in the `client-uploader` package or globally):
    ```bash
    cd packages/client-uploader/examples/node-upload
    tsc upload-test.ts
    ```
3.  Run the compiled JavaScript file:
    ```bash
    node upload-test.js
    ```

## Script Behavior

*   The script will read the `dummy-trace.json` file located in the same directory.
*   It will attempt to upload this trace to Flamedeck using the API key from your environment.
*   It will log success information (Trace ID, View URL) or error details to the console.
*   You can modify `upload-test.ts` to change the scenario, notes, public status, or to test other `UploadOptions`. 