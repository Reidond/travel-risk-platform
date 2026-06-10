# Research Brief: React Best Practices (React 19+ era, as of June 2026)

## Research Question

**Core question**: What does an expert AI coding agent need to know to write and review
React code that is idiomatic, performant, and correct in the React 19+ / React Compiler /
Server Components era — and which formerly standard practices are now obsolete?

**Sub-questions**:
1. What did React 19/19.1/19.2 ship, and which older patterns do those features replace?
2. What does the React Compiler change about manual memoization discipline?
3. What is the correct mental model for Server vs Client Components, and how should data fetching be split between RSC/loaders and TanStack Query?
4. What is the current state-management decision tree (local → context → zustand/jotai)?
5. What are the highest-harm anti-patterns an agent must catch in review (effects misuse, key misuse, `'use client'` overuse, Server Function security)?

**Depth target**: Expert (judgment) — the skill's consumer is an AI agent that must make
nuanced architecture and review decisions, not just apply recipes.

## Codebase State

This repository (`travel-risk-platform`) is nearly empty — only `docs/`, `CLAUDE.md`,
`AGENTS.md`, and AI-infrastructure skills exist. There is no React code, no `package.json`,
and no frontend conventions yet. The skill therefore encodes ecosystem-wide best practice
rather than project-specific precedent, and will shape the project's future frontend.
A sibling skill `typescript-best-practices` owns TS language practices; `web-dev-best-practices`
owns accessibility/CSS/security generally — this skill must stay React-specific.

## Verified Currency Facts (June 2026)

- **Latest React**: 19.2.x line (19.2.7, June 1 2026). React 19 GA Dec 2024; 19.2 Oct 2025. No React 20.
- **React Compiler 1.0**: stable Oct 7 2025; supported on React 17/18/19; integrations for Babel, Vite, Rsbuild, Metro; Next.js ≥15.3.1 built-in flag. Official docs now say: rely on the compiler for new code; keep existing manual memoization in old code (removal can change output); compiler only memoizes components/hooks, not standalone functions; requires Rules of React compliance; `eslint-plugin-react-hooks` v6 ships compiler-powered rules.
- **React 19.2 additions**: `<Activity />` (visible/hidden pre-rendering), **stable `useEffectEvent`**, `cacheSignal` (RSC), Performance Tracks in Chrome DevTools, partial pre-rendering APIs, batched Suspense reveals for SSR, `useId` prefix change.
- **Create React App sunset** (Feb 2025). Official guidance (react.dev/learn/creating-a-react-app): start with a full-stack framework — Next.js App Router, React Router v7 framework mode, Expo (native); emerging: TanStack Start, RedwoodSDK. Build-from-scratch path: Vite / Parcel / Rsbuild + own routing/data layer.
- **RSC security incidents Dec 2025** (unauthenticated RCE; DoS/source exposure) — patched in 19.0.1/19.1.2/19.2.1. Reinforces: keep React patched and treat Server Functions as public endpoints.
- **React Foundation** under Linux Foundation (Feb 2026) — governance only, no API impact.
- **Testing**: Vitest is the 2026 default runner for new React projects (Jest remains fine for legacy suites); Testing Library + `user-event` remain the component-testing norm.

## Approach Landscape

### React 19 Actions for mutations/forms
- **What**: async transitions; `<form action={fn}>`, `useActionState`, `useFormStatus`, `useOptimistic`; Server Functions via `'use server'`.
- **When**: any form submission or mutation with pending/error/optimistic state.
- **When not**: complex client cache invalidation across many views — pair with TanStack Query mutations instead.
- **Replaces**: hand-rolled `isSubmitting`/`error` useState + onSubmit handlers; `ReactDOM.useFormState`.
- **Maturity**: established. Source: react.dev v19 blog, `use-server` reference.

### React Compiler memoization
- **What**: build-time automatic memoization.
- **When**: enable for all new apps; trust it instead of `useMemo`/`useCallback`/`memo`.
- **When not**: standalone functions outside components; library-interop needing reference identity; measured cases where heuristics fall short.
- **Maturity**: stable (1.0). Source: react.dev/learn/react-compiler.

### Server Components (framework-rendered)
- **What**: components that run only on the server; zero bundle cost; async data access.
- **Mental model**: server components are "just another framework loader"; `'use client'` marks the *boundary* (entry point into client bundle), not "this renders only on client" — client components still SSR.
- **When**: default in Next.js App Router; anything non-interactive.
- **When not**: SPAs without an RSC framework — use loaders + Query instead.
- **Maturity**: established in Next.js; emerging elsewhere. Source: react.dev RSC reference, Josh Comeau "Making Sense of React Server Components".

### Data fetching: framework loaders vs TanStack Query
- **Loaders/RSC**: initial data for a route; fetch-before-render kills waterfalls.
- **TanStack Query**: client async-state — background refetch, optimistic mutations, infinite scroll, dedupe, offline. Hybrid norm: prefetch on server → hydrate QueryClient → `useQuery`/`useSuspenseQuery` in client components.
- **TkDodo guidance**: "React Query manages async state on the client. If data fetching happens exclusively on the server, you probably don't need it." Source: tkdodo.eu, TanStack advanced-ssr docs.

### State management decision ladder (2026 consensus)
server data → TanStack Query; form data → form actions or react-hook-form; sharable-by-URL → URL/search params; local → `useState`/`useReducer`; shared app-wide simple → Zustand (~3KB, selector-based); shared fine-grained → Jotai (atomic); read-mostly DI (theme, locale, current user) → Context; Redux Toolkit only for large teams needing strict architecture. Context is NOT a state manager for hot data — every consumer re-renders.

### Component design
- Composition over configuration: children/slots over boolean-prop proliferation.
- Compound components (context-backed) for multi-part widgets.
- Custom hooks have largely replaced render-props/HOCs for logic reuse.
- `ref` as a normal prop (19) — `forwardRef` is legacy, slated for removal.
- `<Context value={...}>` renders directly as provider (19).

## Common Oversimplifications

| Simplified version | What's actually true | Why it matters |
|---|---|---|
| "Compiler means delete all useMemo/useCallback" | Keep them in existing code (output can change); still needed for non-React functions and rare measured cases | Blind removal regresses perf |
| "`'use client'` makes a component client-side rendered" | It marks a bundle boundary; client components still SSR; everything imported below it becomes client code | Misplacement bloats bundles |
| "useEffectEvent fixes all dependency lint errors" | Only for *event-like* logic fired from effects; must not be in dep arrays; cannot be passed around | Misuse hides real reactivity bugs |
| "Context causes re-renders, so always use Zustand" | Context is correct for low-frequency DI values | Cargo-cult library adoption |
| "Server Actions are internal functions" | Each `'use server'` function is a public, unauthenticated HTTP endpoint | RCE-class security mistakes |
| "TanStack Query is obsolete under RSC" | Hybrid prefetch+hydrate is the 2026 norm for interactive data | Losing client cache features |

## Recent Developments (affecting recommendations)

- `useEffectEvent` stable (19.2) — supersedes the "latest ref" workaround pattern.
- `<Activity />` stable — supersedes CSS-hide-and-keep-mounted hacks for tab/back-forward state retention.
- CRA dead; Vite-SPA is the explicit "build from scratch" path, framework-first is the official default.
- eslint-plugin-react-hooks v6 + compiler lint rules are now expected linting baseline.
- RSC CVEs (Dec 2025) make Server Function input validation and version patching a hard rule.

## Anti-Patterns (compiled)

1. **useEffect for derived state** — compute during render (or `useMemo` pre-compiler). Source: react.dev/learn/you-might-not-need-an-effect.
2. **useEffect chains** (effect sets state → triggers next effect) — cascade renders; restructure into single event handler or derive.
3. **useEffect as event handler** (react to state flag to "do" something) — put logic in the handler.
4. **useEffect data fetching by hand** — race conditions, no caching; use loaders/RSC/Query.
5. **Resetting state via effect on prop change** — use `key` to remount.
6. **Index as key** for dynamic lists — state misassociation; use stable IDs.
7. **`'use client'` at page/directory level** — push to leaf interactive components.
8. **Server Function without validation/authz** — public endpoint; validate (e.g. zod) + authorize inside every action.
9. **Context for high-frequency state** — all consumers re-render; split contexts or use Zustand/Jotai.
10. **Copying server data into a client store** (Redux/Zustand) and syncing manually — use Query cache as source of truth.
11. **Hand-memoizing new code under the compiler** — noise; trust the compiler, verify with DevTools/profiler.
12. **`forwardRef` in new code** — `ref` is a normal prop in 19.
13. **Defining components inside components** — remount on every render, state loss.
14. **Boolean-prop proliferation** instead of composition/compound components.
15. **State that duplicates props** (`useState(props.x)` without reset intent) — derive or lift.
16. **Hand-rolled form pending/error state** — use actions + `useActionState`/`useFormStatus`.
17. **Testing implementation details** (state, instance, shallow render); wrong queries; `fireEvent` over `user-event`; manual `act` wrapping. Source: Kent C. Dodds "Common mistakes with React Testing Library".
18. **Conditional/looped hooks** — Rules of React violation; also breaks the compiler.

## Depth Recommendation

**Decision-tree + deep skill.** Multiple valid approaches exist (framework choice, data
fetching, state management) → decision guidance needed. Effects and RSC boundaries have
deep methodology with common misapplication → calibrated GOOD/BAD examples needed. Format:
numbered convention sections (matching `prompt-engineering-conventions`), under 400 lines,
with overflow detail in `references/`.

## Required Examples

1. Effect-for-derived-state vs computing in render (highest-frequency mistake).
2. Form with `useActionState` vs hand-rolled submit state.
3. `'use client'` placement: page-level (bad) vs leaf button (good).
4. `useEffectEvent` correct use (and the dep-array prohibition).
5. `ref` as prop vs `forwardRef`.
6. State-manager decision ladder (table, not code).
7. Key-based state reset vs effect reset.
8. RTL query priority + `user-event` (good) vs container query + fireEvent (bad).
9. Server Function with zod validation + authz vs trusting typed args.

## Key Sources

1. react.dev — React 19 release post (Dec 2024), React 19.2 release post (Oct 2025), Compiler docs (`/learn/react-compiler`), "You Might Not Need an Effect", RSC + `'use server'` references, "Creating a React App". Primary authority for everything above.
2. React Compiler v1.0 announcement (react.dev/blog, Oct 7 2025) — stable status, adoption guidance.
3. TkDodo (Dominik Dorfmeister, TanStack Query maintainer) — tkdodo.eu: "You Might Not Need React Query", Query↔RSC and Router/Query integration guidance.
4. Kent C. Dodds — "Common mistakes with React Testing Library" (kentcdodds.com); Testing Library official docs.
5. TanStack docs — Advanced SSR / hydration guides; Start vs Next.js vs React Router comparison.
6. Josh W. Comeau — "Making Sense of React Server Components" (boundary mental model).
7. React security advisories (react.dev/blog Dec 2025) — Server Function/RSC hardening rationale.
8. Ecosystem surveys/comparisons 2026 (state-management and Vitest/Jest landscape posts) — corroboration only, never sole source.

## Recommendations for Skill Content

1. Lead with "what React 19 obsoletes" — agents trained on older data will emit `forwardRef`, manual form state, `useMemo` everywhere; the skill's primary job is overriding stale defaults.
2. Make the effects-discipline section the largest — it is the highest-frequency, highest-harm review category.
3. Encode decisions as ladders/tables (framework choice, data fetching, state management) rather than prose.
4. Include the Server Function security rule prominently — it is the one React-specific item with RCE-class consequences (sibling web skill owns generic security, but `'use server'` endpoint semantics are React-specific).
5. Keep SKILL.md < 400 lines; move React 19 API micro-details, compiler adoption notes, and extended testing patterns to `references/`.
