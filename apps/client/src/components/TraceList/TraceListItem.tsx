import React, { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  Eye,
  Share2,
  Edit,
  Move,
  Flame,
  Info,
  Chrome,
  MoreVertical,
  Clock,
} from "lucide-react";
import { ContextMenu, ContextMenuItem, ContextMenuDivider } from "@/components/ui/context-menu";
import type { TraceMetadata } from "@/types";
import { formatRelativeDate, formatDuration, cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js"; // Import User type if needed
import { useSharingModal } from "@/hooks/useSharingModal"; // Added hook import
import { MoveItemDialog } from "./MoveItemDialog"; // Import the new dialog
import { RenameTraceDialog } from "./RenameTraceDialog"; // Import the new dialog
import type { ProfileType } from "@trace-view-pilot/shared-importer"; // Import ProfileType
import { UserAvatar } from "@/components/UserAvatar"; // Import the new component
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getExpirationStatus } from "@/lib/utils/getExpirationStatus";

// Helper to get icon based on profile type
const getIconForProfileType = (profileType?: ProfileType | string | null): React.ReactNode => {
  const IconComponent =
    {
      speedscope: Flame,
      pprof: Flame,
      "chrome-timeline": Chrome,
      "chrome-cpuprofile": Chrome,
      "chrome-cpuprofile-old": Chrome,
      "chrome-heap-profile": Chrome,
      stackprof: Flame,
      "instruments-deepcopy": Flame,
      "instruments-trace": Flame,
      "linux-perf": Flame,
      "collapsed-stack": Flame,
      "v8-prof-log": Flame,
      firefox: Flame,
      safari: Flame,
      haskell: Flame,
      "trace-event": Flame,
      callgrind: Flame,
      papyrus: Flame,
      unknown: Flame,
    }[profileType || "unknown"] || Flame; // Default to Flame if type is somehow missing
  // Render the Flame icon with consistent styling
  return <IconComponent className="mr-2 h-4 w-4 inline-block text-primary" />;
};

interface TraceListItemProps {
  trace: TraceMetadata;
  currentUser: User | null;
  onDelete: (traceId: string) => void;
  isDeleting: boolean;
  onClick: () => void;
  currentFolderId: string | null;
}

const TraceListItemComponent: React.FC<TraceListItemProps> = ({
  trace,
  currentUser,
  onDelete,
  isDeleting,
  onClick,
  currentFolderId,
}) => {
  const navigate = useNavigate();
  const { openModal: openShareModal } = useSharingModal();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

  const isOwnerCurrentUser = useMemo(
    () => currentUser && trace.owner?.id === currentUser.id,
    [currentUser, trace.owner?.id]
  );

  const ownerDisplayName = useMemo(() => {
    if (isOwnerCurrentUser) return "me";
    const owner = trace.owner;
    return (
      owner?.username ||
      `${owner?.first_name || ""} ${owner?.last_name || ""}`.trim() ||
      "Unknown Owner"
    );
  }, [isOwnerCurrentUser, trace.owner]);

  // Function to open context menu at specific coordinates
  const openContextMenuAtPosition = useCallback((x: number, y: number) => {
    setContextMenu({ x, y });
  }, []);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      openContextMenuAtPosition(event.clientX, event.clientY);
    },
    [openContextMenuAtPosition]
  );

  // Handler for the MoreVertical button click
  const handleOpenContextMenuFromButton = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation(); // Prevent row click
      const rect = event.currentTarget.getBoundingClientRect();
      openContextMenuAtPosition(rect.left - 135, rect.bottom + 5);
    },
    [openContextMenuAtPosition]
  );

  const handleNavigateToViewer = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      navigate(`/traces/${trace.id}/view`, {
        state: { blobPath: trace.blob_path },
      });
      setContextMenu(null);
    },
    [navigate, trace.id, trace.blob_path]
  );

  const handleDeleteConfirm = useCallback(() => {
    onDelete(trace.id);
  }, [onDelete, trace.id]);

  const handleOpenDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(true);
    setContextMenu(null);
  }, []);

  const handleShare = useCallback(() => {
    openShareModal(trace.id);
    setContextMenu(null);
  }, [openShareModal, trace.id]);

  const handleOpenRenameDialog = useCallback(() => {
    setIsRenameDialogOpen(true);
    setContextMenu(null);
  }, []);

  const handleOpenMoveDialog = useCallback(() => {
    setIsMoveDialogOpen(true);
    setContextMenu(null);
  }, []);

  const handleStopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const commitShortSha = useMemo(
    () => (trace.commit_sha ? trace.commit_sha.substring(0, 7) : "N/A"),
    [trace.commit_sha]
  );

  const traceIdentifier = useMemo(
    () => trace.scenario || `ID: ${trace.id.substring(0, 7)}`,
    [trace.scenario, trace.id]
  );

  // Calculate expiration status (only relevant for traces)
  const expirationStatus = trace.expires_at
    ? getExpirationStatus(trace.expires_at)
    : {
        isExpiring: false,
        daysRemaining: null,
        expirationDate: null,
        formattedExpirationDate: null,
      };

  return (
    <>
      <TableRow
        key={trace.id}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className="cursor-pointer hover:bg-muted/50"
      >
        <TableCell className="font-medium pl-6 py-3">
          {getIconForProfileType(trace.profile_type)}
          {trace.scenario || "N/A"}
        </TableCell>
        <TableCell className="py-4">
          <div className="flex items-center space-x-2">
            <UserAvatar profile={trace.owner} currentUser={currentUser} size="md" />
            <span className="text-sm truncate">{ownerDisplayName}</span>
          </div>
        </TableCell>
        <TableCell className="py-4 font-mono text-xs">{trace.branch || "N/A"}</TableCell>
        <TableCell className="py-4 font-mono text-xs">
          {trace.commit_sha ? trace.commit_sha.substring(0, 7) : "N/A"}
        </TableCell>
        <TableCell className="py-4">{formatDuration(trace.duration_ms)}</TableCell>
        <TableCell className="py-4 text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            {expirationStatus.isExpiring && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger>
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Expires in {expirationStatus.daysRemaining}
                      {expirationStatus.daysRemaining === 1 ? " day" : " days"}
                      {expirationStatus.formattedExpirationDate &&
                        ` (on ${expirationStatus.formattedExpirationDate})`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <span>{formatRelativeDate(trace.updated_at || trace.uploaded_at)}</span>
          </div>
        </TableCell>
        <TableCell className="text-right pr-6 py-4">
          <div onClick={handleStopPropagation} className="inline-flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigateToViewer}
              aria-label={`View trace ${traceIdentifier}`}
              className="h-8 w-8 p-0 cursor-pointer"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              className="h-8 w-8 p-0 text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              aria-label={`Delete trace ${traceIdentifier}`}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDeleteDialog(); // Use the existing handler
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              onClick={handleOpenContextMenuFromButton}
              aria-label={`Actions for trace ${traceIdentifier}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          <ContextMenuItem onClick={handleNavigateToViewer} icon={<Eye className="h-4 w-4" />}>
            View Flamegraph
          </ContextMenuItem>
          <ContextMenuItem onClick={onClick} icon={<Info className="h-4 w-4" />}>
            View Trace details
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
            onClick={isOwnerCurrentUser ? handleOpenRenameDialog : undefined}
            icon={<Edit className="h-4 w-4" />}
          >
            <span className={!isOwnerCurrentUser ? "opacity-50 cursor-not-allowed" : ""}>
              Rename
            </span>
          </ContextMenuItem>
          <div
            onClick={isOwnerCurrentUser ? handleOpenMoveDialog : undefined}
            className={cn(
              "px-3 py-1.5 flex items-center gap-2",
              isOwnerCurrentUser
                ? "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                : "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="w-4 h-4">
              <Move className="h-4 w-4" />
            </span>
            Move
          </div>
          <ContextMenuItem onClick={handleShare} icon={<Share2 className="h-4 w-4" />}>
            Share
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
            onClick={isOwnerCurrentUser ? handleOpenDeleteDialog : undefined}
            icon={<Trash2 className="h-4 w-4 text-destructive" />}
          >
            <span
              className={
                !isOwnerCurrentUser
                  ? "opacity-50 cursor-not-allowed text-destructive"
                  : "text-destructive"
              }
            >
              <span className="text-destructive">Delete</span>
            </span>
          </ContextMenuItem>
        </ContextMenu>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trace{" "}
              <strong>{traceIdentifier}</strong> and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Item Dialog */}
      {isMoveDialogOpen && (
        <MoveItemDialog
          isOpen={isMoveDialogOpen}
          setIsOpen={setIsMoveDialogOpen}
          itemsToMove={{ traces: [trace.id], folders: [] }}
          itemNames={[trace.scenario || `Trace ${trace.id.substring(0, 6)}`]}
          initialFolderId={currentFolderId}
        />
      )}

      {/* Rename Trace Dialog */}
      {isRenameDialogOpen && (
        <RenameTraceDialog
          isOpen={isRenameDialogOpen}
          setIsOpen={setIsRenameDialogOpen}
          traceId={trace.id}
          currentScenario={trace.scenario || ""}
        />
      )}
    </>
  );
};

// Need to find formatBytes function if it's not imported/available globally
// Placeholder:
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

export const TraceListItem = memo(TraceListItemComponent);
