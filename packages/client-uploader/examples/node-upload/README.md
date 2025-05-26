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

## Running the Test Script

Make sure uploading works before deploying a new version. Navigate to the `packages/client-uploader/examples/node-upload` directory and run:

```bash
FLAMEDECK_API_KEY=<my-key> yarn nx run @flamedeck/upload:example:node-upload
```