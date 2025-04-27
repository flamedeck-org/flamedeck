import React, { memo, useState, useCallback } from 'react';
import { Folder as FolderIcon, Trash2, Edit, Move, MoreVertical, Eye } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Folder } from '@/lib/api'; // Assuming Folder type is exported from api.ts
import { formatRelativeDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuDivider,
} from '@/components/ui/context-menu';
import { MoveItemDialog } from './MoveItemDialog';
import { RenameFolderDialog } from './RenameFolderDialog'; // Import the rename dialog
import { cn } from '@/lib/utils'; // Import cn utility
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { traceApi } from '@/lib/api'; // Import Folder type too
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FOLDER_VIEW_QUERY_KEY } from './hooks/useTraces';
import { DeleteFolderDialog } from './DeleteFolderDialog';
import { RecursiveFolderContents, ApiError, ApiResponse } from '@/types'; // Import needed types

interface FolderItemProps {
  folder: Folder;
  onClick: () => void;
}

function FolderItemComponent({ folder, onClick }: FolderItemProps) {
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // --- Delete Mutation - Updated --- 
  const { mutate: deleteFolder, isPending: isDeleting } = useMutation<
    ApiResponse<void>,
    ApiError,
    RecursiveFolderContents // Accepts the contents object
  >({
    mutationFn: (contents: RecursiveFolderContents) => {
      if (!user) throw new Error("Authentication required.");
      // Call the second-stage delete function
      return traceApi.confirmAndDeleteFolderContents({
        folderIdsToDelete: contents.folder_ids,
        traceIdsToDelete: contents.trace_ids,
        originalFolderId: folder.id, // Pass the original ID for the final check
        blobPathsToDelete: contents.blob_paths
      });
    },
    onSuccess: () => {
      toast.success(`Folder "${folder.name}" and its contents deleted.`);
      queryClient.invalidateQueries({ queryKey: [FOLDER_VIEW_QUERY_KEY] });
      setIsDeleteDialogOpen(false); // Close dialog on success
    },
    onError: (error) => {
      toast.error(`Failed to delete folder: ${error.message}`);
      // Optionally close dialog on error too, or leave open?
      // setIsDeleteDialogOpen(false);
    },
  });

  // --- Handlers --- 
  const handleOpenStub = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    onClick();
    setContextMenu(null);
  }, [onClick]);

  const handleRenameStub = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsRenameDialogOpen(true);
    setContextMenu(null);
  }, []);

  const handleMoveStub = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMoveDialogOpen(true);
    setContextMenu(null);
  }, []);

  const handleOpenDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(true);
    setContextMenu(null);
  }, []);

  // Updated handler passed to the DeleteFolderDialog
  const handleConfirmDelete = useCallback((contents: RecursiveFolderContents) => {
     // Trigger the mutation with the fetched contents
     deleteFolder(contents);
  }, [deleteFolder]);

  // Function to open context menu at specific coordinates
  const openContextMenuAtPosition = useCallback((x: number, y: number) => {
    setContextMenu({ x, y });
  }, []);

  // Handler for row right-click
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    openContextMenuAtPosition(event.clientX, event.clientY);
  }, [openContextMenuAtPosition]);

  // Handler for the MoreVertical button click
  const handleOpenContextMenuFromButton = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); // Prevent row click
    const rect = event.currentTarget.getBoundingClientRect();
    // Adjust position slightly to appear near the button
    openContextMenuAtPosition(rect.left - 135, rect.bottom + 5);
  }, [openContextMenuAtPosition]);

  // Handler to prevent event propagation (used on the button container)
   const handleStopPropagation = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
   }, []);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50 transition-colors group"
        onClick={onClick}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        onContextMenu={handleContextMenu} // Add context menu handler to the row
      >
        <TableCell className="pl-6 font-medium">
          <div className="flex items-center">
            <FolderIcon className="h-5 w-5 mr-3 text-blue-500 flex-shrink-0" />
            <span className="truncate" title={folder.name}>{folder.name}</span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">Folder</TableCell>
        <TableCell>&nbsp;</TableCell>
        <TableCell>&nbsp;</TableCell>
        <TableCell>&nbsp;</TableCell>
        <TableCell className="text-muted-foreground">
          {formatRelativeDate(folder.updated_at || folder.created_at)}
        </TableCell>
        <TableCell className="text-right pr-6 py-4">
          <div onClick={handleStopPropagation} className="inline-flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="focus:opacity-100 transition-opacity h-8 w-8 p-0"
                onClick={handleOpenContextMenuFromButton}
                aria-label={`Actions for folder ${folder.name}`}
                disabled={isDeleting} // Disable actions button while delete mutation runs
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <ContextMenuItem
            onClick={!isDeleting ? handleOpenStub : undefined}
            icon={<FolderIcon className="h-4 w-4" />}
          >
             <span className={isDeleting ? "opacity-50 cursor-not-allowed" : ""}>
                Open Folder
             </span>
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
             onClick={!isDeleting ? handleRenameStub : undefined}
             icon={<Edit className="h-4 w-4" />}
          >
             <span className={isDeleting ? "opacity-50 cursor-not-allowed" : ""}>
              Rename
            </span>
          </ContextMenuItem>
           <ContextMenuItem
             onClick={!isDeleting ? handleMoveStub : undefined}
             icon={<Move className="h-4 w-4" />}
           >
             <span className={isDeleting ? "opacity-50 cursor-not-allowed" : ""}>
               Move
             </span>
           </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
            onClick={!isDeleting ? handleOpenDeleteDialog : undefined}
            icon={<Trash2 className="h-4 w-4 text-destructive" />}
          >
             <span className={isDeleting ? "opacity-50 cursor-not-allowed text-destructive" : "text-destructive"}>
               Delete
             </span>
          </ContextMenuItem>
        </ContextMenu>
      )}

      {/* Keep MoveItemDialog, now opened via context menu */}
      {isMoveDialogOpen && (
        <MoveItemDialog
          isOpen={isMoveDialogOpen}
          setIsOpen={setIsMoveDialogOpen}
          itemsToMove={{ traces: [], folders: [folder.id] }}
          itemNames={[folder.name]}
          initialFolderId={folder.parent_folder_id}
        />
      )}

      {/* Rename Dialog */}
      {isRenameDialogOpen && (
        <RenameFolderDialog
          isOpen={isRenameDialogOpen}
          setIsOpen={setIsRenameDialogOpen}
          folderId={folder.id}
          currentName={folder.name}
        />
      )}

      {/* Delete Confirmation Dialog - Updated props */}
      {isDeleteDialogOpen && (
        <DeleteFolderDialog
          isOpen={isDeleteDialogOpen}
          setIsOpen={setIsDeleteDialogOpen}
          folderId={folder.id} // Pass folderId for the query
          folderName={folder.name}
          onConfirm={handleConfirmDelete} // Pass the updated handler
          isPending={isDeleting} // Pass the mutation loading state
        />
      )}
    </>
  );
}

export const FolderItem = memo(FolderItemComponent); 