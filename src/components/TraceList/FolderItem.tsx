import { memo } from 'react';
import { Folder as FolderIcon } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Folder } from '@/lib/api'; // Assuming Folder type is exported from api.ts

interface FolderItemProps {
  folder: Folder;
  onClick: (folderId: string) => void;
}

function FolderItemComponent({ folder, onClick }: FolderItemProps) {
  const handleRowClick = () => {
    onClick(folder.id);
  };

  // TODO: Adapt TableCell structure to match TraceListItem or desired layout
  return (
    <TableRow
      onClick={handleRowClick}
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      aria-label={`Folder ${folder.name}`}
    >
      <TableCell className="pl-6 font-medium py-5">
        <div className="flex items-center gap-2">
          <FolderIcon className="h-4 w-4 text-sky-500 flex-shrink-0" />
          <span className="truncate">{folder.name}</span>
        </div>
      </TableCell>
      {/* Placeholder cells to match TraceListItem columns - adjust as needed */}
      <TableCell className="text-muted-foreground py-3">Folder</TableCell> {/* Type/Owner */} 
      <TableCell className="py-3"></TableCell> {/* Branch */} 
      <TableCell className="py-3"></TableCell> {/* Commit */} 
      <TableCell className="py-3"></TableCell> {/* Device */} 
      <TableCell className="py-3"></TableCell> {/* Duration */} 
      <TableCell className="text-muted-foreground py-3">
        {/* Display folder updated_at date */} 
        {new Date(folder.updated_at).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        })}
      </TableCell>
      <TableCell className="text-right pr-6 py-3">{/* Actions? Maybe move/delete icons */}</TableCell>
    </TableRow>
  );
}

export const FolderItem = memo(FolderItemComponent); 