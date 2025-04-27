import React, { memo, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AvatarSize, { container: string; fallback: string }> = {
  sm: { container: 'h-5 w-5', fallback: 'text-xs' },
  md: { container: 'h-6 w-6', fallback: 'text-sm' }, // Default size
  lg: { container: 'h-9 w-9', fallback: 'text-base' },
};

interface UserAvatarProps {
  profile: UserProfile | null | undefined; // The profile to display (could be null/undefined)
  currentUser?: User | null; // Currently logged-in user (optional)
  size?: AvatarSize;
  className?: string; // Allow passing additional classes
}

const UserAvatarComponent: React.FC<UserAvatarProps> = ({ 
  profile, 
  currentUser, 
  size = 'md', // Default to medium size
  className 
}) => {

  const fallbackInfo = useMemo(() => {
    const isCurrentUser = currentUser && profile?.id === currentUser.id;
    let nameForInitials: string | undefined | null = undefined;
    let nameDisplay: string = "Unknown";
    let avatarUrl: string | undefined | null = undefined;

    if (isCurrentUser) {
      nameForInitials = currentUser.user_metadata?.first_name || currentUser.email;
      nameDisplay = "me";
      avatarUrl = currentUser.user_metadata?.avatar_url;
    } else if (profile) {
      nameForInitials = profile.first_name || profile.username; // Prioritize first name, then username
      nameDisplay = profile.username || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || "Unknown";
      avatarUrl = profile.avatar_url;
    }

    // Get single initial from the prioritized name source
    const initial = nameForInitials?.[0]?.toUpperCase() || '?';

    return {
      initial,
      nameDisplay, // Used for alt text
      avatarUrl: avatarUrl ?? undefined
    };
  }, [currentUser, profile]);

  const { container: sizeClass, fallback: fallbackSizeClass } = sizeClasses[size];

  return (
    <Avatar className={cn("border border-secondary", sizeClass, className)}>
      <AvatarImage src={fallbackInfo.avatarUrl} alt={fallbackInfo.nameDisplay} />
      <AvatarFallback className={cn(
        "bg-primary/10 text-primary font-medium", 
        fallbackSizeClass
      )}>
        {fallbackInfo.initial}
      </AvatarFallback>
    </Avatar>
  );
};

export const UserAvatar = memo(UserAvatarComponent); 