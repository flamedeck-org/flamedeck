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
```

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS