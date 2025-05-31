# Example Usage

This document shows how to use the Flamechart MCP server with various MCP clients.

## Claude Desktop Configuration

Add this to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

## Example Conversations

### Analyzing Performance Issues

**User:** "I have a performance profile at `/Users/dev/profiles/slow-app.cpuprofile`. Can you show me the top 10 functions consuming the most time?"

**Assistant:** I'll analyze your performance profile to find the top time-consuming functions.

```json
{
  "tool": "get_top_functions",
  "parameters": {
    "trace": "/Users/dev/profiles/slow-app.cpuprofile",
    "sortBy": "total",
    "limit": 10
  }
}
```

### Generating Flamegraph Visualizations

**User:** "Create a flamegraph visualization of the same profile, but make it dark mode and focus on the time range from 1000ms to 5000ms."

**Assistant:** I'll generate a dark mode flamegraph focused on that specific time range.

```json
{
  "tool": "generate_flamegraph_screenshot",
  "parameters": {
    "trace": "/Users/dev/profiles/slow-app.cpuprofile",
    "mode": "dark",
    "startTimeMs": 1000,
    "endTimeMs": 5000,
    "width": 1600,
    "height": 1000
  }
}
```

### Analyzing Specific Functions

**User:** "I see that `processData` function is taking a lot of time. Can you show me a sandwich view of what's calling it and what it's calling?"

**Assistant:** I'll create a sandwich view flamegraph for the `processData` function to show its callers and callees.

```json
{
  "tool": "generate_sandwich_flamegraph_screenshot",
  "parameters": {
    "trace": "/Users/dev/profiles/slow-app.cpuprofile",
    "frameName": "processData"
  }
}
```

## Testing with MCP Inspector

You can test the server using the MCP Inspector:

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Start the inspector with your server
npx @modelcontextprotocol/inspector npx @flamedeck/flamechart-mcp
```

## Supported File Formats

The server supports many trace formats:

- **Chrome DevTools Performance profiles** (`.json`)
- **Node.js CPU profiles** (`.cpuprofile`)
- **Firefox Profiler exports** (`.json`)
- **Safari Timeline exports** (`.json`)
- **Linux perf output** (converted to JSON)
- **Go pprof profiles** (`.pb.gz`)
- **And many more...**

Files can be gzipped - the server automatically detects and decompresses them.

## Common Use Cases

### 1. Performance Regression Analysis

```json
{
  "tool": "get_top_functions",
  "parameters": {
    "trace": "/profiles/before-optimization.json",
    "sortBy": "self",
    "limit": 20
  }
}
```

### 2. Memory Leak Investigation

```json
{
  "tool": "generate_flamegraph_screenshot",
  "parameters": {
    "trace": "/profiles/memory-leak.json",
    "width": 2000,
    "height": 1200
  }
}
```

### 3. Function-Specific Analysis

```json
{
  "tool": "generate_sandwich_flamegraph_screenshot",
  "parameters": {
    "trace": "/profiles/app-profile.json",
    "frameName": "suspiciousFunction"
  }
}
```

## Tips

1. **Use absolute paths** for trace files to avoid path resolution issues
2. **Large files** are supported - the server handles gzipped files automatically
3. **Function names** must match exactly for sandwich views
4. **Time ranges** in milliseconds can help focus on specific performance issues
5. **Dark mode** flamegraphs often work better for presentations 