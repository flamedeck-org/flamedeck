import React, { memo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { traceApi } from "@/lib/api";
import type { RecursiveFolderContents } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface DeleteFolderDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  folderId: string;
  folderName: string;
  onConfirm: (contents: RecursiveFolderContents) => void;
  isPending: boolean;
}

const FOLDER_CONTENTS_QUERY_KEY = "folderContentsForDelete";

function DeleteFolderDialogComponent({
  isOpen,
  setIsOpen,
  folderId,
  folderName,
  onConfirm,
  isPending,
}: DeleteFolderDialogProps) {
  const [confirmInput, setConfirmInput] = useState("");

  const {
    data: contentsData,
    isLoading: isLoadingContents,
    error: contentsError,
    refetch,
  } = useQuery<RecursiveFolderContents, Error>({
    queryKey: [FOLDER_CONTENTS_QUERY_KEY, folderId],
    queryFn: async () => {
      const response = await traceApi.getRecursiveFolderContents(folderId);
      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch folder contents");
      }
      if (!response.data) {
        throw new Error("No data received when fetching folder contents");
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
      setConfirmInput("");
    } else {
      setConfirmInput("");
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
      return <Skeleton className="h-4 w-4/5" />;
    }
    if (contentsError) {
      return (
        <span className="text-destructive">Error loading contents: {contentsError.message}</span>
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
        <>
          This action cannot be undone. This will permanently delete the folder
          <strong className="mx-1">"{folderName}"</strong>
          {contentDescription}.
        </>
      );
    }
    return "Loading folder contents...";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-destructive" /> Permanently Delete Folder?
          </DialogTitle>
          <DialogDescription>{renderDescription()}</DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Please type the name of the folder to confirm deletion.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="confirm-folder-name" className="text-right">
              Folder Name
            </Label>
            <Input
              id="confirm-folder-name"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={folderName}
              className="col-span-3"
              disabled={isPending || isLoadingContents || !!contentsError}
              aria-describedby="confirm-folder-description"
            />
          </div>
          <p
            id="confirm-folder-description"
            className="text-xs text-muted-foreground px-1 col-span-4 text-center"
          >
            Type <span className="font-semibold">{folderName}</span> to enable deletion.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirmClick}
            disabled={!isMatch || isPending || isLoadingContents || !!contentsError}
            aria-label={`Confirm deletion of folder ${folderName}`}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoadingContents ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {!isPending && !isLoadingContents ? "Delete Permanently" : "Deleting..."}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const DeleteFolderDialog = memo(DeleteFolderDialogComponent);
