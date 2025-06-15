import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Trash2, Eye, Share2, MoreVertical } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

interface TraceDetailHeaderActionsProps {
  traceId: string;
  trace: {
    id: string;
    blob_path?: string;
    scenario?: string;
  } | null;
  onShareClick: () => void;
  deleteMutation: UseMutationResult<any, Error, string, unknown>;
}

function TraceDetailHeaderActions({
  traceId,
  trace,
  onShareClick,
  deleteMutation,
}: TraceDetailHeaderActionsProps) {
  const exploreTraceLink = `/traces/${traceId}/view?blob=${encodeURIComponent(trace?.blob_path || '')}`;
  const exploreTraceState = { blobPath: trace?.blob_path };

  return (
    <>
      {/* Desktop Layout - Hidden on mobile */}
      <div className="hidden md:flex items-center gap-3">
        {/* Primary action button with gradient */}
        <Link
          to={exploreTraceLink}
          state={exploreTraceState}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white border-0 transition-all duration-300 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
        >
          <Eye className="mr-2 h-4 w-4" /> Explore Trace
        </Link>

        <div className="flex items-center gap-2">
          {/* Share button with glassmorphic design */}
          <Button
            variant="outline"
            size="sm"
            onClick={onShareClick}
            aria-label="Share Trace"
            className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          {/* Delete button with enhanced styling */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={deleteMutation.isPending}
                aria-label="Delete Trace"
                className="bg-background/80 backdrop-blur-sm border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 text-red-600 hover:text-red-700 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-background/95 backdrop-blur-lg border border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the trace{' '}
                  <strong>{trace?.scenario || `ID: ${trace?.id?.substring(0, 7)}`}</strong> and all
                  associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => traceId && deleteMutation.mutate(traceId)}
                  disabled={deleteMutation.isPending}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 transition-all duration-300"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Back button with glassmorphic design */}
          <Link
            to="/traces"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Traces
          </Link>
        </div>
      </div>

      {/* Mobile Layout - Dropdown menu, visible only on mobile */}
      <div className="flex md:hidden items-center gap-3">
        {/* Primary action button - always visible on mobile */}
        <Link
          to={exploreTraceLink}
          state={exploreTraceState}
          className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white border-0 transition-all duration-300 shadow-sm hover:shadow-md"
        >
          <Eye className="h-4 w-4" />
          <span className="ml-2 hidden xs:inline">Explore</span>
        </Link>

        {/* Dropdown menu for secondary actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden group"
            >
              {/* Background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <MoreVertical className="h-4 w-4 relative z-10" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-background/95 backdrop-blur-lg border border-border shadow-xl rounded-xl p-2 min-w-[160px] w-48"
          >
            <DropdownMenuItem
              onClick={onShareClick}
              icon={<Share2 className="h-4 w-4 text-blue-500" />}
              iconVariant="accent"
            >
              Share Trace
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  disabled={deleteMutation.isPending}
                  icon={<Trash2 className="h-4 w-4 text-red-500" />}
                  iconVariant="primary"
                  className="text-red-600 focus:text-red-600"
                >
                  Delete Trace
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-background/95 backdrop-blur-lg border border-border mx-4 max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the trace{' '}
                    <strong>{trace?.scenario || `ID: ${trace?.id?.substring(0, 7)}`}</strong> and
                    all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => traceId && deleteMutation.mutate(traceId)}
                    disabled={deleteMutation.isPending}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 transition-all duration-300"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              asChild
              icon={<ArrowLeft className="h-4 w-4 text-muted-foreground" />}
              iconVariant="default"
            >
              <Link to="/traces" className="w-full">
                Back to Traces
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

export default React.memo(TraceDetailHeaderActions);
