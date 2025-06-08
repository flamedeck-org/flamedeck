# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
```bash
# Install dependencies
yarn

# Start development servers
yarn nx run client:dev          # React web app (localhost:5173)
yarn nx run flamechart-server:dev  # AI server (localhost:3000)

# Build applications
yarn nx run client:build        # Production build
yarn nx run client:build:dev    # Development build

# Linting
yarn nx run client:lint         # Lint client code
```

### Database Development (Supabase)
```bash
# Generate TypeScript types after schema changes
yarn supabase gen types typescript --project-id jczffinsulwdzhgzggcj --schema public > packages/supabase-integration/src/index.ts

# Local Supabase development
supabase start                  # Start local Supabase
supabase db reset               # Reset local database
supabase db push                # Push schema changes
```

## Architecture Overview

### Monorepo Structure
- **`apps/client/`** - React web application (main UI at flamedeck.com)
- **`apps/flamechart-server/`** - Node.js AI processing server with LangChain
- **`apps/docs/`** - Mintlify documentation site
- **`packages/`** - Shared libraries for speedscope integration and utilities
- **`supabase/`** - Database schema, migrations, and Deno edge functions
- **`cli-rust/`** - Rust CLI tool for trace uploads

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Radix UI (shadcn/ui)
- **State Management**: React Context + TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime) + Deno Edge Functions
- **AI Server**: Express.js + LangChain + OpenAI + Langfuse
- **Build System**: Nx workspace with Yarn 4 workspaces
- **Performance Rendering**: Custom WebGL flamegraph renderer (adapted from Speedscope)

### Core Data Flow
1. **Trace Upload** → Supabase Edge Function → Compression → Storage + Database
2. **Trace Viewing** → React Client → Speedscope Core → WebGL Rendering
3. **AI Analysis** → Supabase Edge Function → Node.js Server → LangChain + OpenAI
4. **Real-time Updates** → Supabase Realtime → React Client

## Coding Conventions

### React Components
- Always use named function declarations: `function MyComponent() {` not `const MyComponent: React.FC = () => {`
- Always memoize components with `memo`, and use `useMemo`/`useCallback` for stable dependencies
- Always memoize context values to prevent unnecessary rerenders
- Keep component files focused and reasonably sized - extract logic into hooks/utilities

### File Organization
Structure components around their usage:
```
components/
  TraceList/
    TraceList.tsx
    TraceListItem.tsx
    index.ts          # exports TraceList and related components
    hooks/
      useTraces.ts    # component-specific hooks
```

### Code Structure Patterns
- **API calls**: Centralized in `apps/client/src/lib/api/`
- **Custom hooks**: In `apps/client/src/hooks/`
- **UI components**: Use shadcn/ui patterns in `apps/client/src/components/ui/`
- **Types**: Shared types in `packages/supabase-integration/src/index.ts`
- **Utilities**: General utilities in `apps/client/src/lib/utils.ts`

## Key Architectural Components

### Speedscope Integration
FlameDeck extends Speedscope with collaborative features:
- **`packages/speedscope-core/`** - Profile data structures and algorithms
- **`packages/speedscope-import/`** - Multi-format trace file parsers (pprof, Chrome, V8, etc.)
- **`packages/speedscope-gl/`** - WebGL flamegraph rendering
- **`packages/speedscope-theme/`** - Customizable flamegraph themes

### Authentication & Security
- **Multi-method auth**: Session-based (web) + API key (programmatic)
- **Row Level Security**: Database-level access control via Supabase RLS
- **Permission system**: Granular API key permissions
- **Public sharing**: Secure public links for trace sharing

### AI Chat Architecture  
- **Async processing**: HTTP 202 pattern for long-running AI analysis
- **LangGraph workflows**: Multi-step AI processing with custom tools
- **Real-time streaming**: Token-level streaming via Supabase Realtime
- **Visual context**: AI analyzes flamegraph screenshots for better insights
- **Usage limits**: Subscription-based chat limits and counters

### State Management Patterns
- **Server state**: TanStack Query for API calls and caching
- **Global UI state**: React Context (Auth, Sidebar, Modals)
- **Local state**: useState/useReducer for component-specific state
- **Form state**: React Hook Form with Zod validation

## Database Guidelines

### Schema Changes
- Always provide SQL for database changes (don't create migration files directly)
- Consider security implications: "Could someone modify/delete data who shouldn't have permissions?"
- Update TypeScript types after schema changes using the Supabase command above

### Core Tables
- `traces` - Performance trace metadata and storage paths
- `folders` - Hierarchical organization system
- `chat_messages` - AI conversation history
- `user_profiles` - User data and subscription information
- `subscription_plans` - Billing tiers and usage limits

## Performance & Optimization

### WebGL Rendering
- Hardware-accelerated flamegraph visualization with custom shaders
- Supports multiple view modes: Timeline, Left-Heavy, Sandwich
- Optimized for smooth panning/zooming with large traces

### Trace Processing
- Gzip compression for trace storage efficiency
- Background PNG generation for AI visual context
- Support for 20+ trace formats via shared import packages

## Development Workflow

### Starting Development
1. `yarn` - Install dependencies
2. `yarn nx run client:dev` - Start React development server
3. `yarn nx run flamechart-server:dev` - Start AI server (if working on chat features)

### Before Committing
- Run `yarn nx run client:lint` to check code quality
- Test trace upload and viewing functionality
- Verify chat features work if modified

### Common Tasks
- **Adding new trace formats**: Extend `packages/speedscope-import/`
- **UI changes**: Use existing shadcn/ui components and follow memoization patterns
- **API changes**: Update both edge functions and client API layer
- **Database changes**: Provide SQL and regenerate types

## Package Dependencies

### Workspace Packages
- `@flamedeck/speedscope-*` - Speedscope integration packages
- `@flamedeck/supabase-integration` - Database types and utilities
- `@flamedeck/flamechart-to-png` - PNG rendering for AI context

### Key External Dependencies
- **UI**: `@radix-ui/*` components, `tailwindcss`, `framer-motion`
- **Data**: `@tanstack/react-query`, `@supabase/supabase-js`
- **AI**: `@langchain/*`, `langfuse` (server-side)
- **Performance**: Custom WebGL renderer, `pako` compression