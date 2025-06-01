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
import { Copy, Loader2, AlertCircle, Trash2, Key, Plus, Shield, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatRelativeDate } from '@/lib/utils';

// Define available scopes (could come from a config file)
const AVAILABLE_SCOPES = [
  { id: 'trace:upload', label: 'Upload Traces' },
  { id: 'trace:download', label: 'Download Traces' },
  // Add more scopes here if needed in the future
];

function ApiKeysPage() {
  const {
    data: apiKeys,
    isLoading: isLoadingKeys,
    error: keysError,
    refetch: refetchKeys,
  } = useUserApiKeys();
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
    if (!newKeyDescription.trim()) {
      toast.error('Please provide a description for the API key.');
      return;
    }
    if (selectedScopes.length === 0) {
      toast.error('Please select at least one scope for the API key.');
      return;
    }

    createApiKeyMutation.mutate(
      { description: newKeyDescription, scopes: selectedScopes },
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

    revokeApiKeyMutation.mutate(keyToRevoke.id, {
      onSuccess: () => {
        toast.success(
          `API Key "${keyToRevoke.description || keyToRevoke.id.substring(0, 8)}" revoked successfully!`
        );
        setShowRevokeDialog(false);
        setKeyToRevoke(null);
        // onSuccess in the hook already invalidates the query
      },
      onError: (error) => {
        toast.error(`Failed to revoke API key: ${error.message}`);
        setShowRevokeDialog(false); // Also close dialog on error
      },
    });
  }, [keyToRevoke, revokeApiKeyMutation]);

  const activeKeys = useMemo(() => {
    return apiKeys?.filter((key) => key.is_active) ?? [];
  }, [apiKeys]);

  const revokedKeys = useMemo(() => {
    return apiKeys?.filter((key) => !key.is_active) ?? [];
  }, [apiKeys]);

  return (
    <div className="space-y-6">
      <PageHeader title="API Keys" />

      {/* Create New Key Card */}
      <Card className="bg-card/90 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <Plus className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Create New API Key</CardTitle>
              <CardDescription className="text-sm">
                Generate a new key for programmatic access.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0 pb-5">
          <div className="space-y-2">
            <Label htmlFor="key-description" className="text-xs font-medium">
              Description
            </Label>
            <Input
              id="key-description"
              placeholder="e.g., CI/CD Pipeline Key"
              value={newKeyDescription}
              onChange={(e) => setNewKeyDescription(e.target.value)}
              disabled={createApiKeyMutation.isPending}
              className="h-10 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Choose a descriptive name to help you identify this key later.
            </p>
          </div>

          <div className="space-y-2.5">
            <Label className="text-xs font-medium">Permissions</Label>
            <div className="space-y-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <div
                  key={scope.id}
                  className="flex items-start space-x-2.5 p-2.5 rounded-md bg-muted/30 border border-border/50"
                >
                  <Checkbox
                    id={`scope-${scope.id}`}
                    checked={selectedScopes.includes(scope.id)}
                    onCheckedChange={(checked) => handleScopeChange(scope.id, !!checked)}
                    disabled={createApiKeyMutation.isPending}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor={`scope-${scope.id}`} className="text-sm font-medium cursor-pointer leading-tight">
                      {scope.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {scope.id === 'trace:upload'
                        ? 'Allows uploading performance trace files via API'
                        : scope.id === 'trace:download'
                          ? 'Allows downloading trace data and storage objects via API'
                          : `Allows ${scope.label.toLowerCase()} operations via API`
                      }
                    </p>
                    <Badge variant="outline" className="mt-1.5 text-xs">
                      {scope.id}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-0 pb-5">
          <Button
            onClick={handleCreateKey}
            disabled={
              createApiKeyMutation.isPending ||
              selectedScopes.length === 0 ||
              !newKeyDescription.trim()
            }
            className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white shadow-sm hover:shadow-md transition-all duration-300"
            size="default"
          >
            {createApiKeyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Key className="mr-2 h-4 w-4" />
            Create API Key
          </Button>
        </CardFooter>
      </Card>

      {/* Existing Keys Card */}
      <Card className="bg-card/90 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
        <CardHeader className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-blue-400/20 rounded-xl border border-blue-500/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Existing API Keys</CardTitle>
              <CardDescription className="text-sm">
                Manage your existing API keys.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingKeys && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading API keys...</p>
              </div>
            </div>
          )}

          {keysError && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/30 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold mb-2">Error Loading API Keys</h3>
              <p className="text-muted-foreground mb-6">
                {keysError.message}
              </p>
              <Button onClick={() => refetchKeys()} variant="outline">
                Try Again
              </Button>
            </div>
          )}

          {!isLoadingKeys && !keysError && (
            <>
              {apiKeys && apiKeys.length > 0 ? (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Description</TableHead>
                        <TableHead className="font-semibold">Permissions</TableHead>
                        <TableHead className="font-semibold">Created</TableHead>
                        <TableHead className="font-semibold">Last Used</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow
                          key={key.id}
                          className={`${!key.is_active ? 'text-muted-foreground opacity-60' : ''} hover:bg-muted/20 transition-colors`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-gray-400/20 to-gray-500/20 rounded-lg border border-gray-400/30 flex items-center justify-center flex-shrink-0">
                                <Key className="h-4 w-4 text-gray-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate max-w-xs">
                                  {key.description || <span className="italic text-muted-foreground">No description</span>}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.map((scope) => (
                                <Badge key={scope} variant="secondary" className="text-xs">
                                  {scope}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{formatRelativeDate(key.created_at)}</TableCell>
                          <TableCell className="text-sm">
                            {key.last_used_at ? formatRelativeDate(key.last_used_at) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={key.is_active ? 'default' : 'destructive'}
                              className={key.is_active ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                            >
                              {key.is_active ? (
                                <>
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Active
                                </>
                              ) : (
                                'Revoked'
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {key.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openRevokeDialog(key)}
                                disabled={
                                  revokeApiKeyMutation.isPending && keyToRevoke?.id === key.id
                                }
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-gray-400/20 to-gray-500/20 rounded-xl border border-gray-400/30 flex items-center justify-center">
                    <Key className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No API keys yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Create your first API key to start integrating with FlameDeck programmatically.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog to show newly generated key */}
      <AlertDialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-sm border border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <span>API Key Created Successfully!</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="flex items-start space-x-3 pt-4">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-1 flex-shrink-0" />
              <span className="text-base">
                <strong>Important:</strong> Please copy your new API key now. You won't be able to see it again for security reasons.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-6 p-4 bg-muted/50 rounded-lg border border-border/50 relative group">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium text-muted-foreground">Your API Key</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-70 group-hover:opacity-100 transition-opacity"
                onClick={() => generatedKey && copyToClipboard(generatedKey.key)}
                title="Copy Key"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <code className="font-mono text-sm break-all block text-foreground">
              {generatedKey?.key}
            </code>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setGeneratedKey(null)}
              className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white"
            >
              I've Copied the Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Key Confirmation Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-sm border border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-red-400/20 rounded-lg border border-red-500/30 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <span>Revoke API Key</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-4">
              <p className="text-base">
                Are you sure you want to revoke this API key?
              </p>
              <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                <p className="font-medium text-sm">
                  Key: <span className="font-mono">{keyToRevoke?.description || keyToRevoke?.id}</span>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. The key will immediately become inactive and any applications using it will lose access.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeApiKeyMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeKey}
              disabled={revokeApiKeyMutation.isPending}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {revokeApiKeyMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default memo(ApiKeysPage);
