# Trace Viewer

## Setup

```
yarn
yarn dev
```

## Updating the schema

Run:

```bash
SUPABASE_ACCESS_TOKEN=<my-token> yarn supabase gen types typescript --project-id jczffinsulwdzhgzggcj --schema public > apps/client/src/integrations/supabase/types.ts
```

## Deploying edge functions

```bash
yarn supabase functions deploy api-upload-trace --no-verify-jwt
yarn supabase functions deploy trace-analysis-socket --no-verify-jwt
yarn supabase functions deploy process-ai-turn
yarn supabase functions deploy delete-user
yarn supabase functions deploy cleanup-old-traces --no-verify-jwt
```

## Deploying the site

```bash
vercel --prod
```

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS