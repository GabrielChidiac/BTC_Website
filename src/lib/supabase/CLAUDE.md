# src/lib/supabase/CLAUDE.md

Scoped guidance for Supabase clients. See [/CLAUDE.md](/CLAUDE.md) for global rules and [../CLAUDE.md](../CLAUDE.md) for shared lib conventions.

## Scope
Three client constructors. **Always import from this directory; never import `@supabase/supabase-js` directly.**

## Files
- [server.ts](server.ts) — exports two:
  - `createServerClient()` — for **Server Components**. Respects RLS via the request cookie.
  - `createServiceClient()` — for **Trigger.dev tasks + API route handlers**. Bypasses RLS using `SUPABASE_SERVICE_ROLE_KEY`.
- [client.ts](client.ts) — exports `createClient()` for **client components**.

## Picking the right client
| Caller | Client |
|---|---|
| Server Component (e.g., a `page.tsx` rendering on the server) | `createServerClient()` |
| Trigger.dev task | `createServiceClient()` |
| Next.js API route handler (`app/api/.../route.ts`) | `createServiceClient()` (or `createServerClient()` if you need the user session) |
| Client component (`"use client"`) | `createClient()` |

## Conventions
- **Always `.maybeSingle()`** for single-row reads. Never `.single()` — it throws on 0 rows and breaks the `Result<T>` pattern.
- All wrappers built on top of these clients should return `Result<T>`; never let Supabase errors bubble.

## Anti-patterns
- No raw `@supabase/supabase-js` imports. Use `@supabase/ssr` only via these helpers.
- No `.single()` on reads.
- No service-role key in client components — `createClient()` uses the anon key only.
