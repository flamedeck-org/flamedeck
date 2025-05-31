import { FastMCP } from 'fastmcp';
import { addTopFunctionsTool } from './tools/top-functions.js';
import { addFlamegraphSnapshotTool } from './tools/flamegraph-snapshot.js';
import { addSandwichSnapshotTool } from './tools/sandwich-snapshot.js';

export function createFlamechartMCPServer() {
    const server = new FastMCP({
        name: 'Flamechart MCP',
        version: '0.1.0',
        instructions: `
This MCP server provides tools for analyzing and visualizing performance traces.

Available tools:
- get_top_functions: Analyze top performing functions by self or total time
- generate_flamegraph_screenshot: Create flamegraph visualizations as PNG images
- generate_sandwich_flamegraph_screenshot: Create sandwich view for specific functions

For the trace parameter in all tools, provide either:
1. Absolute local file path (e.g., /path/to/trace.json)
2. Flamedeck URL (requires FLAMEDECK_API_KEY environment variable) - Currently not implemented

The tools will automatically detect and handle gzipped trace files.
    `.trim(),
    });

    // Add all tools
    addTopFunctionsTool(server);
    addFlamegraphSnapshotTool(server);
    addSandwichSnapshotTool(server);

    return server;
}

// Export the server instance for programmatic use
export const server = createFlamechartMCPServer();

// Export types for external use
export type { FlamegraphSnapshotResult, ProfileLoadResult, TraceSource } from './types.js'; 