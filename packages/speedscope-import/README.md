# @flamedeck/import

Import any support profile into the standard speedscope format.

## Installation

```bash
npm install @flamedeck/import
```

## Usage

```typescript
import { importProfile } from '@flamedeck/import';
import { readFileSync } from 'fs';

// Import from a file (automatically detects format)
const profileData = readFileSync('profile.cpuprofile', 'utf8');
const result = await importProfile(profileData, 'profile.cpuprofile');

// Or import from binary data
const binaryData = readFileSync('profile.pprof'); 
const result = await importProfile(binaryData, 'profile.pprof');

// Access the parsed profile
if (result.profileGroup) {
  console.log('Profile type:', result.profileType);
  console.log('Number of profiles:', result.profileGroup.profiles.length);
  
  const profile = result.profileGroup.profiles[0];
  console.log('Profile name:', profile.name);
  console.log('Duration:', profile.duration, 'ms');
  console.log('Frames:', profile.frames.length);
  console.log('Samples:', profile.samples.length);
}
```

## Supported Formats

This package supports all the same formats as [Speedscope](https://github.com/jlfwong/speedscope):

- **Chrome DevTools CPU Profiles** (`.cpuprofile`)
- **Firefox Profiler** format
- **Node.js profiles**
- **pprof** format (Go, C++, etc.)
- **Stackprof** (Ruby)
- **Instruments** (macOS)
- **Perf** (Linux)
- And many more...

## API

### `importProfile(input: string | ArrayBuffer | Buffer, fileName: string): Promise<ImportResult>`

Imports a performance profile from various input types, automatically detecting the format and setting up Node.js dependencies.

- `input`: Profile data as string (for JSON formats), ArrayBuffer, or Node.js Buffer
- `fileName`: The original filename (used for format detection)
- Returns: A Promise that resolves to an `ImportResult` object

#### ImportResult

```typescript
interface ImportResult {
  profileGroup: ProfileGroup | null;
  profileType: ProfileType;
}
```

##### ProfileGroup

When parsing succeeds, `profileGroup` contains:

```typescript
interface ProfileGroup {
  name: string;           // Name of the profile group
  indexToView: number;    // Index of the profile to view by default (usually 0)
  profiles: Profile[];    // Array of parsed profiles
}
```

##### Profile

Each profile in the group provides comprehensive performance data:

```typescript
class Profile {
  // Basic information
  getName(): string;                    // Profile name
  getTotalWeight(): number;             // Total execution time/samples
  getTotalNonIdleWeight(): number;      // Total time excluding idle
  getWeightUnit(): ValueUnit;           // Units ('nanoseconds', 'milliseconds', etc.)
  formatValue(value: number): string;   // Format a value with units
  
  // Call tree analysis
  getAppendOrderCalltreeRoot(): CallTreeNode;   // Raw call order tree
  getGroupedCalltreeRoot(): CallTreeNode;       // Grouped/sorted call tree
  
  // Frame and sample data
  forEachFrame(fn: (frame: Frame) => void): void;     // Iterate over all frames
  forEachCall(openFrame, closeFrame): void;           // Walk call timeline
  forEachCallGrouped(openFrame, closeFrame): void;    // Walk grouped calls
  
  // Analysis methods
  getProfileWithRecursionFlattened(): Profile;                    // Remove recursion
  getInvertedProfileForCallersOf(frame: FrameInfo): Profile;     // Caller analysis
  getProfileForCalleesOf(frame: FrameInfo): Profile;             // Callee analysis
}
```

##### Frame

Individual stack frames contain:

```typescript
interface FrameInfo {
  key: string | number;    // Unique identifier
  name: string;            // Function/method name
  file?: string;           // Source file path
  line?: number;           // Line number (1-based)
  col?: number;            // Column number (1-based)
}

class Frame extends FrameInfo {
  getSelfWeight(): number;     // Time spent in this frame only
  getTotalWeight(): number;    // Time spent in frame + children
}
```

##### ProfileType

The detected profile format, one of:

- `'speedscope'` - Native Speedscope format
- `'chrome-cpuprofile'` - Chrome DevTools CPU Profile
- `'chrome-timeline'` - Chrome Timeline/Tracing format  
- `'chrome-heap-profile'` - Chrome Heap Profile
- `'pprof'` - Protocol buffer format (Go, C++, etc.)
- `'firefox'` - Firefox Profiler format
- `'safari'` - Safari profiler format
- `'stackprof'` - Ruby Stackprof format
- `'instruments-deepcopy'` - macOS Instruments text export
- `'instruments-trace'` - macOS Instruments trace directory
- `'linux-perf'` - Linux perf script output
- `'collapsed-stack'` - Collapsed stack format
- `'v8-prof-log'` - V8 profiler log format
- `'haskell'` - Haskell GHC profiler format
- `'trace-event'` - Generic trace event format
- `'callgrind'` - Valgrind Callgrind format
- `'papyrus'` - Papyrus profiler format
- `'unknown'` - Could not detect format

## Advanced Usage

### Analyzing Call Performance

```typescript
import { importProfile } from '@flamedeck/import';
import { readFileSync } from 'fs';

const profileData = readFileSync('profile.cpuprofile', 'utf8');
const result = await importProfile(profileData, 'profile.cpuprofile');

if (result.profileGroup) {
  const profile = result.profileGroup.profiles[0];
  
  // Get basic metrics
  console.log('Total execution time:', profile.formatValue(profile.getTotalWeight()));
  console.log('Time units:', profile.getWeightUnit());
  
  // Analyze individual frames
  const hotFrames = [];
  profile.forEachFrame(frame => {
    if (frame.getSelfWeight() > 1000) { // Frames with >1000 units of self time
      hotFrames.push({
        name: frame.name,
        selfTime: frame.getSelfWeight(),
        totalTime: frame.getTotalWeight(),
        file: frame.file,
        line: frame.line
      });
    }
  });
  
  // Sort by self time (hottest first)
  hotFrames.sort((a, b) => b.selfTime - a.selfTime);
  console.log('Hottest functions:', hotFrames.slice(0, 10));
}
```

### Walking the Call Tree

```typescript
const profile = result.profileGroup.profiles[0];

// Walk the timeline in execution order
profile.forEachCall(
  (node, startTime) => {
    console.log(`${startTime}ms: Entering ${node.frame.name}`);
  },
  (node, endTime) => {
    console.log(`${endTime}ms: Exiting ${node.frame.name}`);
  }
);

// Walk the grouped/sorted call tree (for flamegraph-like analysis)
profile.forEachCallGrouped(
  (node, startTime) => {
    const selfTime = node.getSelfWeight();
    const totalTime = node.getTotalWeight();
    console.log(`${node.frame.name}: ${selfTime}ms self, ${totalTime}ms total`);
  },
  (node, endTime) => {
    // Frame completed
  }
);
```

### Caller/Callee Analysis

```typescript
// Find who calls a specific function
const targetFrame = { key: 'myFunction', name: 'myFunction' };
const callerProfile = profile.getInvertedProfileForCallersOf(targetFrame);
console.log('Functions that call myFunction:');
callerProfile.forEachFrame(frame => {
  console.log(`${frame.name}: ${frame.getTotalWeight()}ms`);
});

// Find what a function calls
const calleeProfile = profile.getProfileForCalleesOf(targetFrame);
console.log('Functions called by myFunction:');
calleeProfile.forEachFrame(frame => {
  console.log(`${frame.name}: ${frame.getTotalWeight()}ms`);
});
```

### Flattening Recursion

```typescript
// Remove recursive calls for cleaner analysis
const flatProfile = profile.getProfileWithRecursionFlattened();
console.log('Profile with recursion flattened:');
console.log('Total time:', flatProfile.formatValue(flatProfile.getTotalWeight()));
```

## Related Packages

- [`@flamedeck/flamechart-mcp`](https://www.npmjs.com/package/@flamedeck/flamechart-mcp) - MCP server for flamegraph analysis
- [`@flamedeck/upload`](https://www.npmjs.com/package/@flamedeck/upload) - Upload traces to FlameDeck

## License

ISC

## Development

### Generating Protobuf Code

This package includes importers for pprof (protobuf) formatted profiles. The TypeScript code for handling these protobuf definitions is generated from a `.proto` schema file.

If you modify `packages/speedscope-import/src/speedscope-import/profile.proto`, you will need to regenerate the corresponding TypeScript file (`profile.proto.ts`) using the following command from the workspace root:

```bash
npx pbjs --ts packages/speedscope-import/src/speedscope-import/profile.proto.ts packages/speedscope-import/src/speedscope-import/profile.proto
```

This command uses `pbjs` (from `protobufjs-cli`) to convert the `.proto` file directly into a TypeScript module that includes both the runtime logic and type definitions for the protobuf messages.

**Prerequisites:**

- Ensure `protobufjs-cli` is available. You can install it globally (`npm install -g protobufjs-cli`) or add it as a dev dependency to the workspace root and run via `npx pbjs ...`.
