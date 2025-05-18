import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@flamedeck/supabase-integration';
import {
    UserChatLimitContext,
    ChatErrorPayload,
} from './chatLimitTypes';

/**
 * Fetches all the necessary data to evaluate chat limits for a user.
 * This includes user profile, subscription, and plan details.
 */
export async function getUserChatLimitContext(
    userId: string,
    dbClient: SupabaseClient<Database>
): Promise<UserChatLimitContext | null> {
    if (!userId) {
        console.error('[ChatLimits] No userId provided to getUserChatLimitContext');
        return null;
    }

    try {
        // 1. Fetch user profile
        const { data: userProfileData, error: userProfileError } = await dbClient
            .from('user_profiles')
            .select('id, lifetime_chat_analyses_count')
            .eq('id', userId)
            .single();

        if (userProfileError || !userProfileData) {
            console.error(`[ChatLimits] Error fetching user profile for ${userId}:`, userProfileError);
            return null; // Critical data missing
        }

        // 2. Fetch active user subscription (if any)
        const { data: activeSubscriptionData, error: activeSubscriptionError } = await dbClient
            .from('user_subscriptions')
            .select('id, plan_id, monthly_chat_sessions_count, status')
            .eq('user_id', userId)
            .in('status', ['active', 'trialing', 'free']) // Adjust status values as needed
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); // Use maybeSingle in case there's no subscription

        if (activeSubscriptionError) {
            console.warn(`[ChatLimits] Error fetching active subscription for ${userId}:`, activeSubscriptionError);
            // Not necessarily fatal, user might be on a default free tier without a subscription record
        }

        let planData = null;
        const isFreeUserByDefault = !activeSubscriptionData || activeSubscriptionData.status === 'free';

        if (activeSubscriptionData && activeSubscriptionData.plan_id) {
            // 3. Fetch plan details for the active subscription
            const { data: subPlanData, error: subPlanError } = await dbClient
                .from('subscription_plans')
                .select('id, name, chat_messages_per_session, chat_sessions_limit, chat_sessions_period')
                .eq('id', activeSubscriptionData.plan_id)
                .single();

            if (subPlanError || !subPlanData) {
                console.error(`[ChatLimits] Error fetching plan details for plan_id ${activeSubscriptionData.plan_id}:`, subPlanError);
                // If plan details for an active sub are missing, this is a config issue.
                // Depending on strictness, you might return null or try to fallback to a default free plan.
                // For now, let's try to fallback if user is 'free', otherwise it's an issue for paid users.
                if (!isFreeUserByDefault) return null;
            } else {
                planData = subPlanData;
            }
        }

        // 4. If no active paid subscription plan, or if explicitly a 'free' subscription,
        //    attempt to load the "free" plan details as a fallback.
        if (!planData || (activeSubscriptionData && activeSubscriptionData.status === 'free')) {
            const { data: freePlanDetails, error: freePlanError } = await dbClient
                .from('subscription_plans')
                .select('id, name, chat_messages_per_session, chat_sessions_limit, chat_sessions_period')
                .eq('name', 'free')
                .single();

            // TODO: Better error handling
            if (freePlanError || !freePlanDetails) {
                console.error('[ChatLimits] Critical: Could not load "free" plan details.', freePlanError);
                return null;
            }
            planData = freePlanDetails;
        }

        if (!planData) {
            console.error(`[ChatLimits] Could not determine plan details for user ${userId}`);
            return null;
        }

        return {
            userProfile: userProfileData,
            activeSubscription: activeSubscriptionData || null,
            plan: planData,
            isFreeUser: planData.name === 'free', // More reliable check based on the resolved plan
        };
    } catch (e) {
        console.error(`[ChatLimits] Unexpected error in getUserChatLimitContext for ${userId}:`, e);
        return null;
    }
}

/**
 * Checks if a user has hit any chat limits.
 * Returns null if no limits hit, or a ChatErrorPayload if a limit is hit.
 */
export async function checkChatLimits(
    userId: string,
    traceId: string,
    sessionId: string,
    dbClient: SupabaseClient<Database>
): Promise<ChatErrorPayload | null> {
    const limitContext = await getUserChatLimitContext(userId, dbClient);

    if (!limitContext || !limitContext.plan || !limitContext.userProfile) {
        console.error(`[ChatLimits] Failed to get limit context for user ${userId}. Cannot check limits.`);
        return {
            error_code: 'internal_error',
            message: 'Could not process request due to a configuration issue.'
        };
    }

    const { userProfile, activeSubscription, plan } = limitContext;

    const { count: messagesInCurrentSessionCount, error: messagesCountError } = await dbClient
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId);

    if (messagesCountError) {
        console.error(`[ChatLimits] Error counting messages in session ${sessionId}:`, messagesCountError);
        return {
            error_code: 'internal_error',
            message: 'Error processing your request. Please try again.'
        };
    }

    const isFirstMessageOfSession = (messagesInCurrentSessionCount || 0) === 0;

    // Check 1: Messages Per Chat Session Limit
    if (plan.chat_messages_per_session !== null &&
        (messagesInCurrentSessionCount || 0) >= plan.chat_messages_per_session) {
        return {
            error_code: 'limit_exceeded',
            limit_type: 'session_messages',
            message: `You have reached the message limit of ${plan.chat_messages_per_session} for this chat session on the ${plan.name} plan.`
        };
    }

    // Check 2: Session Limits (only check on first message of a new session)
    if (isFirstMessageOfSession) {
        // Free Plan: Lifetime total chat sessions initiated
        if (plan.chat_sessions_period === 'lifetime' && plan.chat_sessions_limit !== null) {
            // If the user is at or over their lifetime session count limit
            if (userProfile.lifetime_chat_analyses_count >= plan.chat_sessions_limit) {
                console.log(`[ChatLimits.check] User ${userId} at or over lifetime session limit: ${userProfile.lifetime_chat_analyses_count}/${plan.chat_sessions_limit}`);
                return {
                    error_code: 'limit_exceeded',
                    limit_type: 'lifetime_analyses', // Keep type for client, or rename if too confusing
                    message: `You have reached your lifetime limit of ${plan.chat_sessions_limit} chat sessions for the Free plan. Please upgrade for more.`
                };
            }
        }
        // Pro Plan: Monthly chat sessions
        else if (plan.chat_sessions_period === 'monthly' &&
            plan.chat_sessions_limit !== null &&
            activeSubscription) {

            if (activeSubscription.monthly_chat_sessions_count >= plan.chat_sessions_limit) {
                console.log(`[ChatLimits.check] User ${userId} at or over monthly session limit: ${activeSubscription.monthly_chat_sessions_count}/${plan.chat_sessions_limit}`);
                return {
                    error_code: 'limit_exceeded',
                    limit_type: 'monthly_sessions',
                    message: `You have reached your monthly limit of ${plan.chat_sessions_limit} chat sessions for the ${plan.name} plan.`
                };
            }
        }
    }

    return null; // No limits hit
}

/**
 * Increments the appropriate chat counter for a user based on their plan.
 * Should only be called after we're sure the message has been successfully saved.
 */
export async function incrementChatCounter(
    userId: string,
    traceId: string,
    sessionId: string,
    isFirstMessageOfSession: boolean,
    dbClient: SupabaseClient<Database>
): Promise<boolean> {
    // Only increment for the first message of a session
    if (!isFirstMessageOfSession) {
        return false;
    }

    try {
        const limitContext = await getUserChatLimitContext(userId, dbClient);
        if (!limitContext || !limitContext.plan || !limitContext.userProfile) {
            console.error(`[ChatLimits] Failed to get limit context for user ${userId}. Cannot increment counter.`);
            return false;
        }

        const { userProfile, activeSubscription, plan } = limitContext;
        let incrementedCounter = false;

        // Lifetime limit for free plan: Increment for every new session started by a free user
        if (plan.chat_sessions_period === 'lifetime' &&
            plan.chat_sessions_limit !== null &&
            userProfile.lifetime_chat_analyses_count < plan.chat_sessions_limit) {

            console.log(`[ChatLimits.increment] Lifetime plan: Attempting to call RPC increment_lifetime_chat_analyses for user ${userId} (new session)`);
            const { error: rpcError } = await dbClient.rpc(
                'increment_lifetime_chat_analyses',
                { p_user_id: userId }
            );

            if (rpcError) {
                console.error(`[ChatLimits] Error incrementing lifetime analyses for ${userId}:`, rpcError);
                return false;
            }

            incrementedCounter = true;
            console.log(`[ChatLimits] Incremented lifetime chat analyses count for user ${userId}. New count should be ${userProfile.lifetime_chat_analyses_count + 1}.`);

        }
        // Monthly limit for paid plans: Increment for every new session started by a pro user
        else if (plan.chat_sessions_period === 'monthly' &&
            plan.chat_sessions_limit !== null &&
            activeSubscription &&
            activeSubscription.monthly_chat_sessions_count < plan.chat_sessions_limit) {

            console.log(`[ChatLimits.increment] Monthly plan: Attempting to call RPC increment_monthly_chat_sessions for user ${userId}, subscription ${activeSubscription.id}`);
            const { error: rpcError } = await dbClient.rpc(
                'increment_monthly_chat_sessions',
                { p_user_subscription_id: activeSubscription.id }
            );

            if (rpcError) {
                console.error(`[ChatLimits] Error incrementing monthly sessions for sub ${activeSubscription.id}:`, rpcError);
                return false;
            }

            incrementedCounter = true;
            console.log(`[ChatLimits] Incremented monthly chat sessions count for user ${userId}. New count should be ${activeSubscription.monthly_chat_sessions_count + 1}.`);
        }

        return incrementedCounter;
    } catch (e) {
        console.error(`[ChatLimits] Error in incrementChatCounter for ${userId}:`, e);
        return false;
    }
}

/**
 * Helper function to send chat limit errors via the realtime channel.
 */
export function sendChatLimitError(
    realtimeChannel: any,
    errorPayload: ChatErrorPayload
): boolean {
    try {
        realtimeChannel.send({
            type: 'broadcast',
            event: 'chat_error',
            payload: errorPayload
        });
        return true;
    } catch (e) {
        console.error('[ChatLimits] Error sending limit error via realtime:', e);
        return false;
    }
} 