# FlameDeck Client

## Connecting to production

You'll need to create a `.env.local` file with the following variables:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Local Dev

You can run the entire FlameDeck stack locally for developing new features.

1. Fill in the google auth env variables in supabase/.env
2. Start and populate the database:

```bash
# Start locally
yarn supabase start

# Delete the old db if necessary
yarn supabase db reset

# Dump the production database
yarn supabase db dump -f prod_schema.sql

# Populate postgres
psql -h localhost -p 54322 -U postgres -d postgres -f prod_schema.sql
```
3. Fill in all the env variables in supabase/functions/.env
4. Serve the edge functions:

```bash
yarn supabase functions serve --no-verify-jwt
```

5. (Optional) Start the node server

```bash
yarn nx run @flamedeck/flamechart-server:start
```

6. Update your `apps/client/.env.local` to be:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_STRIPE_PUBLISHABLE_KEY=<test-perishable-key>
```

7. Start the client:

```bash
yarn nx run client:dev
```

8. Right now creating a new user doesn't create a user_profile entry for some reason - just copy the UUID from the user in supabase and manually create the row