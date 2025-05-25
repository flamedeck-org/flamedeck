-- Seed data for the subscription_plans table
INSERT INTO public.subscription_plans (
    id,
    name,
    display_name,
    price_monthly,
    retention_days,
    monthly_upload_limit,
    total_trace_limit,
    allow_public_sharing,
    created_at,
    updated_at,
    chat_messages_per_session,
    chat_sessions_limit,
    chat_sessions_period,
    stripe_price_id
) VALUES
(
    '44b49ed5-76a3-4f2c-b2c6-5c101e57b9e8', -- id
    'free',                               -- name
    'Free',                               -- display_name
    0.00,                                 -- price_monthly
    30,                                   -- retention_days
    10,                                   -- monthly_upload_limit
    NULL,                                 -- total_trace_limit (was empty, assuming NULL)
    false,                                -- allow_public_sharing
    '2025-04-29 05:47:36.554488+00',      -- created_at
    '2025-04-29 05:47:36.554488+00',      -- updated_at
    25,                                   -- chat_messages_per_session
    3,                                    -- chat_sessions_limit
    'monthly',                            -- chat_sessions_period
    NULL                                  -- stripe_price_id (was empty, assuming NULL)
),
(
    'b963b9ea-a9e7-4452-976b-24bd435bf25b', -- id
    'pro',                                -- name
    'Pro',                                -- display_name
    15.00,                                -- price_monthly
    NULL,                                 -- retention_days (was empty, assuming NULL)
    NULL,                                 -- monthly_upload_limit (was empty, assuming NULL)
    1000,                                 -- total_trace_limit
    true,                                 -- allow_public_sharing
    '2025-04-29 05:47:36.554488+00',      -- created_at
    '2025-04-29 05:47:36.554488+00',      -- updated_at
    50,                                   -- chat_messages_per_session
    30,                                   -- chat_sessions_limit
    'monthly',                            -- chat_sessions_period
    'price_1RSOnJPNWXhKgE155BRbtlzB'      -- stripe_price_id
)
ON CONFLICT (id) DO NOTHING; -- Optional: Prevents errors if rows with these IDs already exist.
                                -- You could also use DO UPDATE SET ... if you want to update existing rows.
