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
yarn supabase db reset
```

NOTE: To sync auth and storage changes you need to run `yarn supabase db pull --schema auth` and `yarn supabase db pull --schema storage`. You might need to comment out some stuff at the top of storage.

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