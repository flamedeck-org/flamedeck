// This file might not be strictly necessary for the pkg build,
// but it provides a standard entry point if the package is ever imported.

// We might want to re-export parts of the main logic or types here 
// if needed for programmatic use, but for now, let's keep it simple.

console.warn('This package is intended for CLI use via the `flamedeck-upload` command.');

// Optionally, re-export core types if useful
export type { UploadOptions } from '@flamedeck/trace-uploader-core';

export * from './lib/cli-uploader';
