import * as Sentry from '@sentry/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';

import { fetchUserProfile } from '@/lib/api/users';
import type { ApiResponse, UserProfile } from '@/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const userProfileQueryKey = (userId: string) => ['userProfile', userId];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const {
    data: profileData,
    isLoading: profileLoading,
    refetch: refetchProfileQuery,
  } = useQuery<ApiResponse<UserProfile | null>, Error>({
    queryKey: userProfileQueryKey(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) return { data: null, error: null };
      const result = await fetchUserProfile(user.id);
      if (result.error) {
        return { data: null, error: result.error };
      }
      return result;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const profile = profileData?.data ?? null;

  const refetchProfile = useCallback(() => {
    refetchProfileQuery();
  }, [refetchProfileQuery]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setLoading(false);
      queryClient.removeQueries({ queryKey: userProfileQueryKey(user?.id ?? '') });
      queryClient.clear();
    } catch (error) {
      Sentry.captureException(error);
      setSession(null);
      setUser(null);
      setLoading(false);
      queryClient.clear();
    }
  }, [queryClient, user?.id]);

  useEffect(() => {
    setLoading(true);
    let isMounted = true;
    let getSessionResolved = false;
    let firstAuthStateEventProcessed = false;

    const checkLoadingComplete = () => {
      if (getSessionResolved && firstAuthStateEventProcessed && isMounted) {
        setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!firstAuthStateEventProcessed) {
        firstAuthStateEventProcessed = true;
        checkLoadingComplete();
      }

      if (_event === 'SIGNED_OUT') {
        queryClient.clear();
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!isMounted) return;
        setSession((prev) => prev ?? initialSession);
        setUser((prev) => prev ?? initialSession?.user ?? null);
        getSessionResolved = true;
        checkLoadingComplete();
      })
      .catch((error) => {
        Sentry.captureException(error);
        if (!isMounted) return;
        getSessionResolved = true;
        checkLoadingComplete();
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo(() => {
    return {
      session,
      user,
      profile,
      loading,
      profileLoading,
      signOut,
      refetchProfile,
    };
  }, [session, user, profile, loading, profileLoading, signOut, refetchProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
