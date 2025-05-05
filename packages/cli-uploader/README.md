# @flamedeck/cli-uploader

Command-line tool (CLI) for uploading trace files to Flamedeck via the API.

This package uses `@vercel/pkg` to create standalone executables for Linux, macOS, and Windows.

## Prerequisites

- Node.js (v18 or later recommended)
- Yarn

## Building the Executables

To build the standalone CLI binaries:

1.  Ensure all dependencies are installed:
    ```bash
    yarn install
    ```
2.  Run the Nx build command from the workspace root:
    ```bash
    yarn nx run @flamedeck/cli-uploader:build:executable
    ```

This command will first compile the TypeScript code using esbuild and then package it using `pkg`.

## Output

The build process will create executables for Linux, macOS, and Windows in the following directory:

```
packages/cli-uploader/bin/
```

You will find files like:

- `flamedeck-upload-linux`
- `flamedeck-upload-macos`
- `flamedeck-upload-win.exe`

## Usage (After Building)

Once built, you can run the executable for your platform directly. Make sure it has execute permissions (`chmod +x ...` might be needed on Linux/macOS).

```bash
# Example on macOS:
export FLAMEDECK_API_KEY="YOUR_API_KEY"
./packages/cli-uploader/bin/flamedeck-upload-macos -s "My CLI Test" /path/to/your/trace.json

# Example piping on Linux:
export FLAMEDECK_API_KEY="YOUR_API_KEY"
cat /path/to/your/trace.json | ./packages/cli-uploader/bin/flamedeck-upload-linux -s "Piped Test" -n "trace.json"
```

Refer to the built-in help for all available options:

```bash
./packages/cli-uploader/bin/flamedeck-upload-macos --help
```

## Distribution

The recommended way to distribute these binaries is via GitHub Releases, ideally automated with a CI/CD pipeline (like GitHub Actions).
