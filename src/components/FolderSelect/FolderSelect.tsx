import React, { memo, useCallback, useState } from 'react';
import { Folder, Search, X, AlertCircle, ChevronRight, Home, Loader2 } from 'lucide-react';
import { useFolderNavigation } from './hooks/useFolderNavigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface FolderSelectProps {
  initialFolderId?: string | null;
  onSelectFolder: (folderId: string | null, folderName: string | null) => void;
  // Add a prop to control the visibility or trigger of the parent (e.g., Dialog close)
  onCancel?: () => void;
}

function FolderSelectComponent({
  initialFolderId = null,
  onSelectFolder,
  onCancel,
}: FolderSelectProps) {
  const {
    currentFolderId,
    currentFolder,
    folders,
    path,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    navigateToFolder,
  } = useFolderNavigation(initialFolderId);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);

  const handleFolderClick = useCallback((folderId: string) => {
    navigateToFolder(folderId);
    setSelectedFolderId(folderId); // Tentatively select navigated folder
  }, [navigateToFolder]);

  const handleBreadcrumbClick = useCallback((folderId: string | null) => {
    navigateToFolder(folderId);
    setSelectedFolderId(folderId); // Tentatively select navigated folder
  }, [navigateToFolder]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, [setSearchQuery]);

  const handleSelect = () => {
      const selectedName = selectedFolderId === null
        ? "Root"
        : (Array.isArray(folders) ? folders.find(f => f.id === selectedFolderId)?.name : null) || currentFolder?.name;
      onSelectFolder(selectedFolderId, selectedName || null);
  };

  const renderBreadcrumbs = () => (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-3 flex-wrap">
      <button
        onClick={() => handleBreadcrumbClick(null)}
        className={cn(
          "hover:underline flex items-center",
          'hover:text-primary',
          selectedFolderId === null && 'text-primary font-medium'
        )}
        aria-current={selectedFolderId === null ? "page" : undefined}
      >
        <Home className="h-4 w-4 mr-1.5 flex-shrink-0" />
        Root
      </button>
      {/* Only map if path is defined and is an array */}
      {Array.isArray(path) && path.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <button
            onClick={() => handleBreadcrumbClick(folder.id)}
            className={cn(
              "hover:underline truncate",
              'hover:text-primary',
              selectedFolderId === folder.id && 'text-primary font-medium',
            )}
            aria-current={selectedFolderId === folder.id ? "page" : undefined}
            title={folder.name}
          >
            {folder.name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );

  const renderFolderList = () => {
    if (isLoading) {
      return (
        <div className="space-y-2 mt-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-destructive flex items-center p-4 mt-2 border border-destructive/50 rounded-md bg-destructive/10">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>Error loading folders: {error.message}</span>
        </div>
      );
    }

    if (folders.length === 0 && !searchQuery) {
      return (
        <div className="text-center text-muted-foreground py-6 px-4">
          <Folder className="h-10 w-10 mx-auto mb-2 text-gray-400" />
          <p>This folder is empty.</p>
        </div>
      );
    }

     if (folders.length === 0 && searchQuery) {
        return (
          <div className="text-center text-muted-foreground py-6 px-4">
             <Search className="h-10 w-10 mx-auto mb-2 text-gray-400" />
            <p>No folders found matching "{searchQuery}".</p>
          </div>
        );
      }

    return (
      <ul className="space-y-1 mt-2">
        {folders.map((folder) => (
          <li key={folder.id}>
            <button
              className={cn(
                "w-full text-left flex items-center p-2 rounded-md hover:bg-accent",
                selectedFolderId === folder.id && "bg-accent text-accent-foreground",
              )}
              onClick={() => handleFolderClick(folder.id)}
              title={folder.name}
            >
              <Folder className="h-5 w-5 mr-3 flex-shrink-0" />
              <span className="flex-grow truncate">{folder.name}</span>
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-8 w-full hide-native-search-cancel-button"
          aria-label="Search folders"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1.5 h-7 w-7"
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Breadcrumbs */}
      {renderBreadcrumbs()}

      {/* Folder List */}
      <ScrollArea className="flex-grow border rounded-md p-2 mb-4 min-h-[150px]">
          {renderFolderList()}
      </ScrollArea>

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-2 border-t">
        {onCancel && (
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
        )}
        <Button onClick={handleSelect} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {/* Safely access path */}
            Select "{selectedFolderId === null ? 'Root' : (Array.isArray(path) ? path.find(p => p.id === selectedFolderId)?.name : null) || currentFolder?.name || '...'}"
        </Button>
      </div>
    </div>
  );
}

export const FolderSelect = memo(FolderSelectComponent); 