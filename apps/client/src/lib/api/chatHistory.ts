import { supabase } from '@/integrations/supabase/client';
import { type Database } from '@flamedeck/supabase-integration';
import { type ChatMessage } from '@/components/Chat/ChatWindow'; // Assuming ChatMessage is exported
import { v4 as uuidv4 } from 'uuid'; // For fallback IDs if needed, though DB ID should be used

export const DEFAULT_HISTORY_PAGE_SIZE = 50;

export async function fetchChatHistory(
  userId: string,
  traceId: string,
  sessionId: string,
  limit: number = DEFAULT_HISTORY_PAGE_SIZE
): Promise<ChatMessage[]> {
  const { data: dbMessages, error: dbError } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .eq('trace_id', traceId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (dbError) {
    throw new Error(`Failed to load chat history: ${dbError.message}`);
  }

  if (!dbMessages) {
    return []; // Return empty array if no messages found or data is null
  }

  const mappedMessages: ChatMessage[] = dbMessages
    .map((dbMsg: Database['public']['Tables']['chat_messages']['Row']) => {
      let senderType: ChatMessage['sender'] = 'system';
      let toolStatusType: ChatMessage['toolStatus'] | undefined = undefined;
      let resultTypeVal: ChatMessage['resultType'] | undefined = undefined;

      if (dbMsg.sender === 'user') senderType = 'user';
      else if (dbMsg.sender === 'model') senderType = 'model';
      else if (dbMsg.sender === 'tool_request') {
        senderType = 'tool';
        toolStatusType = 'running';
      } else if (dbMsg.sender === 'tool_result') {
        senderType = 'tool';
        toolStatusType = (dbMsg.tool_status as ChatMessage['toolStatus']) ?? 'success';
        if (dbMsg.content_image_url) resultTypeVal = 'image';
        else resultTypeVal = 'text';
      } else if (dbMsg.sender === 'tool_error') {
        senderType = 'tool';
        toolStatusType = 'error';
      } else if (dbMsg.sender === 'system_event') senderType = 'system';
      else if (dbMsg.sender === 'error') senderType = 'error';

      return {
        id: dbMsg.id || uuidv4(), // Prefer DB id, fallback for safety
        sender: senderType,
        text: dbMsg.content_text || '',
        timestamp: dbMsg.created_at ? new Date(dbMsg.created_at).getTime() : undefined,
        toolName: dbMsg.tool_name || undefined,
        toolCallId: dbMsg.tool_call_id || undefined,
        toolStatus: toolStatusType,
        resultType: resultTypeVal,
        imageUrl: dbMsg.content_image_url || undefined,
      };
    })
    .filter((msg) => {
      // Filter out empty messages, except for tool messages which might have empty text but have other content
      if (msg.sender === 'tool') {
        return true; // Keep tool messages regardless of text content
      }
      // For other message types, only keep if there's actual text content
      return msg.text && msg.text.trim() !== '';
    });

  return mappedMessages;
}

export interface ChatSession {
  sessionId: string;
  startedAt: string; // ISO string format from created_at
  messageCount?: number; // Optional: could be useful later. Provided by the new SQL fn.
}

export async function fetchChatSessions(traceId: string): Promise<ChatSession[]> {
  const { data, error } = await supabase.rpc('get_chat_sessions_for_trace', {
    in_trace_id: traceId,
  });

  if (error) {
    throw new Error(`Failed to load chat sessions: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((session) => ({
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    messageCount: session.messageCount,
  }));
}
