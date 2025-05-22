import { Langfuse } from "langfuse";
// Using 'any' for realtimeChannel to avoid complex type resolution issues with Supabase v2/v3, 
// as we primarily care about the .send() method's signature which is stable.

interface LoadSystemPromptArgs {
    langfuseClient?: Langfuse;
    traceSummary: string;
    realtimeChannel: any; // Simplified type for broader compatibility
    promptName?: string;
}

export async function loadSystemPromptContent({
    langfuseClient,
    traceSummary,
    realtimeChannel,
    promptName = "analysis-system-prompt",
}: LoadSystemPromptArgs): Promise<string> {
    if (!langfuseClient) {
        const msg = `Langfuse client not available. Cannot fetch system prompt '${promptName}'. Ensure LANGFUSE_PUBLIC_KEY and LANGFUSE_PRIVATE_KEY are set.`;
        console.error(`[SystemPromptLoader] ${msg}`);
        await realtimeChannel.send({
            type: 'broadcast',
            event: 'ai_response',
            payload: { type: 'error', message: `Configuration error - unable to fetch system prompt.` },
        });
        throw new Error(msg);
    }

    try {
        console.log(`[SystemPromptLoader] Attempting to fetch system prompt '${promptName}' from Langfuse...`);
        const fetchedPrompt = await langfuseClient.getPrompt(promptName);
        if (!fetchedPrompt) {
            const msg = `System prompt '${promptName}' not found in Langfuse.`;
            console.error(`[SystemPromptLoader] ${msg}`);
            await realtimeChannel.send({
                type: 'broadcast',
                event: 'ai_response',
                payload: { type: 'error', message: `Configuration error: ${msg}` },
            });
            throw new Error(msg);
        }

        const systemPromptContent = fetchedPrompt.compile({ trace_summary: traceSummary });
        console.log(`[SystemPromptLoader] Successfully fetched and compiled system prompt '${promptName}' from Langfuse.`);
        return systemPromptContent;
    } catch (langfuseError: any) {
        const msg = `Failed to fetch or compile prompt '${promptName}' from Langfuse. Error: ${langfuseError.message}`;
        console.error(`[SystemPromptLoader] ${msg}`, langfuseError);
        await realtimeChannel.send({
            type: 'broadcast',
            event: 'ai_response',
            payload: { type: 'error', message: `Configuration error: ${msg}` },
        });
        throw new Error(msg); // Stop graph execution
    }
} 