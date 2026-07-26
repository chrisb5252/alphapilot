# AlphaPilot

AlphaPilot is an educational AI investment copilot. This repository currently contains **Milestone 1 only**: the production foundation for the application. Portfolio imports, holdings, analytics, billing, and AI analysis data models are intentionally out of scope until the next milestone.

## What is configured

- **Next.js 16 + TypeScript** for the full-stack web application.
- **Tailwind CSS 4** through PostCSS, ready for new component work alongside the existing product styles.
- **Clerk** for sign-up, sign-in, sessions, and protected routes.
- **Prisma 7 + PostgreSQL** with the initial application `User` model and a committed migration.
- **Environment templates** that document every required secret and connection string.

## Project structure

```text
app/                         Next.js App Router pages and API routes
  api/copilot/               Existing educational chat endpoint
  sign-in/                   Clerk sign-in route
  sign-up/                   Clerk sign-up route
components/auth/             Reusable authentication UI
generated/prisma/            Generated Prisma client (created locally; ignored by Git)
lib/                         Server-side helpers (auth and database client)
prisma/                      Schema and versioned SQL migrations
proxy.ts                     Clerk route protection for Next.js 16
prisma.config.ts             Prisma CLI and migration configuration
postcss.config.mjs           Tailwind CSS PostCSS integration
```

## First-time setup

1. Install project packages:

   ```cmd
   npm install
   ```

2. Copy `.env.example` to `.env.local`, then fill in the real values.

   ```cmd
   copy .env.example .env.local
   ```

3. In the Clerk Dashboard, create a development application and add its publishable and secret keys to `.env.local`.

4. Create a PostgreSQL database (Neon, Supabase, or Prisma Postgres work well). Add its **pooled** connection string as `DATABASE_URL` and its **direct** connection string as `DATABASE_URL_UNPOOLED` (or `DIRECT_URL`). Neon’s `env pull` command does this automatically.

5. Apply the committed migration to your database:

   ```cmd
   npm run db:deploy
   ```

6. Start the app:

   ```cmd
   npm run dev
   ```

Open `http://localhost:3000`.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local application |
| `npm run build` | Create a production build |
| `npm run typecheck` | Validate TypeScript without emitting files |
| `npm run db:generate` | Regenerate Prisma Client after schema changes |
| `npm run db:migrate -- --name <name>` | Create and apply a local development migration |
| `npm run db:deploy` | Apply committed migrations in staging/production |
| `npm run db:studio` | Inspect the connected database with Prisma Studio |

## Authentication and database behavior

`proxy.ts` protects future `/dashboard` and `/api/portfolios` routes. `lib/auth.ts` provides a `requireUserId()` helper for server-only features. The initial `User` table is deliberately separate from Clerk’s identity store and uses `clerkId` as its stable link; syncing Clerk users into this table will be added only when portfolio persistence begins.

## Deployment notes

In Vercel, add every key from `.env.example` as a project environment variable. `postinstall` runs `prisma generate` during deployment, and `npm run db:deploy` should be executed from your CI/CD release step before the application begins serving traffic.
