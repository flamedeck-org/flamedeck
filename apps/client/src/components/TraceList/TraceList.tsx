import { memo, useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Link, useNavigate } from "react-router-dom";
import {
  FileJson,
  UploadCloud,
  Search,
  X,
  Folder as FolderIcon,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PageLayout from "../PageLayout";
import PageHeader from "../PageHeader";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useTraces } from "./hooks/useTraces";
import { TraceListItem } from "./TraceListItem";
import { FolderItem } from "./FolderItem";
import { useDebounce } from "@/hooks/useDebounce";
import { Breadcrumbs } from "./Breadcrumbs";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { useInView } from "react-intersection-observer";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UploadDialog } from "@/components/UploadDialog";
import { DraggableArea } from "@/components/DraggableArea";
import type { Folder } from "@/lib/api/types";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ApiResponse } from "@/types";

function TraceListComponent() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);

  // State for drag-and-drop upload modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const {
    folders,
    traces,
    path,
    currentFolder,
    currentFolderId,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    deleteTrace,
    isDeleting,
    createFolder,
    isCreatingFolder,
  } = useTraces();

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleNavigate = useCallback(
    (folderId: string | null) => {
      setLocalSearchQuery("");
      setSearchQuery("");
      window.scrollTo(0, 0);
      if (folderId === null) {
        navigate("/traces");
      } else {
        navigate(`/traces/folder/${folderId}`);
      }
    },
    [navigate, setSearchQuery]
  );

  const handleFolderClick = useCallback(
    (folderId: string) => {
      handleNavigate(folderId);
    },
    [handleNavigate]
  );

  const handleOpenCreateFolderDialog = useCallback(() => {
    setIsCreateFolderDialogOpen(true);
  }, []);

  const handleDialogSubmit = useCallback(
    (folderName: string) => {
      createFolder(
        { name: folderName, parentFolderId: currentFolderId },
        {
          onSuccess: (response: ApiResponse<Folder>) => {
            setIsCreateFolderDialogOpen(false);
            if (response.data) {
              handleNavigate(response.data.id);
            } else {
              console.warn("Folder creation succeeded but no data returned.");
            }
          },
          onError: (error: PostgrestError) => {
            console.error("Error creating folder:", error);
            toast({
              title: "Error creating folder",
              description: error.message,
              variant: "destructive",
            });
          },
        }
      );
    },
    [createFolder, currentFolderId, handleNavigate, toast]
  );

  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) {
      setSearchQuery(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, setSearchQuery, searchQuery]);

  const handleLocalSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchQuery(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery("");
    setSearchQuery("");
  }, [setSearchQuery]);

  // --- Drag and Drop Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.size > 100 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: "Maximum file size is 100MB.",
            variant: "destructive",
          });
          return;
        }

        setDroppedFile(file);
        setIsUploadModalOpen(true);
      }
    },
    [toast]
  );

  const handleCloseUploadModal = useCallback(() => {
    setIsUploadModalOpen(false);
    setDroppedFile(null);
  }, []);

  // --- UI Elements ---

  // Determine if currently loading (initial or subsequent fetch)
  const isCurrentlyLoading = isLoading || isFetchingNextPage;

  const createFolderButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={handleOpenCreateFolderDialog}
      disabled={isCreatingFolder || isCurrentlyLoading}
    >
      <FolderPlus className="mr-2 h-4 w-4" /> New Folder
    </Button>
  );

  const primaryActions = (
    <div className="flex items-center gap-2">
      <CreateFolderDialog
        isOpen={isCreateFolderDialogOpen}
        setIsOpen={setIsCreateFolderDialogOpen}
        onSubmit={handleDialogSubmit}
        isPending={isCreatingFolder}
        triggerElement={createFolderButton}
      />
      <Link to="/upload" state={{ targetFolderId: currentFolderId }}>
        <Button size="sm" disabled={isCurrentlyLoading} variant="primary-outline">
          <UploadCloud className="mr-2 h-4 w-4" /> Upload New Trace
        </Button>
      </Link>
    </div>
  );

  const breadcrumbElement = <Breadcrumbs path={path} onNavigate={handleNavigate} />;
  const headerTitle = currentFolderId
    ? currentFolder?.name || "Loading folder..."
    : "Performance Traces";
  const headerSubtitle = isLoading ? <Skeleton className="h-5 w-64 mt-1" /> : breadcrumbElement;

  // --- Conditional Content Rendering Logic ---

  const renderContent = () => {
    if (error) {
      return (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-destructive mb-4">Error loading contents: {error.message}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      );
    }

    if (isLoading) {
      // Skeleton state for initial load
      return (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-6 py-3">
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                  <TableHead className="py-3">
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                  <TableHead className="py-3">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="py-3">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="py-3">
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                  <TableHead className="py-3">
                    <Skeleton className="h-4 w-12" />
                  </TableHead>
                  <TableHead className="py-3">
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                  <TableHead className="text-right pr-6 py-3">
                    <Skeleton className="h-9 w-9 float-right" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6 py-3">
                      <Skeleton className="h-4 w-3/4" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-1/2" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-1/4" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-1/4" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-1/3" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-1/5" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-1/2" />
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3">
                      <Skeleton className="h-9 w-9 float-right" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      );
    }

    const isEmpty = folders.length === 0 && traces.length === 0;
    const isSearchingAndEmpty = isEmpty && !!searchQuery;

    if (isEmpty) {
      // Empty State Rendering (different messages for empty folder vs empty search)
      return (
        <Card>
          <DraggableArea
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            isDragging={isDragging}
            draggingClassName="outline-dashed outline-2 outline-offset-[-4px] outline-primary rounded-lg p-1"
            baseClassName="p-1" // Ensure consistent padding
            className="pt-12 pb-12 text-center flex flex-col justify-center items-center"
          >
            <CardContent className="p-0">
              {" "}
              {/* Remove padding from CardContent itself */}
              {isSearchingAndEmpty ? (
                <Search className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              ) : currentFolderId ? (
                <FolderIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              ) : (
                <FileJson className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              )}
              <h3 className="text-xl font-medium mb-2">
                {isSearchingAndEmpty
                  ? "No Results Found"
                  : currentFolderId
                    ? "Folder is Empty"
                    : "No Items Yet"}
              </h3>
              <p className="text-muted-foreground mb-6">
                {isSearchingAndEmpty
                  ? `Your search for "${searchQuery}" did not match any items.`
                  : currentFolderId
                    ? "This folder doesn\'t contain any traces or subfolders."
                    : "Create a folder or upload your first trace."}
              </p>
              {isSearchingAndEmpty ? (
                <Button onClick={handleClearSearch} variant="outline" size="sm">
                  Clear Search
                </Button>
              ) : (
                <div className="flex justify-center gap-2">
                  <CreateFolderDialog
                    isOpen={isCreateFolderDialogOpen}
                    setIsOpen={setIsCreateFolderDialogOpen}
                    onSubmit={handleDialogSubmit}
                    isPending={isCreatingFolder}
                    triggerElement={createFolderButton}
                  />
                  <Link to="/upload" state={{ targetFolderId: currentFolderId }}>
                    <Button variant="primary-outline" size="sm" disabled={isCurrentlyLoading}>
                      <UploadCloud className="mr-2 h-4 w-4" /> Upload Trace
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </DraggableArea>
        </Card>
      );
    }

    // Default: List Rendering
    return (
      <DraggableArea
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        isDragging={isDragging}
        draggingClassName="outline-dashed outline-2 outline-offset-[-4px] outline-primary rounded-lg p-1"
        baseClassName="p-1"
        className="flex flex-col flex-grow"
      >
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folders.map((folder) => (
                  <FolderItem
                    key={`folder-${folder.id}`}
                    folder={folder}
                    onClick={() => handleFolderClick(folder.id)}
                  />
                ))}
                {traces.map((trace) => (
                  <TraceListItem
                    key={`trace-${trace.id}`}
                    trace={trace}
                    currentUser={currentUser}
                    onDelete={deleteTrace}
                    isDeleting={isDeleting}
                    onClick={() => navigate(`/traces/${trace.id}`)}
                    currentFolderId={currentFolderId}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div ref={loadMoreRef} className="h-10 flex justify-center items-center">
          {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
      </DraggableArea>
    );
  };

  // --- Upload Dialog ---
  const uploadDialog = (
    <Dialog
      open={isUploadModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleCloseUploadModal();
        }
      }}
    >
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Upload Dropped Trace</DialogTitle>
        </DialogHeader>
        {droppedFile && (
          <UploadDialog
            initialFolderId={currentFolderId}
            initialFile={droppedFile}
            onClose={handleCloseUploadModal}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  // Main component structure: Layout, Header, Search are always rendered.
  // renderContent() handles the conditional display of skeletons, errors, empty states, or the list.
  return (
    <PageLayout>
      <PageHeader subtitle={headerSubtitle} title={headerTitle} actions={primaryActions} />
      <div className="mb-4">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search scenarios, branches, commits..."
            value={localSearchQuery}
            onChange={handleLocalSearchChange}
            className="pl-8 pr-8 w-full hide-native-search-cancel-button"
            aria-label="Search traces"
          />
          {localSearchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1.5 h-7 w-7"
              onClick={handleClearSearch}
              aria-label="Clear search"
              disabled={isCurrentlyLoading} // Use combined loading state
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Render the content based on state */}
      {renderContent()}

      {/* Render extracted upload dialog */}
      {uploadDialog}
    </PageLayout>
  );
}

const TraceList = memo(TraceListComponent);
export default TraceList;
