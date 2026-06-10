# Research Brief: Web Development Best Practices (Framework-Agnostic, mid-2026)

## Research Question

**Core question:** What framework-agnostic web development practices (HTML/accessibility,
CSS, performance, security, API design, forms, platform features) should an AI coding
agent apply by default in mid-2026, and which stale habits and misinformation should it
actively avoid?

**Sub-questions:**
1. What is the current, verified state of Core Web Vitals and their thresholds?
2. What changed in WCAG 2.2 and what do real-world a11y audits (WebAIM Million) show fails most?
3. Which modern CSS and platform features are Baseline (safe to use unguarded) vs emerging?
4. What is current OWASP guidance (Top 10 2025, CSP, CSRF, session storage)?
5. What library habits are now replaced by native platform features?

**Depth target:** Working → Expert. The agent must apply practices correctly by default
AND make nuanced calls (e.g., Tailwind vs vanilla, token CSRF vs Fetch Metadata).

## Codebase State

- The repository is nearly empty: `docs/`, `AGENTS.md`, `CLAUDE.md`, `.claude/` skills,
  `.specs/`. No application code exists yet.
- No existing web conventions to reconcile with; this skill is forward-looking and will
  set the defaults for the travel-risk-platform's future web UI and APIs.
- AGENTS.md constraint: present a plan before bug fixes; prompt templates require
  `/review-prompts` — neither conflicts with this skill.

## Approach Landscape

### Accessibility: Semantic HTML first, ARIA as gap-filler
- **What:** Use native elements (`button`, `a`, `nav`, `dialog`, form controls) before
  reaching for ARIA roles/states. W3C's First Rule of ARIA: don't use ARIA if a native
  element provides the semantics and behavior.
- **When NOT:** ARIA is required for live regions, some composite widgets (tabs,
  comboboxes when native options don't fit), and state not expressible in HTML
  (`aria-expanded`, `aria-current`).
- **Evidence:** WebAIM Million 2026 — 95.9% of top-1M home pages have detectable WCAG
  failures (worse than 2025's 94.8%); pages using ARIA average significantly MORE errors
  than those without. ARIA usage up 27% YoY while accessibility regressed.
- **Source:** W3C WAI ARIA Authoring Practices, MDN ARIA, WebAIM Million 2026.

### Accessibility target: WCAG 2.2 AA
- WCAG 2.2 (Rec since Oct 2023) is the current audit baseline; the European
  Accessibility Act has been enforced since June 2025, raising legal stakes.
- New 2.2 AA criteria to operationalize: Focus Not Obscured (Minimum), Dragging
  Movements (single-pointer alternative), Target Size Minimum (24×24 CSS px with
  spacing/inline exceptions), Consistent Help, Redundant Entry, Accessible
  Authentication Minimum (no cognitive test; allow paste/autofill/passkeys).
  SC 4.1.1 Parsing was removed.
- **Source:** w3.org/WAI/standards-guidelines/wcag/new-in-22/, W3C TR WCAG22.

### Modern CSS: what is Baseline now
- **Safe unguarded (Baseline Widely/Newly available):** container size queries, `:has()`,
  native nesting, `@layer` cascade layers, logical properties, subgrid, `dialog`,
  popover (Baseline 2024), modern color functions (`oklch`, `color-mix`), new viewport
  units (`dvh`/`svh`), `text-wrap: balance`, scroll-driven animations (newly cross-browser).
- **Cross-browser but new (guard or verify):** `@scope` (Firefox shipped late 2025 —
  available in all majors, still new), container *style* queries (Firefox landing via
  Interop 2026).
- **NOT Baseline yet (must use `@supports` / graceful degradation):** CSS anchor
  positioning (per OddBird, Apr 2026: still not baseline), cross-document View
  Transitions (Interop 2026 focus, shipping unevenly).
- **Source:** web.dev/baseline, MDN container queries, OddBird anchor-positioning posts,
  Interop 2026 announcements (web.dev, CSS-Tricks).

### CSS architecture: layers as backbone; Tailwind vs vanilla as a decision, not a religion
- Cascade layers (`@layer reset, base, components, utilities`) replace specificity wars
  and `!important` escalation.
- Tailwind v4 (Jan 2025): CSS-first config, native cascade layers internally, 5x faster
  builds. Community consensus 2026: pick Tailwind for component-driven UIs with teams of
  mixed CSS skill; pick vanilla modern CSS for content/server-rendered sites, readable
  HTML, zero build deps. Hybrid (Tailwind ~90% + scoped custom CSS for complex 10%) is
  the pragmatic norm.
- **Source:** tailwindcss.com/blog/tailwindcss-v4, CSS-Tricks cascade layers + Tailwind.

### Performance: Core Web Vitals (verified against web.dev directly)
- Current Core Web Vitals and "good" thresholds at p75 of field data:
  **LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1**. INP replaced FID as a stable CWV in
  March 2024. web.dev states changes follow an annual cadence; **no threshold change
  is in effect as of June 2026**.
- Loading strategy consensus: one `fetchpriority="high"` on the LCP image; never
  lazy-load the LCP image; lazy-load below-fold; explicit `width`/`height` everywhere;
  AVIF (≈95% support) → WebP (≈96%) → JPEG via `picture`/content negotiation;
  `srcset`+`sizes` for responsive variants.
- Fonts: self-hosted WOFF2, `font-display: swap` PLUS metric-adjusted local fallback
  (`size-adjust`, `ascent-override`, `descent-override`) to avoid swap-induced CLS;
  preload at most 1-2 critical fonts; variable fonts when ≥3 weights.
- JS: "the fastest JS is the JS you don't ship"; ~200 KB compressed initial-load budget
  enforced in CI is a common bar; third-party scripts are the top INP killer — govern
  like infrastructure; break long tasks (`scheduler.yield()`/chunking), move heavy work
  to Workers.
- **Source:** web.dev/articles/vitals (fetched directly), MDN fix-image-lcp blog,
  Request Metrics image guide, MDN JS performance.

### Security: OWASP Top 10 2025 + Cheat Sheets
- **OWASP Top 10:2025 (final):** A01 Broken Access Control (now absorbs SSRF),
  A02 Security Misconfiguration (up from #5), A03 Software Supply Chain Failures (new,
  expands "Vulnerable Components"), A04 Cryptographic Failures, A05 Injection (down from
  #3), A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity
  Failures, A09 Security Logging & Alerting Failures, A10 Mishandling of Exceptional
  Conditions (new — fail-open, improper error handling).
- **XSS:** primary defense remains context-aware output encoding + framework
  auto-escaping; CSP is defense-in-depth. Modern CSP = nonce-based strict CSP:
  `script-src 'nonce-{random}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`.
  Domain-allowlist CSPs are widely bypassable (JSONP/Angular gadgets) — deprecated
  practice. Trusted Types (`require-trusted-types-for 'script'`) addresses DOM XSS.
- **CSRF:** As of the Dec 2025 OWASP CSRF Cheat Sheet update, **Fetch Metadata
  (`Sec-Fetch-Site`) validation is listed as a complete primary defense** for
  modern-browser-only apps: reject state-changing requests where `Sec-Fetch-Site:
  cross-site`; treat missing header as unknown → fall back to Origin/Referer or
  synchronizer tokens. `SameSite` cookies alone are NOT sufficient (same-site JS
  contexts, subdomain trust, old browsers).
- **Sessions/tokens:** never in `localStorage`/`sessionStorage` (any XSS = token theft).
  Gold standard 2026: short-lived access token in memory + refresh token in
  `HttpOnly; Secure; SameSite` cookie with rotation + reuse detection; or plain
  server-side sessions in an `__Host-` prefixed cookie. `__Host-` prefix pins cookie to
  origin (requires `Secure`, `Path=/`, no `Domain`).
- **Headers baseline (OWASP Secure Headers Project):** HSTS, CSP,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  COOP/COEP/CORP trio. `X-Frame-Options` superseded by `frame-ancestors`.
- **Validation:** all validation server-side; client-side is UX only.
- **Source:** owasp.org/Top10/2025, OWASP Cheat Sheet Series (CSP, CSRF, Session
  Management, HTTP Headers), web.dev/articles/strict-csp, MDN CSRF guide.

### API design (REST basics)
- Plural noun resources, HTTP methods for semantics, correct status codes (no
  200-with-error-envelope), pagination on collections.
- **Error shape: RFC 9457 Problem Details** (`application/problem+json` with `type`,
  `title`, `status`, `detail`, `instance` + extensions) — obsoletes RFC 7807, adds IANA
  registry. Never leak stack traces.
- Caching: `Cache-Control` explicit on every response; `ETag` + `If-None-Match` → 304;
  prefer ETag over `Last-Modified`; immutable + content-hash for static assets.
  Idempotency keys for unsafe retried operations.
- **Source:** RFC 9457 (rfc-editor.org), Swagger/SmartBear Problem Details guides,
  Speakeasy API error practices.

### Forms
- Native `<form>` + real submit; visible `<label>` per control (placeholder is not a
  label); correct `type`/`inputmode`; standardized `autocomplete` tokens (WCAG 1.3.5
  requires them on personal-data fields; ~50% fewer mobile input errors).
- Validation: server-side authoritative; inline errors linked via `aria-describedby`,
  `aria-invalid`; "submit-then-blur" timing (don't flag while user types untouched
  fields); errors name the problem and the fix.
- Progressive enhancement: form must work before/without JS (server handles POST).
- **Source:** Pope Tech accessible form validation (2025), MDN forms, web.dev forms.

### Native platform features replacing library habits
- `<dialog>` (modality, focus trapping, `::backdrop`, Esc) replaces modal libraries.
- Popover API (Baseline 2024) + `popovertarget` replaces tooltip/menu/overlay JS —
  top-layer rendering, light dismiss, no z-index management.
- Same-document View Transitions: Baseline 2025; cross-document: emerging (Interop 2026).
- `fetch` + `AbortController` (timeouts, cancelling stale requests) replaces axios
  habits for most use; `structuredClone`, `Intl.*`, `<details>`, `URLSearchParams`
  replace lodash/moment/accordion-library habits.
- **Source:** MDN Popover API, web.dev/blog/popover-api, web.dev Interop 2026.

## Common Oversimplifications

| Simplified Version | What's Actually True | Why It Matters |
|---|---|---|
| "Google tightened LCP to 2.0s in 2026" / "CWV 2.0 with Visual Stability Index" | web.dev (fetched 2026-06) still defines good LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1; no such new metrics announced | SEO-spam blogs fabricate threshold changes; an agent must trust web.dev/CrUX only |
| "SameSite=Lax stops CSRF" | Mitigates only cross-site browser-sent cookies; same-site JS contexts, subdomains, and non-cookie auth still need Fetch Metadata or tokens | False sense of security on state-changing endpoints |
| "Add CSP with a domain allowlist" | Allowlist CSPs are bypassable (JSONP, gadget scripts); strict nonce + `strict-dynamic` is the recommended pattern | A bypassable CSP is compliance theater |
| "ARIA makes pages accessible" | Pages with ARIA average more detected errors; ARIA adds semantics, never behavior (keyboard handling stays your job) | Bad ARIA actively breaks screen-reader UX |
| "`font-display: swap` fixes font performance" | Without metric-adjusted fallbacks (`size-adjust` etc.), swap causes CLS | Fixes FOIT but trades it for layout shift |
| "Lazy-load all images" | Lazy-loading the LCP image delays it behind layout + IntersectionObserver | Directly worsens the metric being optimized |
| "JWTs in localStorage are fine if you escape output" | One XSS anywhere in origin = token exfiltration; no HttpOnly equivalent exists | OWASP explicitly warns against it |
| "Every image needs alt text" | Decorative images need `alt=""` (explicitly empty), or screen readers read filenames | Redundant alt is noise; missing alt is failure |
| "Tailwind vs vanilla CSS — pick a side" | Decision depends on team, componentization, build tooling; hybrid via cascade layers is mainstream | Dogma produces wrong tool for context |
| "Client-side validation protects the API" | UX only; server must re-validate everything | Trivially bypassed with curl |

## Recent Developments (last ~18 months)

1. **OWASP Top 10:2025** published (Nov 2025): SSRF folded into A01, new A03 Supply
   Chain and A10 Exceptional Conditions categories.
2. **OWASP CSRF Cheat Sheet (Dec 2025)** elevates Fetch Metadata / `Sec-Fetch-Site`
   to a standalone primary defense.
3. **`@scope`** reached all major browsers (Firefox, late 2025).
4. **Tailwind v4** (Jan 2025): CSS-first config, native cascade layers.
5. **Same-document View Transitions** Baseline 2025; cross-document VT + anchor
   positioning are Interop 2026 focus areas (not yet safe unguarded).
6. **European Accessibility Act** enforcement began June 2025 — WCAG 2.2 AA legally
   material for EU-facing products.
7. **WebAIM Million 2026** (Feb 2026): first regression in 7 years; same six error
   types = 96% of all detected errors.
8. **INP** stable CWV since March 2024 (FID retired) — still the newest CWV; no 2026
   threshold changes despite widespread SEO misinformation.

## Anti-Patterns

1. **Div soup interactivity** — `onClick` on `<div>`: no keyboard, no focus, no role.
   Use `<button>`. (WebAIM: empty/fake buttons are top-6 errors.)
2. **Redundant/bad ARIA** — `role="button"` on `<button>`, `aria-label` duplicating
   visible text, ARIA widgets without keyboard handlers.
3. **`outline: none` without replacement** — invisible focus fails WCAG 2.4.7/2.4.11.
4. **Placeholder as label** — disappears on input; fails labeling; top-6 WebAIM error.
5. **Lazy-loading the LCP image / no `fetchpriority` strategy.**
6. **Media without reserved space** — missing width/height/aspect-ratio → CLS.
7. **`'unsafe-inline'` or allowlist CSP** — bypassable; use nonces + `strict-dynamic`.
8. **Tokens in localStorage** — XSS = account takeover.
9. **Trusting client-side validation / client-supplied IDs** — server must validate
   and authorize per-object (A01 Broken Access Control is #1).
10. **`innerHTML` with user data** — DOM XSS; use `textContent` / sanitize / Trusted Types.
11. **GET endpoints with side effects** — breaks CSRF assumptions, caches, prefetch.
12. **200-with-error-body APIs / stack traces in errors** — breaks clients and leaks
    internals; use status codes + RFC 9457, generic detail in prod.
13. **Specificity wars / `!important` escalation** — use `@layer` ordering.
14. **Custom modal/tooltip stacks** — `<dialog>`/popover give focus management,
    top layer, light dismiss for free.
15. **Fetch without AbortController** — stale responses race; no timeout.
16. **JS-required core flows** — forms/navigation that break before hydration; no
    progressive enhancement.
17. **Disabling zoom** (`user-scalable=no`) — accessibility failure.
18. **SPA state not in URL** — breaks back button, sharing, refresh.

## Depth Recommendation

**Deep reference skill, rule-based** (like `prompt-engineering-conventions`): the topic
has settled consensus per area but common misapplication — numbered rules with rationale
and GOOD/BAD calibration where mistakes are frequent (a11y, CSP, cookies, images, forms,
error shapes). Rapidly-evolving corners (Baseline status, OWASP editions) should teach
the *verification habit* ("check Baseline/web.dev/OWASP, distrust SEO blogs") — pointer-skill
style. Keep SKILL.md ≤ 400 lines; overflow (full header sets, CSP recipes, OWASP list,
platform-feature catalog) goes to `references/`.

## Required Examples

1. `<button>` vs clickable `<div>` (GOOD/BAD) — most common a11y failure class.
2. Decorative vs informative `alt` (GOOD/BAD).
3. Strict nonce CSP header vs allowlist CSP (GOOD/BAD).
4. Session cookie attributes with `__Host-` (GOOD/BAD).
5. RFC 9457 error response vs 200-with-error envelope (GOOD/BAD).
6. Labeled form field with autocomplete + linked error vs placeholder-only (GOOD/BAD).
7. LCP image markup (`fetchpriority`, dimensions, no lazy) vs lazy LCP (GOOD/BAD).
8. `@font-face` with metric-adjusted fallback (GOOD).
9. `fetch` with AbortController timeout/cancellation (GOOD).
10. Cascade-layer ordering declaration (GOOD).

## Key Sources

1. **web.dev/articles/vitals** (fetched directly) — canonical CWV definitions/thresholds;
   used to debunk SEO misinformation.
2. **OWASP Top 10:2025** (owasp.org/Top10/2025) — current risk ranking.
3. **OWASP Cheat Sheet Series** — CSP, CSRF Prevention (Dec 2025 Fetch Metadata update),
   Session Management, HTTP Security Headers.
4. **web.dev/articles/strict-csp** — nonce + `strict-dynamic` pattern.
5. **W3C WAI — What's New in WCAG 2.2** (w3.org/WAI/standards-guidelines/wcag/new-in-22/).
6. **WebAIM Million 2026** (webaim.org/projects/million/) — empirical failure data.
7. **MDN** — ARIA, Popover API, CSP guide, CSRF guide, container queries, image LCP blog.
8. **RFC 9457** (rfc-editor.org/info/rfc9457) — Problem Details standard.
9. **web.dev/baseline + Interop 2026 posts** — feature availability calibration.
10. **tailwindcss.com/blog/tailwindcss-v4** — current Tailwind architecture.
11. **OddBird (oddbird.net)** — anchor positioning maturity caution (Apr 2026).
12. **Pope Tech blog (2025)** — accessible form validation patterns.

## Recommendations for Skill Content

1. Cover, in order: semantic HTML + a11y → CSS → performance → security → APIs →
   forms → progressive enhancement → native platform features. Security and a11y get
   the most GOOD/BAD pairs (highest harm from miscalibration).
2. Warn explicitly against: the 18 anti-patterns above; SEO-blog CWV misinformation;
   allowlist CSPs; localStorage tokens; ARIA overuse.
3. Embed a currency habit: thresholds/Baseline/OWASP editions verified against
   web.dev, MDN Baseline data, owasp.org — never SEO aggregators.
4. Structure as numbered conventions (match `prompt-engineering-conventions` style);
   `user-invocable: false`, `metadata.type: reference`; overflow detail in
   `references/security.md` and `references/platform-and-performance.md`.
