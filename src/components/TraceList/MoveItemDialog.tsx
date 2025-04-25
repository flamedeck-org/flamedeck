import React, { memo, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FolderSelect } from '@/components/FolderSelect/FolderSelect';
import { traceApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FOLDER_VIEW_QUERY_KEY } from './hooks/useTraces';
import { ApiError, ApiResponse } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface MoveItemDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  itemsToMove: { traces: string[]; folders: string[] };
  itemNames: string[]; // For display purposes in the dialog
  initialFolderId?: string | null; // Current location of the items
  triggerElement?: React.ReactNode; // Optional trigger
}

function MoveItemDialogComponent({ 
  isOpen,
  setIsOpen,
  itemsToMove,
  itemNames,
  initialFolderId,
  triggerElement 
}: MoveItemDialogProps) {
  const queryClient = useQueryClient();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const { user } = useAuth();

  const { mutate: moveItems, isPending: isMoving } = useMutation<
    ApiResponse<void>,
    ApiError,
    string | null
  >({
    mutationFn: (targetFolderId: string | null) => traceApi.moveItems(itemsToMove, user?.id, targetFolderId),
    onSuccess: (_, targetFolderId) => {
      toast.success(`Successfully moved ${itemNames.length} item(s) to "${selectedFolderName || 'Root'}".`);
      queryClient.invalidateQueries({ queryKey: [FOLDER_VIEW_QUERY_KEY] });
      setIsOpen(false);
    },
    onError: (error: ApiError) => {
      toast.error(`Failed to move items: ${error.message}`);
    },
    onSettled: () => {
      setSelectedFolderId(null);
      setSelectedFolderName(null);
    }
  });

  const handleConfirmMove = useCallback((folderId: string | null, folderName: string | null) => {
    if (folderId === initialFolderId) {
      toast.info("Cannot move items to their current location.");
      return;
    }
    setSelectedFolderName(folderName);
    moveItems(folderId);
  }, [initialFolderId, moveItems]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setSelectedFolderId(null);
    setSelectedFolderName(null);
  }, [setIsOpen]);

  const itemsDisplay = itemNames.length === 1 
    ? `"${itemNames[0]}"` 
    : `${itemNames.length} items`;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {triggerElement}
      <DialogContent className="sm:max-w-[525px] h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Move {itemsDisplay}</DialogTitle>
          <DialogDescription>
            Select the destination folder. You cannot move items into their current location.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow min-h-0 py-4">
          <FolderSelect 
            onConfirmSelection={handleConfirmMove}
            onCancel={handleCancel} 
            currentLocationFolderId={initialFolderId}
            initialFolderId={initialFolderId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const MoveItemDialog = memo(MoveItemDialogComponent); 