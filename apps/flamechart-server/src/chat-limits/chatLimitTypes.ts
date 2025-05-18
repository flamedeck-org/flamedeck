import type { Tables } from '@flamedeck/supabase-integration';

// Re-exporting Supabase types for convenience within this module if needed elsewhere
export type UserProfile = Tables<'user_profiles'>;
export type UserSubscription = Tables<'user_subscriptions'>;
export type SubscriptionPlan = Tables<'subscription_plans'>;

export interface UserChatLimitContext {
    userProfile: Pick<UserProfile, 'id' | 'lifetime_chat_analyses_count'>;
    activeSubscription: Pick<UserSubscription, 'id' | 'plan_id' | 'monthly_chat_sessions_count' | 'status'> | null;
    plan: Pick<SubscriptionPlan, 'id' | 'name' | 'chat_messages_per_session' | 'chat_sessions_limit' | 'chat_sessions_period'>;
    isFreeUser: boolean; // Convenience flag based on the resolved plan's name
}

export type ChatLimitErrorCode = 'limit_exceeded' | 'internal_error' | 'config_error';
export type ChatLimitType = 'session_messages' | 'lifetime_analyses' | 'monthly_sessions';

export interface ChatErrorPayload {
    error_code: ChatLimitErrorCode;
    limit_type?: ChatLimitType;
    message: string;
    // Optional fields for more context to the client, if needed in the future
    // currentUsage?: number;
    // limitValue?: number;
} 