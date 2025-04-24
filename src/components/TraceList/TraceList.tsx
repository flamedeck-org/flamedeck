import { memo, useState, useEffect, useCallback } from "react";
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
import { FileJson, UploadCloud, Search, X, Folder as FolderIcon, FolderPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PageLayout from "../PageLayout";
import PageHeader from "../PageHeader";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useTraces } from "./hooks/useTraces";
import { TraceListItem } from "./TraceListItem";
import { FolderItem } from "./FolderItem";
import { TracePagination } from './TracePagination';
import { useDebounce } from "@/hooks/useDebounce";
import { Folder } from '@/lib/api';
import { Breadcrumbs } from './Breadcrumbs';

function TraceListComponent() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);

  const {
    folders,
    traces,
    path,
    currentFolderId,
    totalCount,
    totalPages,
    page,
    setPage,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    deleteTrace,
    isDeleting,
    createFolder,
    isCreatingFolder,
  } = useTraces();

  const handleNavigate = useCallback((folderId: string | null) => {
      setPage(0);
      setLocalSearchQuery("");
      setSearchQuery("");
      if (folderId === null) {
          navigate('/traces');
      } else {
          navigate(`/traces/folder/${folderId}`);
      }
  }, [navigate, setPage, setSearchQuery]);

  const handleFolderClick = useCallback((folderId: string) => {
    handleNavigate(folderId);
  }, [handleNavigate]);

  const handleCreateFolder = useCallback(() => {
    const name = prompt("Enter new folder name:");
    if (name && name.trim().length > 0) {
      createFolder({ name: name.trim(), parentFolderId: currentFolderId });
    } else if (name !== null) {
      alert("Folder name cannot be empty.");
    }
  }, [createFolder, currentFolderId]);

  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) {
        setSearchQuery(debouncedSearchQuery);
        setPage(0);
    }
  }, [debouncedSearchQuery, setSearchQuery, setPage, searchQuery]);

  const handleClearSearch = useCallback(() => {
      setLocalSearchQuery("");
      setSearchQuery("");
      if (page !== 0) { 
          setPage(0);
      }
  }, [setSearchQuery, setPage, page]);

  const primaryActions = (
    <div className="flex items-center gap-2">
       <Button 
        size="sm" 
        variant="outline" 
        onClick={handleCreateFolder} 
        disabled={isCreatingFolder}
       >
        <FolderPlus className="mr-2 h-4 w-4" /> {isCreatingFolder ? 'Creating...' : 'New Folder'}
      </Button>
      <Link to="/upload"> 
        <Button size="sm">
          <UploadCloud className="mr-2 h-4 w-4" /> Upload New Trace
        </Button>
      </Link>
    </div>
  );

  const searchInput = (
      <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
              type="search"
              placeholder="Search scenarios, branches, commits..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
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
              >
                  <X className="h-4 w-4" />
              </Button>
          )}
      </div>
  );

  const breadcrumbElement = <Breadcrumbs path={path} onNavigate={handleNavigate} />;

  if (isLoading && folders.length === 0 && traces.length === 0) {
    return (
      <PageLayout>
        <PageHeader 
          title={<Skeleton className="h-8 w-48" />} 
          subtitle={<Skeleton className="h-4 w-64 mt-1" />}
          actions={<div className="flex gap-2"><Skeleton className="h-9 w-28 rounded-md" /><Skeleton className="h-9 w-36 rounded-md" /></div>} 
        />
        <div className="mb-4">{searchInput}</div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-6 py-3"><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead className="py-3"><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead className="py-3"><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead className="py-3"><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead className="py-3"><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead className="py-3"><Skeleton className="h-4 w-12" /></TableHead>
                  <TableHead className="py-3"><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead className="text-right pr-6 py-3"><Skeleton className="h-9 w-9 float-right" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6 py-3"><Skeleton className="h-4 w-3/4" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-1/2" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-1/4" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-1/4" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-1/3" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-1/5" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-1/2" /></TableCell>
                    <TableCell className="text-right pr-6 py-3"><Skeleton className="h-9 w-9 float-right" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <PageHeader 
          subtitle={breadcrumbElement}
          title="Performance Traces" 
          actions={primaryActions} 
        />
        <div className="mb-4">{searchInput}</div>
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-destructive mb-4">Error loading contents: {error.message}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  if (!isLoading && folders.length === 0 && traces.length === 0) {
    const isSearching = !!searchQuery;
    return (
      <PageLayout>
        <PageHeader 
          subtitle={breadcrumbElement}
          title="Performance Traces" 
          actions={primaryActions} 
        />
        <div className="mb-4">{searchInput}</div>
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            {currentFolderId ? 
              <FolderIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" /> : 
              <FileJson className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            }
            <h3 className="text-xl font-medium mb-2">
              {isSearching ? "No Results Found" : (currentFolderId ? "Folder is Empty" : "No Items Yet")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {isSearching
                ? `Your search for "${searchQuery}" did not match any items in this folder.`
                : (currentFolderId ? "This folder doesn't contain any traces or subfolders." : "Create a folder or upload your first trace.")
              }
            </p>
            {isSearching ? (
              <Button onClick={handleClearSearch} variant="outline" size="sm">Clear Search</Button>
            ) : (
              <div className="flex justify-center gap-2">
                <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleCreateFolder} 
                    disabled={isCreatingFolder}
                >
                    <FolderPlus className="mr-2 h-4 w-4" /> {isCreatingFolder ? 'Creating...' : 'New Folder'}
                </Button>
                <Link to="/upload">
                    <Button size="sm"><UploadCloud className="mr-2 h-4 w-4" /> Upload Trace</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader 
        subtitle={breadcrumbElement}
        title="Performance Traces" 
        actions={primaryActions} 
      />
      <div className="mb-4">{searchInput}</div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {folders.map((folder) => (
                <FolderItem 
                  key={`folder-${folder.id}`} 
                  folder={folder} 
                  onClick={handleFolderClick} 
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
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TracePagination 
        currentPage={page} 
        totalPages={totalPages} 
        onPageChange={setPage} 
      />
    </PageLayout>
  );
}

const TraceList = memo(TraceListComponent);
export default TraceList;
