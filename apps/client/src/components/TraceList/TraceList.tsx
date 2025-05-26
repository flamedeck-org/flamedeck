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
      className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300"
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
      <Button
        size="sm"
        disabled={isCurrentlyLoading}
        variant="primary-outline"
        onClick={() => openTraceUploadModal(null, currentFolderId)}
        className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white border-0 transition-all duration-300"
      >
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
        <Card className="bg-card/90 backdrop-blur-sm border border-border">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/30 flex items-center justify-center">
              <X className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">Error Loading Contents</h3>
            <p className="text-muted-foreground mb-6">
              {error.message}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white border-0 transition-all duration-300"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (isLoading) {
      // Skeleton state for initial load
      return (
        <Card className="bg-card/90 backdrop-blur-sm border border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-background/50 backdrop-blur-sm hover:bg-background/70 border-b border-border">
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
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                  <TableHead className="text-right pr-6 py-3">
                    <Skeleton className="h-9 w-9 float-right" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i} className="border-b border-border">
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
        <Card className="bg-card/90 backdrop-blur-sm border border-border">
          <CardContent className="pt-12 pb-12 text-center">
            {isSearchingAndEmpty ? (
              <>
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-blue-400/20 rounded-xl border border-blue-500/40 flex items-center justify-center">
                  <Search className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-bold mb-2">No matching traces found</h3>
                <p className="text-muted-foreground mb-6">
                  We couldn't find any traces or folders matching "<span className="font-medium text-foreground">{searchQuery}</span>". Try adjusting your search terms.
                </p>
                <Button
                  onClick={handleClearSearch}
                  variant="outline"
                  className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/40 flex items-center justify-center">
                  <FolderIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">
                  {currentFolderId ? 'This folder is empty' : 'No traces yet'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  Drag and drop your first performance trace file.{' '}
                  <Link to="/docs/api-keys" className="text-red-500 hover:text-red-400 hover:underline transition-colors font-medium">
                    Learn about our API
                  </Link>{' '}
                  for programmatic uploads.
                </p>
                <div className="flex justify-center gap-3">
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
                        className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300"
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
                    className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white border-0 transition-all duration-300"
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
      <>
        <Card className="bg-card/90 backdrop-blur-sm border border-border overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-background/50 backdrop-blur-sm hover:bg-background/70 border-b border-border">
                  <TableHead className="pl-6 font-semibold text-foreground">Name</TableHead>
                  <TableHead className="font-semibold text-foreground">Owner</TableHead>
                  <TableHead className="font-semibold text-foreground">Duration</TableHead>
                  <TableHead className="font-semibold text-foreground">Last Updated</TableHead>
                  <TableHead className="text-right pr-6 font-semibold text-foreground">Actions</TableHead>
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
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-sm rounded-full border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-red-500" />
              <span className="text-sm text-muted-foreground font-medium">Loading more traces...</span>
            </div>
          )}
        </div>
      </>
    );
  };

  // Main component structure: Layout, Header, Search are always rendered.
  // renderContent() handles the conditional display of skeletons, errors, empty states, or the list.
  return (
    <PageLayout>
      <PageHeader subtitle={headerSubtitle} title={headerTitle} actions={primaryActions} />
      <div className="mb-6">
        <div className="relative w-full">
          <div className="bg-background/80 backdrop-blur-sm border border-border rounded-lg">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search scenarios, branches, commits..."
              value={localSearchQuery}
              onChange={handleLocalSearchChange}
              className="pl-10 pr-10 bg-transparent border-0 focus:ring-2 focus:ring-red-500/30 hide-native-search-cancel-button"
              aria-label="Search traces"
            />
            {localSearchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7 hover:bg-background border border-border/50 hover:border-border"
                onClick={handleClearSearch}
                aria-label="Clear search"
                disabled={isCurrentlyLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Render the content wrapped with DraggableArea */}
      <DraggableArea
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        isDragging={isDragging}
        draggingClassName="outline-dashed outline-2 outline-offset-[-4px] outline-red-500 rounded-lg p-1 bg-red-500/10"
        baseClassName="p-1"
        className="flex flex-col flex-grow"
      >
        {renderContent()}
      </DraggableArea>
    </PageLayout>
  );
}

const TraceList = memo(TraceListComponent);
export default TraceList;
