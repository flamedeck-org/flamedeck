// src/hooks/useApiKeys.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiKeyDisplayData } from '@/lib/api/apiKeys';
import { listUserApiKeys, createApiKeyViaRpc } from '@/lib/api/apiKeys';
import { useAuth } from '@/contexts/AuthContext';
import type { ApiError } from '@/lib/api';

const API_KEYS_QUERY_KEY = 'apiKeys';

// Hook to fetch the list of API keys for the current user
export function useUserApiKeys() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<ApiKeyDisplayData[], ApiError>({
    // Specify types for data and error
    queryKey: [API_KEYS_QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return []; // Return empty array if no user
      const { data, error } = await listUserApiKeys(userId);
      if (error) throw error; // React Query handles error object
      return data || []; // Return data or empty array
    },
    enabled: !!userId, // Only run query if userId is available
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Hook for the mutation to create a new API key
export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    {
      apiKeyId: string;
      plainTextKey: string;
    },
    ApiError,
    { description: string | null; scopes: string[] }
  >({
    // Specify types for mutation result, error, and variables
    mutationFn: ({ description, scopes }) => {
      // Define an async function inside to handle the actual call
      const callRpc = async () => {
        const { data, error } = await createApiKeyViaRpc(description, scopes);
        if (error) throw error; // Throw error for React Query to catch
        if (!data) throw new Error('API key creation did not return data.'); // Handle case where data is null despite no error
        return data;
      };
      return callRpc(); // Return the promise
    },
    onSuccess: () => {
      // Invalidate the keys list query to refetch after creation
      queryClient.invalidateQueries({ queryKey: [API_KEYS_QUERY_KEY, user?.id] });
    },
    // onError is handled globally by React Query or can be added here
  });
}
