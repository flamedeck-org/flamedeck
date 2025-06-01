# @flamedeck/upload

Client library for uploading traces to the Flamedeck API.

## Installation

```bash
npm install @flamedeck/upload
# or
yarn add @flamedeck/upload
```

## Usage

Import the `uploadTraceToApi` function and required types:

```typescript
import { uploadTraceToApi, UploadError, type UploadOptions } from '@flamedeck/upload';

async function handleFileUpload(file: File) {
  const apiKey = 'YOUR_FLAMEDECK_API_KEY'; // Get key from flamdeck settings

  const options: UploadOptions = {
    apiKey: apiKey,
    traceData: file, // Pass a File or Blob object
    fileName: file.name,
    scenario: 'Javascript Upload Example',
    // Add other optional metadata if needed
    commitSha: 'abcdef1',
    metadata: { client: 'web', userId: 'some_user_id' } 
  };

  try {
    const result = await uploadTraceToApi(options);
    console.log('Upload successful! View URL:', result.viewUrl);
  } catch (error) {
    if (error instanceof UploadError) {
      console.error(`Upload failed (${error.status}): ${error.message}`, error.details);
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }
}
```

## Building

To build the library locally (e.g., after making changes), run:

```bash
yarn nx run @flamedeck/upload:build
# or
cd packages/client-uploader
yarn build
```

This will generate the distributable files (CommonJS, ESM, Type Definitions) in the `packages/client-uploader/dist` directory.

## Publishing to NPM (for Maintainers)

NOTE: Make sure that uploading works before incrementing the script version:

```bash
FLAMEDECK_API_KEY=<my-key> yarn nx run @flamedeck/upload:example:node-upload
```

1.  **Update Version:** Increment the `version` number in `packages/client-uploader/package.json` according to semantic versioning.
2.  **Login to NPM:** Ensure you are logged into the correct NPM account that has publish access to the `@flamedeck` organization:
    ```bash
    npm login
    ```
4. Build the package
    ```bash
    yarn nx run @flamedeck/upload:build 
    ```
3.  **Run Publish Command:** Use the Nx target to build and publish:
    ```bash
    yarn nx run @flamedeck/upload:publish
    ```
    This command automatically builds the package and runs `npm publish --access public` from the `dist` directory.

*(Note: Version 0.0.1 was published incorrectly without the built JS/TS files due to an incorrect `files` entry in `package.json`. This was corrected for subsequent versions.)*

## Related Packages

- [`@flamedeck/flamechart-mcp`](https://www.npmjs.com/package/@flamedeck/flamechart-mcp) - MCP server for analyzing performance traces
