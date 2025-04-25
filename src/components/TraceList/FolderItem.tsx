import React, { memo, useState } from 'react';
import { Folder as FolderIcon, Trash2, Edit, Move } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Folder } from '@/lib/api'; // Assuming Folder type is exported from api.ts
import { formatRelativeDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { MoveItemDialog } from './MoveItemDialog';

interface FolderItemProps {
  folder: Folder;
  onClick: () => void;
}

function FolderItemComponent({ folder, onClick }: FolderItemProps) {
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);

  const handleDropdownSelect = (event: Event) => {
    event.stopPropagation();
  };

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50 transition-colors group"
        onClick={onClick}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      >
        <TableCell className="pl-6 font-medium">
          <div className="flex items-center">
            <FolderIcon className="h-5 w-5 mr-3 text-blue-500 flex-shrink-0" />
            <span className="truncate" title={folder.name}>{folder.name}</span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">Folder</TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell className="text-muted-foreground">
          {formatRelativeDate(folder.updated_at || folder.created_at)}
        </TableCell>
        <TableCell className="text-right pr-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={handleDropdownSelect}>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Folder Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onSelect={handleDropdownSelect}>
              <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onClick()}}>Open</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsMoveDialogOpen(true)}>
                <Move className="mr-2 h-4 w-4" /> Move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {isMoveDialogOpen && (
        <MoveItemDialog
          isOpen={isMoveDialogOpen}
          setIsOpen={setIsMoveDialogOpen}
          itemsToMove={{ traces: [], folders: [folder.id] }}
          itemNames={[folder.name]}
          initialFolderId={folder.parent_folder_id}
        />
      )}
    </>
  );
}

export const FolderItem = memo(FolderItemComponent); 