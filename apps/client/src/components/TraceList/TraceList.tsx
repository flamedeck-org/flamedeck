import { memo, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileJson,
  UploadCloud,
  Search,
  X,
  Folder as FolderIcon,
  FolderPlus,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PageLayout from '../PageLayout';
import PageHeader from '../PageHeader';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useTraces } from './hooks/useTraces';
import { TraceListItem } from './TraceListItem';
import { FolderItem } from './FolderItem';
import { useDebounce } from '@/hooks/useDebounce';
import { Breadcrumbs } from './Breadcrumbs';
import { CreateFolderDialog } from './CreateFolderDialog';
import { useTraceUploadModal } from '@/hooks/useTraceUploadModal';
import { useInView } from 'react-intersection-observer';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UploadDialog } from '@/components/UploadDialog';
import { DraggableArea } from '@/components/DraggableArea';
import type { Folder } from '@/lib/api/types';
import type { PostgrestError } from '@supabase/supabase-js';
import type { ApiResponse } from '@/types';

function TraceListComponent() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);

  // State for drag-and-drop upload modal
  const { openModal: openUploadModal } = useTraceUploadModal();
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

  const { openModal: openTraceUploadModal, closeModal: closeTraceUploadModal } = useTraceUploadModal();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleNavigate = useCallback(
    (folderId: string | null) => {
      setLocalSearchQuery('');
      setSearchQuery('');
      window.scrollTo(0, 0);
      if (folderId === null) {
        navigate('/traces');
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
              console.warn('Folder creation succeeded but no data returned.');
            }
          },
          onError: (error: PostgrestError) => {
            console.error('Error creating folder:', error);
            toast({
              title: 'Error creating folder',
              description: error.message,
              variant: 'destructive',
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
    setLocalSearchQuery('');
    setSearchQuery('');
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
            title: 'File too large',
            description: 'Maximum file size is 100MB.',
            variant: 'destructive',
          });
          return;
        }
        openUploadModal(file, currentFolderId);
      }
    },
    [toast, openUploadModal, currentFolderId]
  );

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
      <Button size="sm" disabled={isCurrentlyLoading} variant="primary-outline" onClick={() => openTraceUploadModal(null, currentFolderId)}>
        <UploadCloud className="mr-2 h-4 w-4" /> Upload New Trace
      </Button>
    </div>
  );

  const breadcrumbElement = <Breadcrumbs path={path} onNavigate={handleNavigate} />;
  const headerTitle = currentFolderId
    ? currentFolder?.name || 'Loading folder...'
    : 'Performance Traces';
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
          <CardContent className="pt-12 pb-12 text-center">
            {isSearchingAndEmpty ? (
              <>
                <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No matching traces found</h3>
                <p className="text-muted-foreground mb-4">
                  We couldn't find any traces or folders matching "{searchQuery}". Try adjusting your search terms.
                </p>
                <Button onClick={handleClearSearch} variant="outline">
                  <X className="mr-2 h-4 w-4" />
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <FolderIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {currentFolderId ? 'This folder is empty' : 'No traces yet'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  Get started by uploading your first performance trace file.{' '}
                  <Link to="/docs/api-keys" className="text-primary hover:underline">
                    Learn about our API
                  </Link>{' '}
                  for programmatic uploads.
                </p>
                <div className="flex justify-center gap-2">
                  <CreateFolderDialog
                    isOpen={isCreateFolderDialogOpen}
                    setIsOpen={setIsCreateFolderDialogOpen}
                    onSubmit={handleDialogSubmit}
                    isPending={isCreatingFolder}
                    triggerElement={
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isCreatingFolder || isCurrentlyLoading}
                      >
                        <FolderPlus className="mr-2 h-4 w-4" />
                        New Folder
                      </Button>
                    }
                  />
                  <Button
                    variant="primary-outline"
                    size="sm"
                    disabled={isCurrentlyLoading}
                    onClick={() => openTraceUploadModal(null, currentFolderId)}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload New Trace
                  </Button>
                </div>
              </>
            )}
          </CardContent>
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
    </PageLayout>
  );
}

const TraceList = memo(TraceListComponent);
export default TraceList;
