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

interface FolderItemProps {
  folder: Folder;
  onClick: () => void;
}

function FolderItemComponent({ folder, onClick }: FolderItemProps) {
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false); // State for rename dialog
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  // Add state for delete confirmation if needed later
  // const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // --- Stub Handlers for Context Menu Actions ---
  const handleOpenStub = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    console.log("Open action triggered for folder:", folder.id);
    onClick(); // Use existing onClick for now
    setContextMenu(null);
  }, [onClick, folder.id]);

  const handleRenameStub = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsRenameDialogOpen(true); // Open the rename dialog
    setContextMenu(null);
  }, []);

  const handleMoveStub = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    console.log("Move action triggered for folder:", folder.id);
    setIsMoveDialogOpen(true); // Open the existing move dialog
    setContextMenu(null);
  }, [folder.id]);

  const handleDeleteStub = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    console.log("Delete action triggered for folder:", folder.id);
    // TODO: Implement delete logic (e.g., open a confirmation dialog)
    // setIsDeleteDialogOpen(true);
    setContextMenu(null);
  }, [folder.id]);
  // --- End Stub Handlers ---

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
            onClick={handleOpenStub}
            icon={<FolderIcon className="h-4 w-4" />} // Use FolderIcon for open
          >
            Open Folder
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
            onClick={handleRenameStub}
            icon={<Edit className="h-4 w-4" />}
          >
            Rename
          </ContextMenuItem>
           {/* Keep MoveItemDialog logic but trigger via context menu */}
           <ContextMenuItem
             onClick={handleMoveStub} // Use the stub which opens the dialog
             icon={<Move className="h-4 w-4" />}
           >
             Move
           </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
            onClick={handleDeleteStub}
            icon={<Trash2 className="h-4 w-4 text-destructive" />}
          >
            <span className="text-destructive">Delete</span>
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

      {/* Placeholder for Delete Confirmation Dialog */}
      {/* {isDeleteDialogOpen && ( ... AlertDialog ... )} */}
    </>
  );
}

export const FolderItem = memo(FolderItemComponent); 