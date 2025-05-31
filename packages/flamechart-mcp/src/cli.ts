import { createFlamechartMCPServer } from './index.js';

function showHelp() {
    console.log(`
Flamechart MCP Server

Usage:
  npx @flamedeck/flamechart-mcp [options]

Options:
  --help          Show this help message

Environment Variables:
  FLAMEDECK_API_KEY   Required for Flamedeck URL traces (not yet implemented)

Examples:
  # Start MCP server (for use with MCP clients like Claude Desktop)
  npx @flamedeck/flamechart-mcp

Available Tools:
  - get_top_functions: Get top functions by performance metrics
  - generate_flamegraph_screenshot: Create flamegraph PNG images
  - generate_sandwich_flamegraph_screenshot: Create sandwich view for specific functions

For more information, visit: https://github.com/flamedeck/flamedeck
  `);
}

function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    const server = createFlamechartMCPServer();

    console.log(`Starting Flamechart MCP Server...`);
    console.log('Transport: stdio');
    console.log('Ready for MCP client connections via stdio');

    server.start({
        transportType: 'stdio',
    });
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

main(); 