import React, { useState, useCallback } from 'react';
import { uploadTraceToApi, UploadError, type UploadOptions } from '@flamedeck/upload'; // Import from the built library

// --- UI Components (assuming shadcn/ui) ---
// You might need to adjust imports based on your actual UI component paths
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

export function UploadTest() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [scenario, setScenario] = useState<string>('Client Dev Test'); // Default scenario
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setResultUrl(null);
    setError(null);
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !apiKey || !scenario) {
      setError('Please select a file, enter an API key, and provide a scenario.');
      return;
    }

    setError(null);
    setResultUrl(null);
    setIsLoading(true);

    const options: UploadOptions = {
      apiKey,
      traceData: selectedFile,
      fileName: selectedFile.name,
      scenario,
      notes: notes || undefined, // Only pass if not empty
      // Example metadata:
      // metadata: { client: 'web-dev-test', timestamp: Date.now() }
    };

    try {
      const result = await uploadTraceToApi(options);
      setResultUrl(result.viewUrl);
    } catch (err) {
      if (err instanceof UploadError) {
        setError(
          `Upload failed (${err.status}): ${err.message}${err.details ? ` - ${JSON.stringify(err.details)}` : ''}`
        );
      } else {
        setError(
          `An unexpected error occurred: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      console.error('Upload error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, apiKey, scenario, notes]);

  return (
    <div className="p-4 border rounded-lg space-y-4 max-w-md mx-auto my-6">
      <h2 className="text-xl font-semibold">Dev Upload Test (@flamedeck/upload)</h2>

      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key</Label>
        <Input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your Flamedeck API Key"
        />
        <p className="text-sm text-muted-foreground">Use a key with `trace:upload` scope.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scenario">Scenario (Required)</Label>
        <Input
          id="scenario"
          type="text"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="traceFile">Trace File</Label>
        <Input id="traceFile" type="file" onChange={handleFileChange} />
        {selectedFile && (
          <p className="text-sm text-muted-foreground">Selected: {selectedFile.name}</p>
        )}
      </div>

      <Button onClick={handleUpload} disabled={!selectedFile || !apiKey || !scenario || isLoading}>
        {isLoading ? 'Uploading...' : 'Upload Trace'}
      </Button>

      {error && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {resultUrl && (
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            Trace uploaded. View at:{' '}
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4"
            >
              {resultUrl}
            </a>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Add default export if needed by your routing setup, or keep as named export
// export default UploadTest;
