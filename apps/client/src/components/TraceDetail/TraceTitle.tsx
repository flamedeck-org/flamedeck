import * as React from 'react';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Edit, Check, X, Loader2 } from 'lucide-react';
import type { TraceMetadata, ApiError } from '@/types';
import type { UserProfileType } from '@/lib/api/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { traceApi } from '@/lib/api';
import { getTraceDetailsQueryKey } from '@/hooks/useTraceDetails';

interface TraceTitleProps {
    trace: TraceMetadata | undefined | null;
    currentUser: UserProfileType | undefined | null;
}

export function TraceTitle({ trace, currentUser }: TraceTitleProps) {
    const [isEditingScenario, setIsEditingScenario] = useState(false);
    const [editedScenario, setEditedScenario] = useState(trace?.scenario || '');
    const [optimisticDisplayScenario, setOptimisticDisplayScenario] = useState<string | null>(null);

    const queryClient = useQueryClient();
    const { toast } = useToast();

    useEffect(() => {
        if (trace?.scenario) {
            if (!isEditingScenario) {
                setEditedScenario(trace.scenario);
            }
            if (optimisticDisplayScenario === trace.scenario) {
                setOptimisticDisplayScenario(null);
            }
        }
    }, [trace?.scenario, isEditingScenario, optimisticDisplayScenario]);

    const updateScenarioMutation = useMutation<
        {
            data: TraceMetadata | null;
            error: ApiError | null;
        },
        Error,
        string,
        { previousTrace?: TraceMetadata | undefined }
    >({
        mutationFn: (newScenario: string) => {
            if (!currentUser?.id || !trace?.id) {
                return Promise.reject(new Error('User or Trace ID is missing.'));
            }
            return traceApi.renameTrace(trace.id, newScenario, currentUser.id);
        },
        onMutate: async (newScenario: string) => {
            if (!trace?.id) return { previousTrace: undefined };
            const queryKey = getTraceDetailsQueryKey(trace.id);
            await queryClient.cancelQueries({ queryKey });
            const previousTrace = queryClient.getQueryData<TraceMetadata>(queryKey);

            if (previousTrace) {
                queryClient.setQueryData<TraceMetadata>(queryKey, {
                    ...previousTrace,
                    scenario: newScenario,
                });
            }

            setEditedScenario(newScenario);
            setOptimisticDisplayScenario(newScenario);
            setIsEditingScenario(false);

            return { previousTrace };
        },
        onSuccess: (response) => {
            if (response.data) {
                toast({ title: 'Scenario updated successfully' });
            } else if (response.error) {
                toast({
                    title: 'Error updating scenario',
                    description: response.error.message || 'Update failed despite success status.',
                    variant: 'destructive',
                });
                if (trace?.id) queryClient.invalidateQueries({ queryKey: getTraceDetailsQueryKey(trace.id) });
            }
        },
        onError: (err, newScenarioVariable, context) => {
            if (context?.previousTrace && trace?.id) {
                queryClient.setQueryData<TraceMetadata>(getTraceDetailsQueryKey(trace.id), context.previousTrace);
                setEditedScenario(context.previousTrace.scenario);
            }
            setOptimisticDisplayScenario(null);
            toast({ title: 'Error updating scenario', description: err.message, variant: 'destructive' });
        },
        onSettled: () => {
            if (trace?.id) {
                queryClient.invalidateQueries({ queryKey: getTraceDetailsQueryKey(trace.id) });
            }
            queryClient.invalidateQueries({ queryKey: ['traces'] });
            setOptimisticDisplayScenario(null);
        },
    });

    const handleEditClick = () => {
        if (trace?.scenario) {
            setEditedScenario(trace.scenario);
        }
        setOptimisticDisplayScenario(null);
        setIsEditingScenario(true);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEditedScenario(event.target.value);
    };

    const handleSave = () => {
        const trimmedScenario = editedScenario.trim();
        if (trimmedScenario === '') {
            toast({ title: 'Scenario cannot be empty', variant: 'destructive' });
            return;
        }
        if (trimmedScenario === trace?.scenario) {
            setIsEditingScenario(false);
            setOptimisticDisplayScenario(null);
            return;
        }
        updateScenarioMutation.mutate(trimmedScenario);
    };

    const handleCancel = () => {
        setIsEditingScenario(false);
        setOptimisticDisplayScenario(null);
        if (trace?.scenario) {
            setEditedScenario(trace.scenario);
        }
    };

    const displayScenario = optimisticDisplayScenario ?? trace?.scenario ?? 'Trace Details';

    if (!trace && updateScenarioMutation.isPending) {
        return <Skeleton className="h-8 w-48" />;
    }
    if (!trace) {
        return <Skeleton className="h-8 w-48" />;
    }

    if (isEditingScenario) {
        return (
            <div className="flex items-center gap-2">
                <Input
                    value={editedScenario}
                    onChange={handleInputChange}
                    className="h-9 md:text-2xl text-2xl font-bold"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') handleCancel();
                    }}
                    aria-label="Edit trace scenario"
                />
                <Button
                    size="icon"
                    onClick={handleSave}
                    disabled={updateScenarioMutation.isPending}
                    aria-label="Save scenario"
                    className="h-8 w-10"
                >
                    {updateScenarioMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Check className="h-4 w-4" />
                    )}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={updateScenarioMutation.isPending}
                    aria-label="Cancel editing scenario"
                    className="h-8 w-10"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate" title={displayScenario}>
                {displayScenario}
            </h1>
            {trace.owner?.id === currentUser?.id && !updateScenarioMutation.isPending && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEditClick}
                    aria-label="Edit scenario name"
                >
                    <Edit className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
