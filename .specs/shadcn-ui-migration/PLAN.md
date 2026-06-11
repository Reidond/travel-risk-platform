# shadcn/ui Migration — Design Plan & Status

> Produced by the multi-agent recon/design workflow on 2026-06-11; implemented the same day.
> Status: Phases 0–3 DONE (toolchain, shared components, all four page tracks, verification).
> Follow-ups F1–F6 below are NOT yet implemented.
>
> Implementation deviations from this plan:
> - `dashboard.exportDisabled` key dropped — the EmptyState/toolbar-skip pattern made it unreachable.
> - charts.tsx needed no changes (no legacy classes; chart tokens are follow-up F3).
> - Rule-row delete and single-criterion remove stay unconfirmed (local, reversible edits); the five
>   confirmed destructive paths are region delete, respondent delete, criteria-group delete,
>   ruleset reset, and run-all.
> - scripts/make_screenshots.py updated: "Run all" now confirms the AlertDialog before waiting on .step-card.

# shadcn/ui Migration + UX Improvement Plan — travel-risk-platform frontend

Decisions made where inputs disagreed (binding for implementation):

1. **Radix everywhere for overlays.** Modal.tsx migrates to shadcn Dialog; all destructive confirms use AlertDialog; respondents drill-down later becomes a Sheet. No mixing native `<dialog>` and Radix — the native dialog is deleted. This also fixes the StrictMode `showModal()` bug for free.
2. **Selects: Radix for standalone form fields, native for embedded/dense contexts.** Radix Select for: run selector, drill-region, RegionFormModal Δ-level, import target region. Styled **native** `<select>` stays for: PanelPage in-table Δ cells and RulesSection `.rule-slot` pill selects (compactness, no sentinel hacks in dense rows). Per-criterion 1–5 ratings become **RadioGroup**, not Select.
3. **Language switcher stays custom** (two buttons, `aria-pressed`), restyled with Tailwind/`toggleVariants` classes. No ToggleGroup (it swaps aria-pressed for radio semantics).
4. **Pagination stays the custom component**, rebuilt internally with shadcn Buttons + a page-size Select. shadcn Pagination (anchor-oriented) is not adopted.
5. **No `@tanstack/react-table`.** All tables are server-paginated, unsorted, fixed-column — plain shadcn Table primitives suffice. Cut from the install list.
6. **No NavigationMenu.** NavLinks styled with `buttonVariants`; mobile nav Sheet is a follow-up.
7. **react-hook-form + zod is a follow-up**, not part of the mechanical migration. During conversion, existing useState validation is kept and only restyled (form-level Alert + `text-destructive` messages with `role="alert"` preserved).

---

## Theme mapping

Light-only. Delete the generated `.dark` block, keep `color-scheme: light` on `:root`. All values below are oklch conversions of the existing hex palette — re-verify with a converter during implementation, do not eyeball.

### Core shadcn variables (`:root` in `src/index.css`)

| Legacy token (index.css) | Hex | shadcn variable(s) | oklch |
|---|---|---|---|
| `--c-bg` | `#f5f6f8` | `--background` | `oklch(0.972 0.003 255)` |
| `--c-surface` | `#ffffff` | `--card`, `--popover` | `oklch(1 0 0)` |
| `--c-text` | `#1f2430` | `--foreground`, `--card-foreground`, `--popover-foreground` | `oklch(0.266 0.023 268)` |
| `--c-text-muted` | `#5b6371` | `--muted-foreground` | `oklch(0.506 0.024 261)` |
| `--c-border` | `#d8dce3` | `--border`, `--input` | `oklch(0.894 0.011 255)` |
| `--c-primary` | `#1565c0` | `--primary` | `oklch(0.46 0.14 256)` |
| `--c-primary-dark` | `#0d4a8f` | hover via `hover:bg-primary/90` (drop token) or keep as `--primary-dark` if exact hover parity wanted | `oklch(0.388 0.124 255)` |
| — | `#ffffff` | `--primary-foreground`, `--destructive-foreground` | `oklch(0.985 0 0)` |
| `--c-danger` | `#c62828` | `--destructive` | `oklch(0.513 0.187 27)` |
| `--c-focus` | `#1565c0` | `--ring` | `oklch(0.46 0.14 256)` |
| derived (between bg and border) | ~`#eceef2` | `--muted`, `--secondary` (+ `--secondary-foreground` = foreground) | `oklch(0.945 0.004 255)` |
| `--c-info-bg` / `--c-info-text` | `#e3edf8` / `#174a7c` | `--accent` / `--accent-foreground` (matches current `.btn` hover info tint) | `oklch(0.937 0.018 250)` / `oklch(0.39 0.09 252)` |
| `--radius: 8px` | — | `--radius: 0.5rem` | — |
| `--shadow` | — | keep as-is (used by cards); shadcn `shadow-sm` is visually equivalent | — |

### Status palette (custom variants, registered in `@theme inline` as colors)

shadcn ships only default/destructive Alert and default/secondary/destructive/outline Badge. Add app tokens and cva variants:

| Legacy | Hex pair | New tokens | Used by |
|---|---|---|---|
| `--c-ok-bg`/`--c-ok-text` | `#e6f3e7`/`#1d5e22` | `--success` / `--success-foreground` → `oklch(0.953 0.021 150)` / `oklch(0.42 0.11 145)` | `Alert variant="success"`, `Badge variant="success"` (status-ok pill) |
| `--c-warn-bg`/`--c-warn-text` | `#fdf0d7`/`#6e4e00` | `--warning` / `--warning-foreground` → `oklch(0.957 0.034 85)` / `oklch(0.42 0.09 85)` | `Badge variant="warning"` (status-warn pill), `Alert variant="warning"` |
| `--c-info-bg`/`--c-info-text` | `#e3edf8`/`#174a7c` | `--info` / `--info-foreground` (same values as accent) | `Alert variant="info"` (callouts, demo-conflict) |
| `--c-error-bg`/`--c-error-text` | `#fbe5e5`/`#8e1c1c` | folded into `Alert variant="destructive"` styling (soft bg + dark red text, matching current look — override shadcn's default destructive alert style) | ErrorNote |

### Chart tokens

`--chart-1: oklch(0.46 0.14 256)` (#1565c0 curve), `--chart-2: oklch(0.45 0.18 315)` (#7b1fa2 extra curve), `--chart-3: oklch(0.266 0.023 268)` (#1f2430 reference dots). Consumed when charts.tsx is tokenized (follow-up F3).

### Explicitly NOT tokenized

`RISK_CLASS_COLORS`, `TERM_COLORS`, `badgeTextColor()` in `frontend/src/lib/colors.ts` are **API_CONTRACT.md-mandated domain data shared with recharts** — they stay hex, applied via inline `style`, single source of truth in colors.ts. Badge/Tooltip components only provide shape/typography around them. The WCAG contrast switch (`badgeTextColor`) survives untouched.

### Focus visibility

Keep a global rule in `@layer base`: `:focus-visible { outline: 3px solid var(--ring); outline-offset: 2px; }` for non-shadcn elements. In the generated `src/components/ui/*` files, sweep `focus-visible:ring-ring/50` → `focus-visible:ring-ring` (full opacity, 3px ring already standard in new-york v4) so the ring matches the current 3px/offset-2 visibility (WCAG 2.2 focus appearance). Do not let any component keep `outline-none` without an equally visible ring.

### index.css structure after init

`@import "tailwindcss";` → `:root { tokens }` → `@theme inline { --color-* mappings, --radius-* }` → `@layer base { border-border, bg-background text-foreground, focus-visible rule, h1–h4 scale, color-scheme: light }` → **temporarily** the surviving legacy rules (`.steps/.step-card/.step-arrow`, `.rule-slot`, `.risk-legend`, `.criterion-edit-row`, fieldset/legend styling) until each is ported to utilities; everything else from the 762-line file is deleted as its consumers migrate.

---

## Component adoption map

Install once (from `frontend/`):

```
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init        # base color: neutral; CSS variables: yes; style: new-york
npx shadcn@latest add button badge card alert alert-dialog dialog sheet tabs collapsible table input label select checkbox radio-group tooltip skeleton sonner separator popover command field form empty
```

(`form`/`field`, `popover`, `command`, `sheet` are installed now but first used in follow-ups; if `empty` is absent from the registry, compose EmptyState from Card + Button. Do **not** add: `toast` (deprecated), `dropdown-menu`, `navigation-menu`, `pagination`, `@tanstack/react-table`.)

| # | Current pattern | shadcn replacement | Key constraints |
|---|---|---|---|
| 1 | `.btn`/`.btn-primary`/`.btn-danger`/`.btn-small`/`.btn-icon` (index.css, everywhere) | **Button** — `.btn`→`variant="outline"`, `.btn-primary`→`variant="default"`, `.btn-danger`→`variant="outline"` + destructive classes (it's outline-destructive today; add an `outline-destructive` cva variant), `.btn-small`→`size="sm"`, `.btn-icon`→`variant="ghost" size="icon"` | Native `disabled` (never aria-disabled); pending label swaps (`t('common.saving')` etc.) stay text, not spinner-only; `aria-pressed`/`aria-label` forwarded |
| 2 | Link-styled-as-button (`<Link className="btn">`, export `<a download>`) | **Button asChild** wrapping `Link`/`<a download>` | Exports stay real anchors |
| 3 | `components/Modal.tsx` (native `<dialog>`+showModal) | **Dialog** (DialogContent/DialogHeader/DialogTitle/DialogFooter) | DialogTitle = real h2 (`asChild`); wide variant → `sm:max-w-[50rem]` on DialogContent; body scroll → `max-h-[70vh] overflow-y-auto`; close button sr-only text overridden to `t('common.close')`, lucide `X`; verify focus trap/Esc/focus-return |
| 4 | `window.confirm` (region+respondent delete) and unconfirmed remove-group / delete-rule / reset-to-default / Run-all | **AlertDialog** via one shared `<ConfirmDialog>` in `components/` | Localized title/description; destructive action = `buttonVariants({variant:'destructive'})`; surfaces `mutation.isPending` (disabled + `t('common.deleting')`); region delete names the respondent cascade |
| 5 | `.panel-card` sections, `.region-card`, `.result-card` | **Card** rendered as `<section>`/`<article>` (asChild or className on semantic element) | Keep `aria-labelledby` ↔ h2 id wiring; CardTitle must be a real h2/h3, never a div; `<dl>` region facts kept verbatim; selected state = `ring-2 ring-primary` driven by the existing `aria-pressed` button |
| 6 | `RiskClassBadge`/`TermBadge` (Badges.tsx) | **Badge** shell + inline colors from colors.ts | Inline `backgroundColor`/`color` stay; compact mode gains Tooltip + sr-only full label (UX-5) |
| 7 | `.status-badge .status-ok/.status-warn` | **Badge** `variant="success"`/`variant="warning"` (custom cva) | — |
| 8 | `.alert-*` + `ErrorNote`/`Loading` (Feedback.tsx) | **Alert** (destructive/success/info/warning variants) + **Skeleton** | Explicit `role="alert"` on errors, `role="status"` on success/info/loading — never trust the component default per variant; Skeleton always paired with sr-only `role="status"` `t('common.loading')` node |
| 9 | `.table-wrap > table.data-table` (respondents, panel, comparison, individuals, import errors, version history) | **Table** (TableHeader/TableHead/TableBody/TableRow/TableCell/TableCaption) | Manually re-add `scope="col"`/`scope="row"`; every table gets a TableCaption (localized); import-errors caption stays a real `<caption>`; `.ratings-cell` monospace stays a className; numeric columns `text-right tabular-nums` |
| 10 | `components/Pagination.tsx` | **keep custom**, internals → Button; add page-size **Select** | Static localized `aria-label` on `<nav>`; range text becomes `aria-live="polite"`; native `disabled` at bounds |
| 11 | Standalone native `<select>` (run selector, drill-region, RegionFormModal Δ, import target region) | **Select** (Radix) | Empty `value=''` "not set" options → sentinel `"none"` mapped to null at the API boundary (Radix forbids empty item values); keep Label htmlFor→SelectTrigger id; option text via `t()` |
| 12 | In-table Δ select (PanelPage) and `.rule-slot` pill selects (RulesSection) | **keep native `<select>`**, styled with shadcn native-select classes | Keep `aria-label`/visually-hidden labels |
| 13 | Per-criterion 1–5 rating selects (RespondentFormModal) | **RadioGroup** (5 horizontal items per criterion) | Native `fieldset`+`legend` per criteria group kept (no shadcn equivalent); scale legend `t('scale.l1'..'l5')` shown once, sticky in modal body |
| 14 | Row-select checkboxes (PanelPage) | **Checkbox** + new header select-all with `checked="indeterminate"` | Keep per-row `aria-label={t('panel.selectRegion',{name})}` |
| 15 | `label`/`input` pairs, `.form-field` | **Label** + **Input** (type=number/text/file all via Input) | Keep htmlFor/id, min/max/step on Ξ and thresholds, `maxLength={16}` codes, `accept=".xlsx,.csv"`; file input stays native |
| 16 | `fieldset.criteria-group`/`.config-group` + legend | **keep custom** (native fieldset/legend, Tailwind-styled) | Must-survive a11y feature |
| 17 | `title=` tooltips (badges, Δ cells) and `<abbr title>` Greek headers | **Tooltip** on focusable triggers | Keep `title` as no-JS fallback + sr-only text; content via `t()` |
| 18 | `.muted` empty paragraphs | **Empty** pattern with CTA Button (UX-1) | — |
| 19 | ImportPanel placement | **Collapsible** (trigger = outline Button + ChevronDown) | `<section aria-labelledby>` + h2 kept inside CollapsibleContent; auto-open when 0 regions |
| 20 | ParametersPage stacked sections | **Tabs** (config/rules/criteria), URL-synced | Each section keeps its landmark + h2 inside TabsContent |
| 21 | Success feedback (none today / mid-form alerts) | **Sonner** (`<Toaster theme="light"/>` in App.tsx; strip next-themes import) | Policy: transient success → toast; errors → inline Alert, never toast |
| 22 | Text glyphs ✕ ↑ ↓ | **lucide-react** `X`, `ArrowUp`, `ArrowDown` (+ `Menu`, `ChevronDown`) | Existing aria-labels kept |
| 23 | `.visually-hidden` | Tailwind **sr-only** (sweep all call sites) | — |
| 24 | App nav NavLinks, lang switcher | **keep custom**: NavLink + `buttonVariants({variant:'ghost'})`, active style via `[aria-current="page"]` selector; lang buttons keep `aria-pressed` | No NavigationMenu, no ToggleGroup |
| 25 | recharts (MuBarChart/DistributionChart/CurveChart), `.risk-legend`, `.steps` pipeline, `.rule-slot` chips, rule sentence, `ol.rule-list`, `ul.distribution-list`, `<dl>` facts, layout wrappers (`.page-head`, `.row-actions`, `.filters`, `.form-actions`, `.charts-row`), lib/colors.ts, lib/format.ts, i18n bootstrap, App.tsx query/router | **keep custom** — restyle with Tailwind utilities only | Semantic lists (`ol`/`ul`/`dl`), `aria-hidden` arrows, `role="list"` legend all preserved verbatim; ChartContainer wrap is follow-up F3 |

---

## UX improvements

Ordered by impact/effort. Everything below respects the constraints: all new strings get uk/en key pairs, recharts stays, light-only, no a11y regressions.

### With-migration (do during the page's conversion — near-free)

1. **UX-1: Empty states → guided funnel CTAs** (high/low). `dashboard.noRuns` → CTA to /panel; `panel.noRegions` → CTA to /regions; `regions.noRegions` → open create-modal + load-demo CTA. Empty pattern, copy via new `emptyStates.*` keys.
2. **UX-2: AlertDialog for all five destructive paths** (high/medium). One shared ConfirmDialog; fixes unstyled window.confirm, missing confirmations in Parameters, invisible `deleteMutation.isPending`, and the unannounced region→respondents cascade.
3. **UX-3: Sonner success toasts + feedback policy** (high/low). Region/respondent create-edit-delete, panel row save, rules reset, ConfigSection "saved as version N" (moves out of mid-form). Errors stay inline `role="alert"`.
4. **UX-4: Skeletons everywhere Loading is** (medium/low). Content-shaped (card grid / table rows / chart rectangles / dashboard route Suspense fallback), each with sr-only `role="status"` text. Plus `placeholderData: keepPreviousData` + ~300 ms debounce on respondent filters (kills full-table flicker) and row/card dimming (`opacity` + disabled) during delete/save mutations.
5. **UX-5: Compact badges legible without hover** (medium/low). Tooltip + sr-only full label on RiskClassBadge/TermBadge compact mode; same treatment for Δ-cell DELTA_SHORT codes and the Ξ/Δ/n `<abbr>` headers.
6. **UX-6: PanelPage selection ergonomics** (high/medium). Header select-all Checkbox (indeterminate), sticky bottom action bar with `t('panel.selectedCount',{n})`, hierarchy: Run selected = primary, Run all = outline + AlertDialog confirm. Fix the double-nested `role="alert"` (lines 123–128) into one destructive Alert.
7. **UX-7: Comparison table scanability** (high/medium). `text-right tabular-nums` numerics, `border-l` group boundaries (inputs / intermediates / result, mirroring the 3-step pipeline), TableCaption, Tooltip on Δ cells. In IndividualsSection: derive θ/T columns from `criteriaQuery` instead of `Object.keys(first.theta)` + keepPreviousData (stops column shifting between pages).
8. **UX-8: ImportPanel demoted + flow hardening** (medium/low-medium). Collapsible below the grid (auto-open when no regions); submit disabled until a file is chosen with filename echo; reset sibling mutation state on new submit so stale success never coexists with new errors; one consolidated outcome region (success/info/destructive Alert variants with explicit roles); clear file input after success. Also: render the criteria-load error so "Add respondent" is never silently dead.
9. **UX-9: ParametersPage → Tabs** (high/medium). Three TabsContent panels, URL-synced (`/parameters?tab=rules`) so the PanelPage callout deep-links to rules.
10. **UX-10: Dashboard run-context toolbar** (medium/medium). Sticky row under h1: run Select (option text enriched with region count) + export Buttons always rendered, disabled-with-Tooltip when no run instead of unmounting.
11. **UX-11: Rating wall → RadioGroup rows** (high/medium). One horizontal 1–5 RadioGroup per criterion inside kept fieldset/legend; scale legend rendered once. (The "no silent default-3" half lands in F2 below — during migration, defaults keep current behavior to avoid coupled scope.)
12. **UX-12: Pagination upgrade** (medium/low). Static nav label, `aria-live="polite"` range, page-size Select (10/25/50) replacing hardcoded PAGE_SIZE in RespondentsSection + IndividualsSection.

### Follow-up (separate tasks after the migration lands)

- **F1: Respondents drill-down → Sheet (master-detail)** (high/medium). `side="right" sm:max-w-3xl`, SheetTitle = region name; fixes discovery, focus move, and deselection. Card button keeps aria-pressed reflecting open state; RespondentFormModal Dialog stacks above.
- **F2: react-hook-form + zod via shadcn Form** (high/high). RegionFormModal, RespondentFormModal (with required-ratings validation killing the default-3 fabrication), ConfigSection (per-field FormMessage with aria-invalid/aria-describedby, FormDescription for units/ranges, zod refinements for cross-field constraints, dirty-state guard for the key-remount data loss). Keep `noValidate`, keep form-level summary Alert. CriteriaSection/RulesSection useFieldArray rewrite only if F2 goes well — lowest priority.
- **F3: ChartContainer wrap for recharts** (medium/medium). Curve strokes → `var(--chart-1/2/3)`; ChartTooltip formatting through `fmt()` (MATH_SPEC §6) and `t()`; risk colors stay on RISK_CLASS_COLORS. Also widen MuBarChart YAxis for Ukrainian names.
- **F4: Respondent filter Comboboxes** (high/medium). Command+Popover fed by distinct stored values (needs a small distinct-values endpoint or client-side derivation); active-filters row + clear-all; "filters matched nothing" Empty state distinct from "no respondents".
- **F5: Mobile nav Sheet** (medium/medium). `side="left"` Sheet behind a Menu icon Button (`t('nav.open')`); nav landmark kept in both renderings; lang switch stays outside.
- **F6: Ratings cell → answered-count summary + Popover grid** (high/medium). Replaces the space-joined monospace string; sr-only "code: rating" alternative; neutral tints only (never the risk palette).

**Cut**: shadcn Pagination component, NavigationMenu, ToggleGroup for language, dark mode, TanStack Table, dropdown-menu row actions — each conflicts with a constraint (aria-pressed, light-only, native-disabled pagination) or adds machinery the app doesn't need.

---

## Migration order

The preflight reset means unmigrated screens look broken the moment `@import "tailwindcss"` lands — so Phase 0+1 happen on one branch in quick succession, and pages follow immediately. Keep legacy CSS rules below the Tailwind import during the transition; delete them per-page as consumers migrate.

**Phase 0 — Toolchain (one PR-sized commit, blocks everything)**
1. `frontend/package.json`: install tailwindcss + @tailwindcss/vite; `frontend/vite.config.ts`: tailwindcss plugin + `@` alias (keep /api proxy).
2. `frontend/tsconfig.json` **and** `frontend/tsconfig.app.json`: `baseUrl` + `paths` in both (references don't inherit; CLI reads the root one).
3. `src/index.css`: prepend `@import "tailwindcss"`, run `npx shadcn@latest init` (neutral base), port the Theme-mapping tokens, delete `.dark`, add `@layer base` focus rule + heading scale. Legacy rules stay below, temporarily.
4. `npx shadcn@latest add …` (list above); sweep `src/components/ui/*` for: ring opacity (focus), any hardcoded English sr-only strings, eslint/TS flag fallout.
5. App.tsx: mount `<Toaster theme="light" />`.
6. Gate: `npm run build && npm run lint` must pass before Phase 1.

**Phase 1 — Shared infrastructure (sequential, blocks pages)**
1. `src/components/Feedback.tsx` — ErrorNote → Alert destructive (+ optional retry Button); Loading → Skeleton variants (card-grid / table / page) each with sr-only status text. Add success/info/warning Alert variants.
2. `src/components/Badges.tsx` — Badge shell + inline colors + Tooltip/sr-only (UX-5); add status Badge variants (success/warning).
3. `src/components/Pagination.tsx` — UX-12 (Buttons, live range, page-size Select).
4. `src/components/Modal.tsx` → delete; create `src/components/ui`-based Dialog usage pattern + new shared `src/components/ConfirmDialog.tsx` (AlertDialog, UX-2).
5. `src/components/Layout.tsx` — header/nav/lang-switch restyle (keep-custom decisions); `.visually-hidden` → `sr-only` sweep app-wide.
6. New `EmptyState` component (UX-1 shell).

**Phase 2 — Pages (parallelizable across four tracks after Phase 1; suggested serial order if solo)**
1. **regions track**: RegionsPage → RegionFormModal → RespondentsSection → RespondentFormModal (UX-11) → ImportPanel (UX-8). Largest surface; exercises Dialog/AlertDialog/Table/RadioGroup/Collapsible first.
2. **panel track**: PanelPage (UX-6, nested-alert fix, Tooltip headers, Δ select stays native).
3. **dashboard track**: DashboardPage (UX-7, UX-10) → IndividualsSection → charts.tsx *restyle only* (containers/headings; ChartContainer is F3).
4. **parameters track**: ParametersPage Tabs shell (UX-9) → ConfigSection → RulesSection → CriteriaSection (lucide icons, ConfirmDialog, native pill selects kept).

Each page commit deletes its legacy CSS block from index.css. Empty states (UX-1), toasts (UX-3), skeleton call-sites (UX-4) land inside their page's conversion.

**Phase 3 — Cleanup + verification**
1. index.css: only tokens, base layer, and the deliberately-kept custom rules (steps pipeline, rule-slot, risk-legend, criterion-edit-row, fieldset/legend) remain — port even these to utilities where trivial.
2. i18n: verify uk.json/en.json key-set parity for every new key (`emptyStates.*`, `toast.*`, `confirm.*`, `panel.selectAll`, `panel.selectedCount`, `nav.open`, pagination labels, dialog close).
3. Gate: `npm run build && npm run lint`; manual a11y pass per the must-survive list (focus trap, aria-pressed, scope attrs, captions, live regions, lang sync).
4. `uv run scripts/make_screenshots.py` to regenerate thesis figures (run from repo root).

**Phase 4 — Follow-ups** F1–F6 as independent tasks, any order; F2 before F6 if both are taken (F6's popover benefits from RHF state).

---

## Risks

1. **Radix Dialog vs native `<dialog>` behavior drift.** Focus trap, Esc→onClose, scroll lock, and focus-return-to-trigger must be manually verified against current native behavior — especially focus return after delete confirms where the trigger row no longer exists (return focus to section heading), and Dialog-over-Sheet stacking in F1. Mitigation: a11y checklist per overlay in Phase 3; the native-dialog StrictMode bug disappears as a bonus.
2. **Preflight big-bang.** `@import "tailwindcss"` resets margins/headings/tables app-wide before pages are migrated; legacy rules below the import will fight specificity. Accept the interim ugliness on a single branch; don't ship between Phase 0 and end of Phase 2; only regenerate screenshots at the end.
3. **Focus-ring regression.** shadcn's default `ring-ring/50` is fainter than the current 3px solid outline; components also set `outline-none`, which beats a base-layer rule. Mitigation: the Phase-0 ui-folder sweep (full-opacity ring) + global base rule for non-shadcn elements; spot-check every interactive element type.
4. **Silent a11y loss in component swaps.** shadcn Table emits no `scope` attrs; Alert role varies; Skeleton is AT-silent; Radix Select drops the native label-click association; DialogClose ships English sr-only text. Every one of these has an explicit countermeasure in the adoption map — treat the "Key constraints" column as acceptance criteria, not suggestions.
5. **Radix Select empty-value crash.** `value=""` items throw; all "not set" options need the `"none"` sentinel mapped to null at the API boundary (RegionFormModal Δ, import target region). Missing one yields a runtime error, not a type error.
6. **aria-pressed semantics.** Any temptation to "upgrade" the language switch to ToggleGroup silently swaps aria-pressed for radio semantics — decision locked: keep custom buttons.
7. **ESLint/TS flag fallout on generated code.** `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noUnusedLocals` will flag some pasted registry code; `react-refresh/only-export-components` will complain about `buttonVariants` exports in ui files. Mitigation: fix types inline; add a scoped eslint override for `src/components/ui/**` rather than weakening global config.
8. **Bundle size.** Radix primitives + cva + lucide add ~30–60 kB gz to the main chunk. Keep the lazy dashboard route so recharts stays out of main; verify with `npm run build` output before/after; lucide imports must be named (tree-shaken), never the barrel.
9. **Recharts × preflight/layout.** Preflight's `svg { display: block }` and the conversion of `.charts-row` to grid utilities can change ResponsiveContainer's measured parent size — keep explicit heights on chart wrappers and verify all three chart types render at the same dimensions (screenshots diff will catch this).
10. **i18n parity drift.** ~25 new keys land across uk.json/en.json; a missed key renders raw key text. Mitigation: add a tiny key-parity check (test or script) in Phase 3 if one doesn't exist.
11. **Known bug left open until F2.** ConfigSection's `key={version}` remount still discards in-progress edits if another session activates a version mid-edit; documented as accepted until the RHF dirty-guard follow-up.
12. **Thesis figures change.** All screenshots in the thesis draft will visibly differ post-migration; regenerate via `uv run scripts/make_screenshots.py` and flag the visual refresh to the supervisor alongside the existing math-discrepancy sign-off.
