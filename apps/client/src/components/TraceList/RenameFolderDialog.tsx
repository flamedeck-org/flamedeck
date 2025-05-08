import React, { memo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Folder } from "@/lib/api";
import { traceApi } from "@/lib/api";
import { toast } from "sonner";
import { FOLDER_VIEW_QUERY_KEY } from "./hooks/useTraces"; // Ensure this query key is correct
import type { ApiError, ApiResponse } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface RenameFolderDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  folderId: string;
  currentName: string;
  triggerElement?: React.ReactNode; // Optional trigger
}

function RenameFolderDialogComponent({
  isOpen,
  setIsOpen,
  folderId,
  currentName,
  triggerElement,
}: RenameFolderDialogProps) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState(currentName);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName); // Reset name when dialog opens
    }
  }, [isOpen, currentName]);

  const { mutate: renameFolder, isPending } = useMutation<
    ApiResponse<Folder>,
    ApiError,
    string // Type of the variable passed to mutate function (newName)
  >({
    mutationFn: (updatedName: string) => {
      if (!user) throw new Error("User not authenticated");
      return traceApi.renameFolder(folderId, updatedName, user.id);
    },
    onSuccess: (response) => {
      if (response.data) {
        toast.success(`Successfully renamed folder to "${response.data.name}".`);
        queryClient.invalidateQueries({ queryKey: [FOLDER_VIEW_QUERY_KEY] });
        setIsOpen(false);
      } else if (response.error) {
        // Handle API-level errors returned in the success case (e.g., validation)
        toast.error(`Failed to rename folder: ${response.error.message}`);
      }
    },
    onError: (error: ApiError) => {
      toast.error(`Failed to rename folder: ${error.message}`);
    },
  });

  const handleSave = useCallback(() => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error("Folder name cannot be empty.");
      return;
    }
    if (trimmedName === currentName) {
      setIsOpen(false); // No change, just close
      return;
    }
    renameFolder(trimmedName);
  }, [newName, currentName, renameFolder, setIsOpen]);

  const handleOpenChange = (open: boolean) => {
    if (isPending) return; // Prevent closing while submitting
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* Optional Trigger can be rendered here if needed, but typically handled by the parent */}
      {/* {!triggerElement && <DialogTrigger asChild>...</DialogTrigger>} */}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Folder</DialogTitle>
          <DialogDescription>Enter a new name for the folder "{currentName}".</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="folder-name" className="text-right">
              Name
            </Label>
            <Input
              id="folder-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="col-span-3"
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending) handleSave();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !newName.trim() || newName.trim() === currentName}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const RenameFolderDialog = memo(RenameFolderDialogComponent);
