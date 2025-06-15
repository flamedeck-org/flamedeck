import { memo, useState, useEffect, useCallback } from 'react';
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
import type { TraceMetadata } from '@/types';
import { toast } from 'sonner';
import { FOLDER_VIEW_QUERY_KEY } from './hooks/useTraces';
import type { ApiError, ApiResponse } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Edit3, X } from 'lucide-react';

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
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card/90 backdrop-blur-sm border border-border/30 shadow-sm">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center text-xl font-bold">
            <div className="w-10 h-10 mr-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30 flex items-center justify-center">
              <Edit3 className="h-5 w-5 text-blue-500" />
            </div>
            Rename Trace
          </DialogTitle>
          <DialogDescription className="text-base pl-13 text-muted-foreground leading-relaxed">
            Enter a new scenario name for the trace currently named{' '}
            <span className="font-bold text-foreground bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-2 py-1 rounded-md border border-blue-500/20">
              "{currentScenario || 'N/A'}"
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="scenario-name" className="text-sm font-medium text-foreground">
              Scenario
            </Label>
            <Input
              id="scenario-name"
              value={newScenario}
              onChange={(e) => setNewScenario(e.target.value)}
              className="bg-background/50 backdrop-blur-sm transition-all duration-300"
              disabled={isPending}
              placeholder="e.g., User Login Performance"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending) handleSave();
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isPending}
            className="bg-background/50 backdrop-blur-sm border-border/30 hover:bg-background/80 hover:shadow-md transition-all duration-300"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !newScenario.trim() || newScenario.trim() === currentScenario}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const RenameTraceDialog = memo(RenameTraceDialogComponent);
