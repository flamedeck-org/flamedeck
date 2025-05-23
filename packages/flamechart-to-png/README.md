# @flamedeck/flamechart-to-png

This package is responsible for rendering performance profiles, specifically those compatible with the Speedscope format, into PNG images. It can generate both standard left-heavy flamegraphs and sandwich views focusing on a specific function's callers and callees.

## Core Functions

The primary functionalities are exposed through two main functions:

1.  `renderLeftHeavyFlamechart(profileGroup, options)`: Renders a traditional left-heavy flamegraph.
    *   `profileGroup`: A `ProfileGroup` object from `@flamedeck/speedscope-core`.
    *   `options`: An object to customize rendering, including:
        *   `width?`: number (default: 1200)
        *   `height?`: number (default: 800, but capped by width)
        *   `frameHeight?`: number (default: 18)
        *   `font?`: string (default: '10px Arial')
        *   `startTimeMs?`: number (start of a specific time range in milliseconds)
        *   `endTimeMs?`: number (end of a specific time range in milliseconds)
        *   `mode?`: 'light' | 'dark' (default: 'light')
        *   `flamegraphThemeName?`: FlamegraphThemeName (e.g., 'ember', 'ocean')
        *   `startDepth?`: number (initial depth to render from)

2.  `renderSandwichFlamechart(mainProfile, selectedFrame, options)`: Renders a sandwich view, showing callers above and callees below a selected function.
    *   `mainProfile`: A `Profile` object (typically `profileGroup.profiles[profileGroup.indexToView]`).
    *   `selectedFrame`: The `Frame` object to focus the sandwich view on.
    *   `options`: Similar to `renderLeftHeavyFlamechartOptions`, with additional options like:
        *   `sidebarWidth?`: number (default: 20)
        *   `centralAxisHeight?`: number (default: 20)
        *   `callerHeight?`: number (specific height for the caller section)
        *   `calleeHeight?`: number (specific height for the callee section)

## Building the Package

Before running test scripts or using the package in other parts of the monorepo, ensure it's built:

```bash
yarn nx run @flamedeck/flamechart-to-png:build
```

If you encounter issues with dependencies like `@flamedeck/speedscope-import`, you might also need to build them explicitly:

```bash
yarn nx run @flamedeck/speedscope-import:build
```

## Testing Scripts

This package includes scripts to test the rendering functionality directly from the command line. These scripts are located in the `dist/packages/flamechart-to-png/` directory after a successful build.

### 1. Testing Left-Heavy Flamegraph (`test-render.js`)

This script renders a left-heavy flamegraph from a given profile.

**Command:**

```bash
yarn nx run @flamedeck/flamechart-to-png:test-render -- <path_to_profile_file> [output_file_name.png] [options]
```

**Arguments:**

*   `<path_to_profile_file>`: **Required.** Path to the Speedscope JSON profile file.
*   `[output_file_name.png]`: Optional. Name for the output PNG file. Defaults to `[profile_name]-flamechart.png`.
*   `[options]`:
    *   `--start-time-ms <ms>`: Optional. Start time in milliseconds for the render.
    *   `--end-time-ms <ms>`: Optional. End time in milliseconds for the render.
    *   `--mode <light|dark>`: Optional. Theme mode. Defaults to `light`.
    *   `--flamegraph-theme <theme_name>`: Optional. Specific flamegraph theme.
    *   `--width <pixels>`: Optional. Width of the output image.
    *   `--height <pixels>`: Optional. Height of the output image.

**Example:**

```bash
yarn nx run @flamedeck/flamechart-to-png:test-render -- ./my_profile.speedscope.json --mode dark --start-time-ms 1000 --end-time-ms 5000
```

### 2. Testing Sandwich Flamegraph (`test-sandwich-render.js`)

This script renders a sandwich flamegraph for a specified function within a profile.

**Command:**

```bash
yarn nx run @flamedeck/flamechart-to-png:test-sandwich-render -- <path_to_profile_file> --frame-name "<frame_name>" [output_file_name.png] [options]
```

**Arguments:**

*   `<path_to_profile_file>`: **Required.** Path to the Speedscope JSON profile file.
*   `--frame-name "<frame_name>"`: **Required.** The name of the function/frame to create the sandwich view for. Quote if it contains spaces.
*   `[output_file_name.png]`: Optional. Name for the output PNG file. Defaults to `[profile_name]-sandwich-[frame_name].png`.
*   `[options]`: Same optional arguments as `test-render` (`--start-time-ms`, `--end-time-ms`, `--mode`, etc.). Time ranges will be relative to the selected frame's duration.

**Example:**

```bash
yarn nx run @flamedeck/flamechart-to-png:test-sandwich-render -- ./my_profile.speedscope.json --frame-name "processData" my_process_data_sandwich.png --mode light
```

The test targets in `project.json` have `dependsOn: ["build"]`, so running these test scripts via `nx run` should automatically build the `@flamedeck/flamechart-to-png` package first. However, if you encounter issues, running the build command manually as mentioned above can be helpful. 