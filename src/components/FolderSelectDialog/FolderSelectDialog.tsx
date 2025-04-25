import React, { memo, useCallback } from 'react';
import {
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from '@/components/ui/dialog';
import { FolderSelect } from '@/components/FolderSelect/FolderSelect';

interface FolderSelectDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onFolderSelected: (folderId: string | null, folderName: string | null) => void;
  initialFolderId?: string | null;
  title?: string;
  description?: string;
  triggerElement?: React.ReactNode;
}

function FolderSelectDialogComponent({
  isOpen,
  setIsOpen,
  onFolderSelected,
  initialFolderId,
  title = "Select Folder",
  description = "Choose a destination folder.",
  triggerElement,
}: FolderSelectDialogProps) {

  const handleSelect = useCallback((folderId: string | null, folderName: string | null) => {
    onFolderSelected(folderId, folderName);
    setIsOpen(false); // Close dialog on selection
  }, [onFolderSelected, setIsOpen]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {triggerElement}
      <DialogContent className="sm:max-w-[525px] h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-grow min-h-0 py-4">
          <FolderSelect
            initialFolderId={initialFolderId}
            onSelectFolder={handleSelect} // Use the renamed prop
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const FolderSelectDialog = memo(FolderSelectDialogComponent); 