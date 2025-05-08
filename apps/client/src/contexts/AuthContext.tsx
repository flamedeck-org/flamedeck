import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

import { fetchUserProfile } from '@/lib/api/users';
import type { ApiResponse, UserProfileData } from '@/types';

type UserProfile = UserProfileData;

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
      setSession(null);
      setUser(null);
      setLoading(false);
      queryClient.clear();
    }
  }, [queryClient, user?.id]);

  useEffect(() => {
    console.log("[AuthContext] useEffect mount. Setting up listeners and checks.");
    setLoading(true);
    let isMounted = true;
    let getSessionResolved = false;
    let firstAuthStateEventProcessed = false;

    const checkLoadingComplete = () => {
      if (getSessionResolved && firstAuthStateEventProcessed && isMounted) {
        console.log("[AuthContext] Both getSession and first auth event processed. Setting loading = false.");
        setLoading(false);
      }
    };

    console.log("[AuthContext] Setting up onAuthStateChange listener...");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!isMounted) return;
        console.log("[AuthContext] onAuthStateChange event:", _event, "Session:", currentSession);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (!firstAuthStateEventProcessed) {
          console.log("[AuthContext] First onAuthStateChange event processed.");
          firstAuthStateEventProcessed = true;
          checkLoadingComplete();
        }
        
        if (_event === 'SIGNED_OUT') {
          console.log("[AuthContext] SIGNED_OUT event, clearing RQ profile cache.");
          queryClient.clear();
        }
      }
    );

    console.log("[AuthContext] Performing initial getSession...");
    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!isMounted) return;
        console.log("[AuthContext] getSession() resolved. Session:", initialSession);
        setSession(prev => prev ?? initialSession);
        setUser(prev => prev ?? (initialSession?.user ?? null));
        getSessionResolved = true;
        checkLoadingComplete();
      })
      .catch(error => {
        if (!isMounted) return;
        console.error("[AuthContext] Error during initial getSession() check:", error);
        getSessionResolved = true;
        checkLoadingComplete();
      });

    return () => {
      console.log("[AuthContext] useEffect cleanup. Unsubscribing.");
      isMounted = false;
      subscription.unsubscribe();
    }
  }, [queryClient]);

  const value = useMemo(() => {
    return {
      session,
      user,
      profile,
      loading,
      profileLoading,
      signOut,
      refetchProfile
    }
  }, [session, user, profile, loading, profileLoading, signOut, refetchProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
