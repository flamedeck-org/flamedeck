# AGENT.md

## Build/Lint/Test Commands
```bash
yarn nx run client:dev          # Start React dev server (localhost:5173)
yarn nx run flamechart-server:dev  # Start AI server (localhost:3000)
yarn nx run client:build        # Production build
yarn nx run client:lint         # Lint client code
yarn supabase gen types typescript --project-id jczffinsulwdzhgzggcj --schema public > packages/supabase-integration/src/index.ts
```

## Architecture
- **React app** (`apps/client/`) - Main UI with WebGL flamegraph rendering
- **AI server** (`apps/flamechart-server/`) - Express.js + LangChain + OpenAI
- **Database** - Supabase (PostgreSQL + Auth + RLS + Realtime)
- **Packages** - Speedscope integration, shared utilities, Supabase types
- **Build system** - Nx workspace + Yarn 4 workspaces

## Code Style
- **Components** - Named function declarations: `function MyComponent() {`, always wrap in `memo`
- **Memoization** - Use `useMemo`/`useCallback` for stable dependencies, memoize context values
- **File structure** - Component folders with index.ts exports, hooks/ subdirectory
- **API** - Centralized in `apps/client/src/lib/api/`, TanStack Query for caching
- **Types** - Shared types in `packages/supabase-integration/src/index.ts`
- **Forms** - React Hook Form + Zod validation
- **UI** - shadcn/ui components, Tailwind CSS, Radix UI primitives
