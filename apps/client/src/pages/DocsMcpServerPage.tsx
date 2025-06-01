import McpServerContent from '../docs/mcp-server.mdx';
import DocsContent from '@/components/docs/DocsContent';
import DocsPageSEO from '@/components/docs/DocsPageSEO';

export default function DocsMcpServerPage() {
    return (
        <>
            <DocsPageSEO
                title="MCP Server"
                description="Learn how to set up and use the Flamechart MCP server to analyze performance traces with AI assistants like Cursor and Claude."
                path="/docs/mcp-server"
            />
            <DocsContent>
                <McpServerContent />
            </DocsContent>
        </>
    );
} 