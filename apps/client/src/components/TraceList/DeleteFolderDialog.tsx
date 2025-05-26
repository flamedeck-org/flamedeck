import { memo, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { traceApi } from '@/lib/api';
import type { RecursiveFolderContents } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

interface DeleteFolderDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  folderId: string;
  folderName: string;
  onConfirm: (contents: RecursiveFolderContents) => void;
  isPending: boolean;
}

const FOLDER_CONTENTS_QUERY_KEY = 'folderContentsForDelete';

function DeleteFolderDialogComponent({
  isOpen,
  setIsOpen,
  folderId,
  folderName,
  onConfirm,
  isPending,
}: DeleteFolderDialogProps) {
  const [confirmInput, setConfirmInput] = useState('');

  const {
    data: contentsData,
    isLoading: isLoadingContents,
    error: contentsError,
  } = useQuery<RecursiveFolderContents, Error>({
    queryKey: [FOLDER_CONTENTS_QUERY_KEY, folderId],
    queryFn: async () => {
      const response = await traceApi.getRecursiveFolderContents(folderId);
      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch folder contents');
      }
      if (!response.data) {
        throw new Error('No data received when fetching folder contents');
      }
      return response.data;
    },
    enabled: isOpen,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
    } else {
      setConfirmInput('');
    }
  }, [isOpen, folderId]);

  const isMatch = confirmInput === folderName;

  const handleConfirmClick = useCallback(() => {
    if (isMatch && !isPending && !isLoadingContents && contentsData) {
      onConfirm(contentsData);
    }
  }, [isMatch, isPending, isLoadingContents, contentsData, onConfirm]);

  const handleOpenChange = (open: boolean) => {
    if (isPending) return;
    setIsOpen(open);
  };

  const renderDescription = () => {
    if (isLoadingContents) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      );
    }
    if (contentsError) {
      return (
        <span className="text-destructive font-medium">
          Error loading contents: {contentsError.message}
        </span>
      );
    }
    if (contentsData) {
      const folderCount = contentsData.folder_ids.length;
      const subFolderCount = Math.max(0, folderCount - 1);
      const traceCount = contentsData.trace_ids.length;

      let contentDescription = ``;
      if (subFolderCount > 0 && traceCount > 0) {
        contentDescription = `containing ${subFolderCount} subfolder(s) and ${traceCount} trace(s)`;
      } else if (subFolderCount > 0) {
        contentDescription = `containing ${subFolderCount} subfolder(s)`;
      } else if (traceCount > 0) {
        contentDescription = `containing ${traceCount} trace(s)`;
      } else if (folderCount === 1 && traceCount === 0) {
        contentDescription = `which is currently empty`;
      }

      return (
        <div className="text-muted-foreground leading-relaxed">
          This action cannot be undone. This will permanently delete the folder{' '}
          <span className="font-bold text-foreground bg-gradient-to-r from-red-500/10 to-yellow-500/10 px-2 py-1 rounded-md border border-red-500/20">
            "{folderName}"
          </span>{' '}
          {contentDescription}.
        </div>
      );
    }
    return 'Loading folder contents...';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm">
        <DialogHeader className="space-y-4">
          <DialogTitle className="flex items-center text-xl font-bold">
            <div className="w-10 h-10 mr-3 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            Permanently Delete Folder?
          </DialogTitle>
          <DialogDescription className="text-base pl-13">
            {renderDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="confirm-folder-name" className="text-sm font-medium text-foreground">
              Folder Name
            </Label>
            <Input
              id="confirm-folder-name"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={folderName}
              className="bg-background/50 backdrop-blur-sm border-border/30 focus:border-red-500/50 focus:ring-red-500/20 transition-all duration-300"
              disabled={isPending || isLoadingContents || !!contentsError}
              aria-describedby="confirm-folder-description"
            />
          </div>
          <p
            id="confirm-folder-description"
            className="text-xs text-muted-foreground text-center bg-muted/30 py-1.5 px-3 rounded-lg backdrop-blur-sm"
          >
            Type <span className="font-semibold text-foreground">{folderName}</span> to enable deletion.
          </p>
        </div>

        <DialogFooter className="gap-3 pt-3">
          <DialogClose asChild>
            <Button
              variant="outline"
              disabled={isPending}
              className="bg-background/50 backdrop-blur-sm border-border/30 hover:bg-background/80 hover:shadow-md transition-all duration-300"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirmClick}
            disabled={!isMatch || isPending || isLoadingContents || !!contentsError}
            aria-label={`Confirm deletion of folder ${folderName}`}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {(isPending || isLoadingContents) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {!isPending && !isLoadingContents ? 'Delete Permanently' : 'Deleting...'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const DeleteFolderDialog = memo(DeleteFolderDialogComponent);
