import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from '@/components/ui/sheet';
import { TraceViewerCommentList } from './TraceViewerCommentList';
import { MessageSquare } from 'lucide-react';
import type { SpeedscopeViewType } from '../SpeedscopeViewer';

interface TraceViewerCommentSidebarProps {
  traceId: string;
  activeView: SpeedscopeViewType;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TraceViewerCommentSidebar({
  traceId,
  activeView,
  isOpen,
  onOpenChange,
}: TraceViewerCommentSidebarProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[350px] sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>
        <div className="flex-grow overflow-y-auto">
          <TraceViewerCommentList traceId={traceId} activeView={activeView} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
