import React, { memo, useCallback, useMemo } from 'react';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2 } from "lucide-react";
import { TraceMetadata, UserProfile } from "@/types";
import { formatDate, formatDuration, getInitials } from "@/lib/utils"; // Assuming getInitials is in utils
import { User } from '@supabase/supabase-js'; // Import User type if needed

interface TraceListItemProps {
  trace: TraceMetadata;
  currentUser: User | null; // Use appropriate User type from your auth context or Supabase
  onDelete: (traceId: string) => void;
  isDeleting: boolean;
  onClick: () => void;
}

const TraceListItemComponent: React.FC<TraceListItemProps> = ({
  trace,
  currentUser,
  onDelete,
  isDeleting,
  onClick,
}) => {
  const isOwnerCurrentUser = useMemo(() => 
    currentUser && trace.owner?.id === currentUser.id, 
    [currentUser, trace.owner?.id]
  );
  
  const ownerName = useMemo(() => 
    isOwnerCurrentUser 
      ? "me" 
      : trace.owner?.username || `${trace.owner?.first_name || ''} ${trace.owner?.last_name || ''}`.trim() || "Unknown Owner",
    [isOwnerCurrentUser, trace.owner?.username, trace.owner?.first_name, trace.owner?.last_name]
  );
  
  // Assuming getInitials exists in utils, otherwise adapt/import
  const ownerInitials = useMemo(() => 
    getInitials(ownerName === "me" ? currentUser?.email : ownerName), 
    [ownerName, currentUser?.email]
  );

  const handleDelete = useCallback(() => {
    onDelete(trace.id);
  }, [onDelete, trace.id]);

  const handleStopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const commitShortSha = useMemo(() => 
    trace.commit_sha ? trace.commit_sha.substring(0, 7) : "N/A",
    [trace.commit_sha]
  );

  const traceIdentifier = useMemo(() => 
    trace.scenario || `ID: ${trace.id.substring(0, 7)}`,
    [trace.scenario, trace.id]
  );

  return (
    <TableRow 
      key={trace.id} 
      onClick={onClick} 
      className="cursor-pointer hover:bg-muted/50"
    >
      <TableCell className="font-medium pl-6 py-3">{trace.scenario || "N/A"}</TableCell>
      <TableCell className="py-3">
         <div className="flex items-center space-x-2">
           <Avatar className="h-6 w-6">
             <AvatarImage src={trace.owner?.avatar_url ?? undefined} alt={ownerName} />
             <AvatarFallback>{ownerInitials}</AvatarFallback>
           </Avatar>
           <span className="text-sm truncate">{ownerName}</span>
        </div>
      </TableCell>
      <TableCell className="py-3">{trace.branch || "N/A"}</TableCell>
      <TableCell className="font-mono text-xs py-3">
        {commitShortSha}
      </TableCell>
      <TableCell className="py-3">{trace.device_model || "N/A"}</TableCell>
      <TableCell className="py-3">{formatDuration(trace.duration_ms)}</TableCell>
      <TableCell className="py-3">{formatDate(trace.uploaded_at)}</TableCell>
      <TableCell className="text-right pr-6 py-3">
        <div onClick={handleStopPropagation} className="inline-block">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the trace{' '}
                  <strong>{traceIdentifier}</strong>{' '}
                  and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const TraceListItem = memo(TraceListItemComponent);