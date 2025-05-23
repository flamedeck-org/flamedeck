# FlameDeck Client

## Connecting to production

You'll need to create a `.env.local` file with the following variables:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Local Dev

You can run the entire FlameDeck stack locally for developing new features.

```bash
# Start locally
yarn supabase start

# Delete the old db if necessary
yarn supabase db reset

# Dump the production database
yarn supabase db dump -f prod_schema.sql

# Populate postgres
psql -h localhost -p 54322 -U postgres -d postgres -f prod_schema.sql

# Serve the edge functions locally
# IMPORTANT: Fill in all the env variables in supabase/functions/.env
yarn supabase functions serve --no-verify-jwt

# Enable auth methods
# TODO: Right now google auth isn't set up locally. Once create account without oAath
# is done we can use that to develop locally
```

Then update your .env.local to be:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_STRIPE_PUBLISHABLE_KEY=<test-perishable-key>
```