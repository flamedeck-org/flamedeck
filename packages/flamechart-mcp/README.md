# Flamechart MCP Server

MCP (Model Context Protocol) server for debugging and analyzing a wide range of performance profiles (go, javascript, python, etc) using flamegraphs. Use with local traces or with FlameDeck's hosted trace storage.

**Works entirely offline for local trace files** - no API key required! Only need a Flamedeck API key for analyzing remote traces.

![Screenshot of FlameDeck MCP in action](./images/screenshot.png)

## Usage

### With Cursor / Claude Desktop

Add the following to your MCP server configuration file:

**For local files only (no API key needed):**
```json
{
  "mcpServers": {
    "flamechart-debug": {
      "command": "npx",
      "args": ["-y", "@flamedeck/flamechart-mcp"]
    }
  }
}
```

**For remote Flamedeck traces (API key required):**
```json
{
  "mcpServers": {
    "flamechart-debug": {
      "command": "npx",
      "args": ["-y", "@flamedeck/flamechart-mcp"],
      "env": {
        "FLAMEDECK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

> You will need to create an API key with `trace:download` permissions in your [Flamedeck settings](https://flamedeck.com/settings/api-keys).

## Practical Examples for Cursor/AI Assistants

### Analyzing Local Trace Files

**Example prompt for Cursor:**
```
Analyze this trace file and find out why my React app's rendering is slow:
/Users/developer/profiles/react-app-slow.cpuprofile

Focus on any React-related functions that might be causing bottlenecks
```

### Analyzing Remote Flamedeck Traces

**Example prompt for team collaboration:**
```
My teammate shared this performance trace from production. Analyze it and help me understand the bottlenecks:
https://www.flamedeck.com/traces/98508d02-1f2a-4885-9607-ecadceb3d734

Focus on:
1. Database query performance 
2. Any functions taking >100ms
```

**Example prompt for API performance investigation:**
```
Our API response times spiked yesterday. Root cause with this production trace:
https://www.flamedeck.com/traces/abc123...

* You can read through the codebase as you are analyzing to understand execution paths
* If you can't find any issues, don't make anything up, just say so
```

## Available Tools

### `get_top_functions`

Analyze the slowest functions in a trace file, sorted by either self or total time consumption.

**Parameters:**
- `trace` (string): Absolute local file path or Flamedeck URL
- `sortBy` (string, optional): Sort by 'self' or 'total' time (default: 'total')
- `offset` (number, optional): 0-indexed offset for pagination (default: 0)
- `limit` (number, optional): Number of functions to return (default: 15)

**Use cases:** Identifying performance bottlenecks, finding hot paths in your code

### `generate_flamegraph_screenshot`

Generate a flamegraph visualization as a PNG image for viewing a timeline view of function execution

**Parameters:**
- `trace` (string): Absolute local file path or Flamedeck URL
- `width` (number, optional): Image width in pixels (default: 1200)
- `height` (number, optional): Image height in pixels (default: 800)
- `startTimeMs` (number, optional): Start time for zoomed view
- `endTimeMs` (number, optional): End time for zoomed view
- `startDepth` (number, optional): Start depth for zoomed view
- `mode` (string, optional): Color mode 'light' or 'dark' (default: 'light')

**Use cases:** Creating visuals for reports, sharing performance insights with team

### `generate_sandwich_flamegraph_screenshot`

Generate a sandwich view flamegraph for a specific function, showing both callers and callees.

**Parameters:**
- `trace` (string): Absolute local file path or Flamedeck URL
- `frameName` (string): Exact name of the function to focus on

**Use cases:** Deep-diving into specific function performance, understanding call hierarchies

### Supported Trace Formats

The server supports various trace formats through the Speedscope import system:

- **Chrome DevTools** (`.json`)
- **Firefox Profiler** (`.json`)
- **Safari Timeline** (`.json`)
- **Node.js** (`--prof` output)
- **perf** (Linux perf output)
- **Instruments** (`.trace` files)
- **pprof** (Go profiler format)
- **And many more...**

Files can be gzipped - the server will automatically detect and decompress them.

## Environment Variables

- `FLAMEDECK_API_KEY`: **Only required for remote Flamedeck URL traces**. Create an API key with `trace:download` permissions in your [Flamedeck settings](https://flamedeck.com/settings/api-keys).

**Note:** The MCP server works completely offline when analyzing local trace files - no internet connection or API key needed!

## Development

### Building

```bash
yarn build
```

### Testing Locally

```bash
# Build the package
yarn build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/cli.js
```

## Publishing

1. Update version in `package.json`
2. Build the package: `yarn build`
3. Publish: `yarn publish`

## Related Packages

- [`@flamedeck/upload`](https://www.npmjs.com/package/@flamedeck/upload) - Client library for uploading traces

## License

ISC 