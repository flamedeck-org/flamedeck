import React, { memo, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FolderSelect } from '@/components/FolderSelect/FolderSelect';
import { traceApi, ApiError } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DIRECTORY_LISTING_QUERY_KEY } from './hooks/useTraces'; // Import the exported key
import { ApiResponse } from '@/types';
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
      // Invalidate queries to refetch data in the source and potentially destination folders
      queryClient.invalidateQueries({ queryKey: [DIRECTORY_LISTING_QUERY_KEY, initialFolderId] });
      queryClient.invalidateQueries({ queryKey: [DIRECTORY_LISTING_QUERY_KEY, targetFolderId] });
      setIsOpen(false);
    },
    onError: (error: ApiError) => {
      toast.error(`Failed to move items: ${error.message}`);
    },
    onSettled: () => {
      // Reset selection state on settle
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
    // Reset state if needed when cancelling after selection
    setSelectedFolderId(null);
    setSelectedFolderName(null);
  }, [setIsOpen]);

  // Determine the display name for the items being moved
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