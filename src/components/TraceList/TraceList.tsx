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
import { FileJson, UploadCloud, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PageLayout from "../PageLayout";
import PageHeader from "../PageHeader";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useTraces } from "./hooks/useTraces";
import { TraceListItem } from "./TraceListItem";
import { TracePagination } from './TracePagination';
import { useDebounce } from "@/hooks/useDebounce"; // Import from new location

function TraceListComponent() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [localSearchQuery, setLocalSearchQuery] = useState(""); // Local state for input
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300); // Debounce input

  const {
    traces,
    totalCount,
    totalPages,
    page,
    setPage,
    searchQuery, // Get the actual query used for fetching
    setSearchQuery, // Get the setter for the debounced query
    isLoading,
    error,
    deleteTrace,
    isDeleting,
  } = useTraces();

  // Update the hook's searchQuery only when debounced value changes
  useEffect(() => {
    // Avoid unnecessary updates if the debounced value hasn't changed
    if (debouncedSearchQuery !== searchQuery) {
        setSearchQuery(debouncedSearchQuery);
        setPage(0); // Reset page to 0 when search query changes
    }
  }, [debouncedSearchQuery, setSearchQuery, setPage, searchQuery]);

  // Handle clearing the search
  const handleClearSearch = useCallback(() => {
      setLocalSearchQuery("");
      // Directly set the hook's search query to trigger refetch immediately
      setSearchQuery(""); 
      // Reset page as well
      if (page !== 0) { 
          setPage(0);
      }
  }, [setSearchQuery, setPage, page]);

  const uploadAction = (
    <Link to="/upload">
      <Button size="sm">
        <UploadCloud className="mr-2 h-4 w-4" /> Upload New Trace
      </Button>
    </Link>
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

  if (isLoading && totalCount === 0) {
    return (
      <PageLayout>
        <PageHeader 
          title={<Skeleton className="h-8 w-48" />} 
          actions={<Skeleton className="h-9 w-36 rounded-md" />} 
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
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6 py-3"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="py-3"><Skeleton className="h-4 w-full" /></TableCell>
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
        <PageHeader title="Performance Traces" actions={uploadAction} />
        <div className="mb-4">{searchInput}</div>
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-destructive mb-4">Error loading traces: {error.message}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  if (!isLoading && traces.length === 0) {
    return (
      <PageLayout>
        <PageHeader
          title="Performance Traces"
          actions={uploadAction}
        />
        <div className="mb-4">{searchInput}</div>
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <FileJson className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">
              {searchQuery ? "No Results Found" : "No Traces Yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? `Your search for "${searchQuery}" did not match any traces.`
                : "Upload your first performance trace to get started."
              }
            </p>
            {searchQuery ? (
              <Button onClick={handleClearSearch} variant="outline" size="sm">
                Clear Search
              </Button>
            ) : (
              <Link to="/upload">
                <Button size="sm"><UploadCloud className="mr-2 h-4 w-4" /> Upload Trace</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Performance Traces" actions={uploadAction} />
      <div className="mb-4">{searchInput}</div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6">Scenario</TableHead>
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
              {traces.map((trace) => (
                <TraceListItem
                  key={trace.id}
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
