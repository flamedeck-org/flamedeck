import { memo, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Folder } from '@/lib/api';
import { traceApi } from '@/lib/api';
import { toast } from 'sonner';
import { FOLDER_VIEW_QUERY_KEY } from './hooks/useTraces'; // Ensure this query key is correct
import type { ApiError, ApiResponse } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, FolderEdit, X } from 'lucide-react';

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
      if (!user) throw new Error('User not authenticated');
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
      toast.error('Folder name cannot be empty.');
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
      <DialogContent className="sm:max-w-[425px] bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center text-xl font-bold">
            <div className="w-10 h-10 mr-3 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-xl border border-green-500/30 flex items-center justify-center">
              <FolderEdit className="h-5 w-5 text-green-500" />
            </div>
            Rename Folder
          </DialogTitle>
          <DialogDescription className="text-base pl-13 text-muted-foreground leading-relaxed">
            Enter a new name for the folder{' '}
            <span className="font-bold text-foreground bg-gradient-to-r from-green-500/10 to-blue-500/10 px-2 py-1 rounded-md border border-green-500/20">
              "{currentName}"
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name" className="text-sm font-medium text-foreground">
              Name
            </Label>
            <Input
              id="folder-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-background/50 backdrop-blur-sm transition-all duration-300"
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending) handleSave();
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isPending}
            className="bg-background/50 backdrop-blur-sm border-border/30 hover:bg-background/80 hover:shadow-md transition-all duration-300"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !newName.trim() || newName.trim() === currentName}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const RenameFolderDialog = memo(RenameFolderDialogComponent);
