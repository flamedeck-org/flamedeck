import React, { useState, useEffect, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // Import DialogClose for explicit closing
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FolderPlus } from "lucide-react";

interface CreateFolderDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSubmit: (folderName: string) => void;
  isPending: boolean;
  triggerElement: React.ReactNode;
}

function CreateFolderDialogComponent({
  isOpen,
  setIsOpen,
  onSubmit,
  isPending,
  triggerElement,
}: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        // Delay reset to allow animation
        setFolderName("");
        setError(null);
      }, 150);
    }
  }, [isOpen]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFolderName(event.target.value);
    if (error && event.target.value.trim().length > 0) {
      setError(null); // Clear error once user starts typing valid input
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = folderName.trim();
    if (trimmedName.length === 0) {
      setError("Folder name cannot be empty.");
      return;
    }
    if (trimmedName.length > 255) {
      setError("Folder name is too long (max 255 characters).");
      return;
    }
    // Potentially add other validation (e.g., invalid characters) here
    setError(null);
    onSubmit(trimmedName);
    // Keep dialog open while pending, caller should close on success/error if desired
    // or close immediately:
    // setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{triggerElement}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FolderPlus className="mr-2 h-5 w-5" /> Create New Folder
          </DialogTitle>
          <DialogDescription>
            Enter a name for your new folder. It will be created in the current directory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="create-folder-form">
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Input
                id="folder-name"
                value={folderName}
                onChange={handleInputChange}
                placeholder="e.g., Project Alpha Traces"
                className="w-full"
                aria-describedby={error ? "folder-name-error" : undefined}
                aria-invalid={!!error}
                disabled={isPending}
              />
            </div>
            {error && (
              <p id="folder-name-error" className="text-sm text-destructive -mt-1">
                {error}
              </p>
            )}
          </div>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form="create-folder-form"
            disabled={isPending || !folderName.trim()}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isPending ? "Creating..." : "Create Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const CreateFolderDialog = memo(CreateFolderDialogComponent);
