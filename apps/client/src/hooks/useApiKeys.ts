// src/hooks/useApiKeys.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiKeyDisplayData } from '@/lib/api/apiKeys';
import {
  listUserApiKeys,
  createApiKeyViaRpc,
  revokeApiKey as revokeApiKeyFn,
} from '@/lib/api/apiKeys';
import { useAuth } from '@/contexts/AuthContext';
import type { ApiError } from '@/lib/api/types';

const API_KEYS_QUERY_KEY_PREFIX = 'apiKeys'; // Renamed for clarity with the function

// Helper function to get the query key for user API keys
export function getUserApiKeysQueryKey(userId?: string) {
  return [API_KEYS_QUERY_KEY_PREFIX, userId];
}

// Hook to fetch the list of API keys for the current user
export function useUserApiKeys() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<ApiKeyDisplayData[], ApiError>({
    queryKey: getUserApiKeysQueryKey(userId), // Use the new helper function
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
    mutationFn: ({ description, scopes }) => {
      const callRpc = async () => {
        const { data, error } = await createApiKeyViaRpc(description, scopes);
        if (error) throw error;
        if (!data) throw new Error('API key creation did not return data.');
        return data;
      };
      return callRpc();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getUserApiKeysQueryKey(user?.id) });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const mutationFn = async (keyId: string) => {
    const response = await revokeApiKeyFn(keyId);
    if (response.error) {
      throw response.error;
    }
    return response.data;
  };

  return useMutation<null, ApiError, string, unknown>({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getUserApiKeysQueryKey(userId) });
    },
  });
}
