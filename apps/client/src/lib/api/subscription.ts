import { supabase } from "@/integrations/supabase/client";
import { ApiError, ApiResponse } from "@/types";
import { PostgrestError } from "@supabase/supabase-js";

export interface SubscriptionUsage {
    monthly_uploads_used: number | null;
    monthly_upload_limit: number | null;
    current_period_end: string | null; // Comes as string from DB
    plan_name: string | null;
}

export async function getUserSubscriptionUsage(userId: string): Promise<ApiResponse<SubscriptionUsage>> {
    if (!userId) {
        return { data: null, error: { message: "User ID is required" } };
    }

    try {
        const { data, error } = await supabase.rpc('get_user_subscription_usage', {
            p_user_id: userId
        });

        if (error) {
            console.error("Error fetching subscription usage:", error);
            throw error;
        }

        // RPC functions often return an array, even if just one row is expected
        // Or they might return an empty array if no matching subscription was found
        const usageData = data && Array.isArray(data) && data.length > 0 ? data[0] : null;

        return { data: usageData as SubscriptionUsage | null, error: null };

    } catch (error) {
        console.error(`Error calling get_user_subscription_usage RPC for ${userId}:`, error);
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : "Failed to fetch subscription usage",
            code: (error as PostgrestError)?.code,
            details: (error as PostgrestError)?.details,
            hint: (error as PostgrestError)?.hint,
        };
        return { data: null, error: apiError };
    }
} 