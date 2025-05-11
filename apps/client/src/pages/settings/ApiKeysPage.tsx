// src/pages/Settings/ApiKeysPage.tsx
import { memo, useCallback, useMemo, useState } from 'react';
import { useUserApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/useApiKeys';
import type { ApiKeyDisplayData } from '@/lib/api/apiKeys';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Copy, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatRelativeDate } from '@/lib/utils';

// Define available scopes (could come from a config file)
const AVAILABLE_SCOPES = [
  { id: 'trace:upload', label: 'Upload Traces' },
  // Add more scopes here if needed in the future
];

function ApiKeysPage() {
  const { data: apiKeys, isLoading: isLoadingKeys, error: keysError, refetch: refetchKeys } = useUserApiKeys();
  const createApiKeyMutation = useCreateApiKey();
  const revokeApiKeyMutation = useRevokeApiKey();

  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([AVAILABLE_SCOPES[0].id]); // Default to upload scope
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{ id: string; key: string } | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyDisplayData | null>(null);

  const handleScopeChange = useCallback((scopeId: string, checked: boolean) => {
    setSelectedScopes((prev) => (checked ? [...prev, scopeId] : prev.filter((s) => s !== scopeId)));
  }, []);

  const handleCreateKey = useCallback(async () => {
    if (selectedScopes.length === 0) {
      toast.error('Please select at least one scope for the API key.');
      return;
    }

    createApiKeyMutation.mutate(
      { description: newKeyDescription || null, scopes: selectedScopes },
      {
        onSuccess: (data) => {
          setGeneratedKey({ id: data.apiKeyId, key: data.plainTextKey });
          setShowNewKeyDialog(true);
          setNewKeyDescription(''); // Reset form
          setSelectedScopes([AVAILABLE_SCOPES[0].id]);
          toast.success('API Key created successfully!');
        },
        onError: (error) => {
          toast.error(`Failed to create API key: ${error.message}`);
        },
      }
    );
  }, [createApiKeyMutation, newKeyDescription, selectedScopes]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('API Key copied to clipboard!'))
      .catch(() => toast.error('Failed to copy API key.'));
  }, []);

  const openRevokeDialog = useCallback((key: ApiKeyDisplayData) => {
    setKeyToRevoke(key);
    setShowRevokeDialog(true);
  }, []);

  const handleRevokeKey = useCallback(async () => {
    if (!keyToRevoke) return;

    revokeApiKeyMutation.mutate(keyToRevoke.id,
      {
        onSuccess: () => {
          toast.success(`API Key "${keyToRevoke.description || keyToRevoke.id.substring(0, 8)}" revoked successfully!`);
          setShowRevokeDialog(false);
          setKeyToRevoke(null);
          // onSuccess in the hook already invalidates the query
        },
        onError: (error) => {
          toast.error(`Failed to revoke API key: ${error.message}`);
          setShowRevokeDialog(false); // Also close dialog on error
        },
      }
    );
  }, [keyToRevoke, revokeApiKeyMutation]);

  const activeKeys = useMemo(() => {
    return apiKeys?.filter(key => key.is_active) ?? [];
  }, [apiKeys]);

  const revokedKeys = useMemo(() => {
    return apiKeys?.filter(key => !key.is_active) ?? [];
  }, [apiKeys]);

  return (
    <>
      <PageHeader title="API Keys" />

      <div className="space-y-8">
        {/* Create New Key Card */}
        <Card>
          <CardHeader>
            <CardTitle>Create New API Key</CardTitle>
            <CardDescription>Generate a new key for programmatic access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-description">Description (Optional)</Label>
              <Input
                id="key-description"
                placeholder="e.g., CI/CD Pipeline Key"
                value={newKeyDescription}
                onChange={(e) => setNewKeyDescription(e.target.value)}
                disabled={createApiKeyMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="space-y-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <div key={scope.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`scope-${scope.id}`}
                      checked={selectedScopes.includes(scope.id)}
                      onCheckedChange={(checked) => handleScopeChange(scope.id, !!checked)}
                      disabled={createApiKeyMutation.isPending}
                    />
                    <Label htmlFor={`scope-${scope.id}`} className="font-normal">
                      {scope.label} ({scope.id})
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleCreateKey}
              disabled={createApiKeyMutation.isPending || selectedScopes.length === 0}
            >
              {createApiKeyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create API Key
            </Button>
          </CardFooter>
        </Card>

        {/* Existing Keys Card */}
        <Card>
          <CardHeader>
            <CardTitle>Existing API Keys</CardTitle>
            <CardDescription>Manage your existing API keys.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingKeys && <p>Loading keys...</p>}
            {keysError && <p className="text-red-600">Error loading keys: {keysError.message}</p>}
            {!isLoadingKeys && !keysError && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys && apiKeys.length > 0 ? (
                    apiKeys.map((key) => (
                      <TableRow
                        key={key.id}
                        className={`${!key.is_active ? 'text-muted-foreground opacity-60' : ''}`}
                      >
                        <TableCell className="font-medium truncate max-w-xs">
                          {key.description || <span className="italic">No description</span>}
                        </TableCell>
                        <TableCell className="space-x-1">
                          {key.scopes.map((scope) => (
                            <Badge key={scope} variant="secondary">
                              {scope}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell>{formatRelativeDate(key.created_at)}</TableCell>
                        <TableCell>
                          {key.last_used_at ? format(new Date(key.last_used_at), 'PPpp') : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={key.is_active ? 'default' : 'destructive'}>
                            {key.is_active ? 'Active' : 'Revoked'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {key.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRevokeDialog(key)}
                              disabled={revokeApiKeyMutation.isPending && keyToRevoke?.id === key.id}
                              className="text-red-600 hover:text-red-700"
                            >
                              {revokeApiKeyMutation.isPending && keyToRevoke?.id === key.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                              )}
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No API keys found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog to show newly generated key */}
        <AlertDialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>API Key Created Successfully!</AlertDialogTitle>
              <AlertDialogDescription className="flex items-start space-x-2 pt-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-1 flex-shrink-0" />
                <span>Please copy your new API key now. You won't be able to see it again!</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 p-3 bg-muted rounded-md font-mono text-sm break-all relative group">
              {generatedKey?.key}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => generatedKey && copyToClipboard(generatedKey.key)}
                title="Copy Key"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <AlertDialogFooter>
              {/* <AlertDialogCancel onClick={() => setGeneratedKey(null)}>Cancel</AlertDialogCancel> */}
              <AlertDialogAction onClick={() => setGeneratedKey(null)}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Revoke Key Confirmation Dialog */}
        <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to revoke this API key?</AlertDialogTitle>
              <AlertDialogDescription>
                Key: <span className="font-medium">{keyToRevoke?.description || keyToRevoke?.id}</span>
                <br />
                This action cannot be undone. The key will immediately become inactive.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revokeApiKeyMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevokeKey}
                disabled={revokeApiKeyMutation.isPending}
                className={buttonVariants({ variant: "destructive" })}
              >
                {revokeApiKeyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Revoke Key
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

export default memo(ApiKeysPage);
