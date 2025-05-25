import * as React from 'react';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Edit, Check, X, Loader2 } from 'lucide-react';
import type { TraceMetadata, ApiError, UserProfile } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { traceApi } from '@/lib/api';
import { getTraceDetailsQueryKey } from '@/hooks/useTraceDetails';
import { useAuth } from '@/contexts/AuthContext';

interface TraceTitleProps {
    trace: TraceMetadata | undefined | null;
}

export function TraceTitle({ trace }: TraceTitleProps) {
    const { user } = useAuth();
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
            if (!user?.id || !trace?.id) {
                return Promise.reject(new Error('User or Trace ID is missing.'));
            }
            return traceApi.renameTrace(trace.id, newScenario, user.id);
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
                if (trace?.id)
                    queryClient.invalidateQueries({ queryKey: getTraceDetailsQueryKey(trace.id) });
            }
        },
        onError: (err, newScenarioVariable, context) => {
            if (context?.previousTrace && trace?.id) {
                queryClient.setQueryData<TraceMetadata>(
                    getTraceDetailsQueryKey(trace.id),
                    context.previousTrace
                );
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
            <div className="flex items-center gap-3">
                <Input
                    value={editedScenario}
                    onChange={handleInputChange}
                    className="h-11 md:text-2xl text-xl font-bold bg-background/80 backdrop-blur-sm border border-border hover:border-foreground/20 focus:border-red-500/50 transition-all duration-300 shadow-sm"
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
                    className="h-10 w-10 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0 transition-all duration-300 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
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
                    className="h-10 w-10 bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-red-500/50 text-muted-foreground hover:text-red-600 transition-all duration-300 shadow-sm hover:shadow-md"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    console.log('trace.owner?.id', trace.owner?.id, 'currentUser?.id', user?.id);

    return (
        <div className="flex items-center gap-3 group">
            <h1 className="text-2xl font-bold truncate" title={displayScenario}>
                {displayScenario}
            </h1>
            {trace.owner?.id === user?.id && !updateScenarioMutation.isPending && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEditClick}
                    aria-label="Edit scenario name"
                    className="h-9 w-9 bg-background/60 backdrop-blur-sm border border-border/50 hover:bg-background/80 hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-all duration-300 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 opacity-0 group-hover:opacity-100"
                >
                    <Edit className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
