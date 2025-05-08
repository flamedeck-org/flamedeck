import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TraceViewerCommentList } from './TraceViewerCommentList';
import { MessageSquare } from 'lucide-react';
import type { SpeedscopeViewType } from '../SpeedscopeViewer';

interface TraceViewerCommentSidebarProps {
  traceId: string;
  activeView: SpeedscopeViewType;
}

export function TraceViewerCommentSidebar({ traceId, activeView }: TraceViewerCommentSidebarProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <MessageSquare className="h-4 w-4" />
          <span className="sr-only">View Comments</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Pass traceId and activeView to the list */}
        <TraceViewerCommentList traceId={traceId} activeView={activeView} />
      </PopoverContent>
    </Popover>
  );
}
