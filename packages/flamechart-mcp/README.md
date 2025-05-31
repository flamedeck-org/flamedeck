# @flamedeck/flamechart-mcp

MCP (Model Context Protocol) server for debugging and analyzing flamegraphs. This package provides AI assistants with tools to analyze performance traces and generate flamegraph visualizations.

## Installation

```bash
npm install -g @flamedeck/flamechart-mcp
# or run directly with npx
npx @flamedeck/flamechart-mcp
```

## Usage

### With MCP Clients

Start the MCP server for use with MCP-compatible clients:

```bash
npx @flamedeck/flamechart-mcp
```

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "flamechart-debug": {
      "command": "npx",
      "args": ["@flamedeck/flamechart-mcp"],
      "env": {
        "FLAMEDECK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

### `get_top_functions`

Analyze the top performing functions in a trace file.

**Parameters:**
- `trace` (string): Absolute local file path or Flamedeck URL
- `sortBy` (string, optional): Sort by 'self' or 'total' time (default: 'total')
- `offset` (number, optional): 0-indexed offset for pagination (default: 0)
- `limit` (number, optional): Number of functions to return (default: 15)

**Example:**
```json
{
  "tool": "get_top_functions",
  "parameters": {
    "trace": "/path/to/profile.json",
    "sortBy": "total",
    "limit": 10
  }
}
```

### `generate_flamegraph_screenshot`

Generate a flamegraph visualization as a PNG image.

**Parameters:**
- `trace` (string): Absolute local file path or Flamedeck URL
- `width` (number, optional): Image width in pixels (default: 1200)
- `height` (number, optional): Image height in pixels (default: 800)
- `startTimeMs` (number, optional): Start time for zoomed view
- `endTimeMs` (number, optional): End time for zoomed view
- `startDepth` (number, optional): Start depth for zoomed view
- `mode` (string, optional): Color mode 'light' or 'dark' (default: 'light')

**Returns:** PNG image that can be displayed directly by MCP clients

### `generate_sandwich_flamegraph_screenshot`

Generate a sandwich view flamegraph for a specific function, showing both callers and callees.

**Parameters:**
- `trace` (string): Absolute local file path or Flamedeck URL
- `frameName` (string): Exact name of the function to focus on

**Returns:** PNG image that can be displayed directly by MCP clients

## Supported Trace Formats

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

- `FLAMEDECK_API_KEY`: Required for Flamedeck URL traces (feature not yet implemented)

## Examples

### Analyzing a Local Trace File

```bash
# Start the MCP server
npx @flamedeck/flamechart-mcp
```

Then use with an MCP client to analyze traces:

```json
{
  "tool": "get_top_functions",
  "parameters": {
    "trace": "/Users/developer/profiles/my-app.cpuprofile",
    "sortBy": "self",
    "limit": 20
  }
}
```

### Generating Flamegraph Images

```json
{
  "tool": "generate_flamegraph_screenshot",
  "parameters": {
    "trace": "/path/to/trace.json",
    "width": 1600,
    "height": 1000,
    "mode": "dark"
  }
}
```

### Analyzing Specific Functions

```json
{
  "tool": "generate_sandwich_flamegraph_screenshot",
  "parameters": {
    "trace": "/path/to/trace.json",
    "frameName": "myExpensiveFunction"
  }
}
```

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