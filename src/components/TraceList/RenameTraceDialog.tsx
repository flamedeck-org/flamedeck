import React, { memo, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { traceApi } from '@/lib/api';
import { TraceMetadata } from '@/types';
import { toast } from 'sonner';
import { FOLDER_VIEW_QUERY_KEY } from './hooks/useTraces';
import { ApiError, ApiResponse } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface RenameTraceDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  traceId: string;
  currentScenario: string;
  triggerElement?: React.ReactNode;
}

function RenameTraceDialogComponent({
  isOpen,
  setIsOpen,
  traceId,
  currentScenario,
  triggerElement
}: RenameTraceDialogProps) {
  const queryClient = useQueryClient();
  const [newScenario, setNewScenario] = useState(currentScenario);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setNewScenario(currentScenario); // Reset name when dialog opens
    }
  }, [isOpen, currentScenario]);

  const { mutate: renameTrace, isPending } = useMutation<
    ApiResponse<TraceMetadata>,
    ApiError,
    string // newScenario
  >({
    mutationFn: (updatedScenario: string) => {
      if (!user) throw new Error('User not authenticated');
      return traceApi.renameTrace(traceId, updatedScenario, user.id);
    },
    onSuccess: (response) => {
      if (response.data) {
        toast.success(`Successfully renamed trace to "${response.data.scenario || 'N/A'}".`);
        queryClient.invalidateQueries({ queryKey: [FOLDER_VIEW_QUERY_KEY] });
        setIsOpen(false);
      } else if (response.error) {
        toast.error(`Failed to rename trace: ${response.error.message}`);
      }
    },
    onError: (error: ApiError) => {
      toast.error(`Failed to rename trace: ${error.message}`);
    },
  });

  const handleSave = useCallback(() => {
    const trimmedScenario = newScenario.trim();
    if (!trimmedScenario) {
      toast.error('Scenario name cannot be empty.');
      return;
    }
    if (trimmedScenario === currentScenario) {
      setIsOpen(false); // No change
      return;
    }
    renameTrace(trimmedScenario);
  }, [newScenario, currentScenario, renameTrace, setIsOpen]);

  const handleOpenChange = (open: boolean) => {
    if (isPending) return; // Prevent closing while submitting
    setIsOpen(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Trace</DialogTitle>
          <DialogDescription>
Enter a new scenario name for the trace currently named "{currentScenario || 'N/A'}".
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="scenario-name" className="text-right">
              Scenario
            </Label>
            <Input
              id="scenario-name"
              value={newScenario}
              onChange={(e) => setNewScenario(e.target.value)}
              className="col-span-3"
              disabled={isPending}
              placeholder="e.g., User Login Performance"
              onKeyDown={(e) => { if (e.key === 'Enter' && !isPending) handleSave(); }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !newScenario.trim() || newScenario.trim() === currentScenario}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const RenameTraceDialog = memo(RenameTraceDialogComponent); 