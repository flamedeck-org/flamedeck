import React, { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, Eye, Share2, Edit, Move, Flame, Info } from "lucide-react";
import { 
  ContextMenu, 
  ContextMenuItem, 
  ContextMenuDivider 
} from '@/components/ui/context-menu';
import { TraceMetadata, UserProfile } from "@/types";
import { formatDate, formatDuration, getInitials } from "@/lib/utils"; // Assuming getInitials is in utils
import { User } from '@supabase/supabase-js'; // Import User type if needed
import { useSharingModal } from '@/hooks/useSharingModal'; // Added hook import

interface TraceListItemProps {
  trace: TraceMetadata;
  currentUser: User | null; // Use appropriate User type from your auth context or Supabase
  onDelete: (traceId: string) => void;
  isDeleting: boolean;
  onDoubleClick: () => void;
}

const TraceListItemComponent: React.FC<TraceListItemProps> = ({
  trace,
  currentUser,
  onDelete,
  isDeleting,
  onDoubleClick,
}) => {
  const navigate = useNavigate();
  const { openModal: openShareModal } = useSharingModal(); // Get the modal function
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const isOwnerCurrentUser = useMemo(() => 
    currentUser && trace.owner?.id === currentUser.id, 
    [currentUser, trace.owner?.id]
  );
  
  const ownerName = useMemo(() => 
    isOwnerCurrentUser 
      ? "me" 
      : trace.owner?.username || `${trace.owner?.first_name || ''} ${trace.owner?.last_name || ''}`.trim() || "Unknown Owner",
    [isOwnerCurrentUser, trace.owner?.username, trace.owner?.first_name, trace.owner?.last_name]
  );
  
  // Assuming getInitials exists in utils, otherwise adapt/import
  const ownerInitials = useMemo(() => 
    getInitials(ownerName === "me" ? currentUser?.email : ownerName), 
    [ownerName, currentUser?.email]
  );

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleNavigateToViewer = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(`/traces/${trace.id}/view`, {
      state: { blobPath: trace.blob_path }
    });
    closeContextMenu();
  }, [navigate, trace.id, trace.blob_path, closeContextMenu]);

  const handleNavigateToDetails = useCallback(() => {
    onDoubleClick();
    closeContextMenu();
  }, [onDoubleClick, closeContextMenu]);

  const handleDeleteConfirm = useCallback(() => {
    onDelete(trace.id);
  }, [onDelete, trace.id]);

  const handleOpenDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(true);
    closeContextMenu();
  }, [closeContextMenu]);

  const handleShare = useCallback(() => {
    openShareModal(trace.id);
    closeContextMenu();
  }, [openShareModal, trace.id, closeContextMenu]);

  const handleRenameStub = useCallback(() => {
    console.log("Rename action triggered for trace:", trace.id);
    closeContextMenu();
  }, [trace.id, closeContextMenu]);

  const handleMoveStub = useCallback(() => {
    console.log("Move action triggered for trace:", trace.id);
    closeContextMenu();
  }, [trace.id, closeContextMenu]);

  const handleStopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const commitShortSha = useMemo(() => 
    trace.commit_sha ? trace.commit_sha.substring(0, 7) : "N/A",
    [trace.commit_sha]
  );

  const traceIdentifier = useMemo(() => 
    trace.scenario || `ID: ${trace.id.substring(0, 7)}`,
    [trace.scenario, trace.id]
  );

  return (
    <>
      <TableRow 
        key={trace.id} 
        onDoubleClick={onDoubleClick}
        onContextMenu={handleContextMenu}
        className="cursor-pointer hover:bg-muted/50"
      >
        <TableCell className="font-medium pl-6 py-3">{trace.scenario || "N/A"}</TableCell>
        <TableCell className="py-3">
           <div className="flex items-center space-x-2">
             <Avatar className="h-6 w-6">
               <AvatarImage src={trace.owner?.avatar_url ?? undefined} alt={ownerName} />
               <AvatarFallback>{ownerInitials}</AvatarFallback>
             </Avatar>
             <span className="text-sm truncate">{ownerName}</span>
          </div>
        </TableCell>
        <TableCell className="py-3">{trace.branch || "N/A"}</TableCell>
        <TableCell className="font-mono text-xs py-3">
          {commitShortSha}
        </TableCell>
        <TableCell className="py-3">{trace.device_model || "N/A"}</TableCell>
        <TableCell className="py-3">{formatDuration(trace.duration_ms)}</TableCell>
        <TableCell className="py-3">{formatDate(trace.uploaded_at)}</TableCell>
        <TableCell className="text-right pr-6 py-3">
          <div onClick={handleStopPropagation} className="inline-flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigateToViewer}
              aria-label={`View trace ${traceIdentifier}`}
              className="h-8 w-8 p-0 cursor-pointer"
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              className="h-8 w-8 p-0 text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              aria-label={`Delete trace ${traceIdentifier}`}
              onClick={(e) => {
                e.stopPropagation(); 
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={closeContextMenu}
        >
          <ContextMenuItem 
            onClick={handleNavigateToViewer} 
            icon={<Eye className="h-4 w-4" />}
          >
            View Flamegraph
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={handleNavigateToDetails} 
            icon={<Info className="h-4 w-4" />}
          >
            View Trace details
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem 
            onClick={handleRenameStub} 
            icon={<Edit className="h-4 w-4" />}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={handleMoveStub} 
            icon={<Move className="h-4 w-4" />}
          >
            Move
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={handleShare} 
            icon={<Share2 className="h-4 w-4" />}
          >
            Share
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem 
            onClick={handleOpenDeleteDialog} 
            icon={<Trash2 className="h-4 w-4 text-destructive" />}
          >
            <span className="text-destructive">Delete</span>
          </ContextMenuItem>
        </ContextMenu>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trace{' '}
              <strong>{traceIdentifier}</strong>{' '}
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const TraceListItem = memo(TraceListItemComponent);