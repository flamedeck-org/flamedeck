// src/pages/Settings/ApiKeysPage.tsx
import React, { useState } from 'react';
import { useUserApiKeys, useCreateApiKey } from '@/hooks/useApiKeys';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from 'date-fns';
import { Copy, Loader2, AlertCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import PageLayout from '@/components/PageLayout';
import PageHeader from '@/components/PageHeader';
import AuthGuard from '@/components/AuthGuard';
import { formatRelativeDate } from '@/lib/utils';

// Define available scopes (could come from a config file)
const AVAILABLE_SCOPES = [
    { id: 'trace:upload', label: 'Upload Traces' },
    // Add more scopes here if needed in the future
];

function ApiKeysPage() {
    const { data: apiKeys, isLoading: isLoadingKeys, error: keysError } = useUserApiKeys();
    const createApiKeyMutation = useCreateApiKey();

    const [newKeyDescription, setNewKeyDescription] = useState('');
    const [selectedScopes, setSelectedScopes] = useState<string[]>([AVAILABLE_SCOPES[0].id]); // Default to upload scope
    const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
    const [generatedKey, setGeneratedKey] = useState<{ id: string; key: string } | null>(null);

    const handleScopeChange = (scopeId: string, checked: boolean) => {
        setSelectedScopes(prev =>
            checked ? [...prev, scopeId] : prev.filter(s => s !== scopeId)
        );
    };

    const handleCreateKey = async () => {
        if (selectedScopes.length === 0) {
            toast.error("Please select at least one scope for the API key.");
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
                    toast.success("API Key created successfully!");
                },
                onError: (error) => {
                    toast.error(`Failed to create API key: ${error.message}`);
                },
            }
        );
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => toast.success("API Key copied to clipboard!"))
            .catch(() => toast.error("Failed to copy API key."));
    };

    return (
        <AuthGuard>
            <Layout>
                <PageLayout>
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
                                        {AVAILABLE_SCOPES.map(scope => (
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
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {apiKeys && apiKeys.length > 0 ? (
                                                apiKeys.map(key => (
                                                    <TableRow key={key.id} className={`${!key.is_active ? 'text-muted-foreground opacity-60' : ''}`}>
                                                        <TableCell className="font-medium truncate max-w-xs">{key.description || <span className="italic">No description</span>}</TableCell>
                                                        <TableCell className="space-x-1">
                                                            {key.scopes.map(scope => <Badge key={scope} variant="secondary">{scope}</Badge>)}
                                                        </TableCell>
                                                        <TableCell>{formatRelativeDate(key.created_at)}</TableCell>
                                                        <TableCell>{key.last_used_at ? format(new Date(key.last_used_at), 'PPpp') : 'Never'}</TableCell>
                                                        <TableCell>
                                                             <Badge variant={key.is_active ? "default" : "destructive"}>{key.is_active ? 'Active' : 'Revoked'}</Badge>
                                                         </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center text-muted-foreground">No API keys found.</TableCell>
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
                                       <span>
                                         Please copy your new API key now. You won't be able to see it again!
                                       </span>
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
                    </div>
                </PageLayout>
            </Layout>
        </AuthGuard>
    );
}

export default ApiKeysPage; 