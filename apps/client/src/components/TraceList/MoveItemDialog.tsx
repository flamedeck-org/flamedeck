import React, { memo, useState, useCallback } from "react";
import { FolderSelectDialog } from "@/components/FolderSelectDialog";
import { traceApi } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FOLDER_VIEW_QUERY_KEY } from "./hooks/useTraces";
import type { ApiError, ApiResponse } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

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
  triggerElement,
}: MoveItemDialogProps) {
  const queryClient = useQueryClient();
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const { user } = useAuth();

  const { mutate: moveItems, isPending: isMoving } = useMutation<
    ApiResponse<void>,
    ApiError,
    string | null
  >({
    mutationFn: (targetFolderId: string | null) =>
      traceApi.moveItems(itemsToMove, user?.id, targetFolderId),
    onSuccess: (_, targetFolderId) => {
      toast.success(
        `Successfully moved ${itemNames.length} item(s) to "${selectedFolderName || "Root"}".`
      );
      queryClient.invalidateQueries({ queryKey: [FOLDER_VIEW_QUERY_KEY] });
      setIsOpen(false);
    },
    onError: (error: ApiError) => {
      toast.error(`Failed to move items: ${error.message}`);
    },
  });

  const handleConfirmMove = useCallback(
    (folderId: string | null, folderName: string | null) => {
      if (folderId === initialFolderId) {
        toast.info("Cannot move items to their current location.");
        return;
      }
      setSelectedFolderName(folderName);
      moveItems(folderId);
    },
    [initialFolderId, moveItems, setSelectedFolderName]
  );

  const itemsDisplay = itemNames.length === 1 ? `"${itemNames[0]}"` : `${itemNames.length} items`;

  return (
    <FolderSelectDialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onFolderSelected={handleConfirmMove}
      initialFolderId={initialFolderId}
      title={`Move ${itemsDisplay}`}
      description="Select the destination folder. Items cannot be moved to their current location."
      triggerElement={triggerElement}
    />
  );
}

export const MoveItemDialog = memo(MoveItemDialogComponent);
