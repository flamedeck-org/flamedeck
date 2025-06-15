import { type FC } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MessageSquare, Calendar, Hash } from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import type { ChatSession } from '@/lib/api/chatHistory';

interface ConversationListViewProps {
  sessions: ChatSession[];
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
  onStartNewChat: () => void;
}

export const ConversationListView: FC<ConversationListViewProps> = ({
  sessions,
  isLoading,
  onSelectSession,
  onStartNewChat,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-background/90 to-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 pr-10">
            <div className="p-1.5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-lg">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-bold text-foreground">Conversations</h3>
          </div>
        </div>

        {/* Loading State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading conversations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-background/90 to-background/70 backdrop-blur-sm">
        <div className="flex items-center justify-between pr-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-lg">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-bold text-foreground">Conversations</h3>
          </div>
          <Button
            onClick={onStartNewChat}
            size="sm"
            className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="p-4 bg-gradient-to-br from-red-500/10 to-yellow-500/10 border border-red-500/20 rounded-2xl mb-4">
                <MessageSquare className="w-8 h-8 text-red-500 mx-auto" />
              </div>
              <p className="text-lg font-bold text-foreground mb-2">No conversations yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Start your first AI analysis of this trace
              </p>
              <Button
                onClick={onStartNewChat}
                className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-2" />
                Start Analyzing
              </Button>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.sessionId}
                onClick={() => onSelectSession(session.sessionId)}
                className="p-3 bg-muted/40 hover:bg-muted/60 border border-border/60 hover:border-border/80 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(session.startedAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      Analysis Session
                    </p>
                    {session.messageCount && (
                      <div className="flex items-center gap-1 mt-1">
                        <Hash className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {session.messageCount} messages
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <div className="w-2 h-2 bg-primary/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
