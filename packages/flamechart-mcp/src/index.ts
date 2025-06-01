import { FastMCP } from 'fastmcp';
import { addTopFunctionsTool } from './tools/top-functions.js';
import { addFlamegraphSnapshotTool } from './tools/flamegraph-snapshot.js';
import { addSandwichSnapshotTool } from './tools/sandwich-snapshot.js';

export function createFlamechartMCPServer() {
    const server = new FastMCP({
        name: 'Flamechart MCP',
        version: '0.2.0',
        instructions: `
This MCP server provides tools for analyzing and visualizing performance traces.

Available tools:
- get_top_functions: Analyze top performing functions by self or total time
- generate_flamegraph_screenshot: Create flamegraph visualizations as PNG images
- generate_sandwich_flamegraph_screenshot: Create sandwich view for specific functions

For the trace parameter, provide either:
1. Absolute local file path (e.g., /path/to/trace.json)
2. Flamedeck URL (e.g., https://www.flamedeck.com/traces/{id}) - requires FLAMEDECK_API_KEY environment variable

The tools automatically cache loaded profiles in memory for better performance:
• Remote URLs are cached for 5 minutes
• Local files are cached until file modification
• Cache holds up to 50 profiles with automatic cleanup

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