# Weekly Effort Entry Screen — Optimization Proposal

Tracking issue: [#34](https://github.com/monkut/kippo-ui/issues/34)

This proposal documents UX and performance pain points found in the project
effort entry screen and ranks recommended changes by impact and effort.
Implementation is **out of scope** for this document — each accepted
recommendation will be filed as a follow-up issue linked to #34.

## 1. Scope and current state

- File under review: `app/routes/weekly-effort.tsx` — **1905 lines**, single
  default export `WeeklyEffort` at L435.
- Sub-components defined in the same file: `WeekCalendar` (L68–241),
  `HolidayCalendar` (L244–~430).
- Entry point loads **5 API calls in parallel** at L539–546:
  `fetchAllProjects`, `projectsWeeklyeffortList`, `monthlyAssignmentsList`,
  `weeklyEffortMissingWeeksRetrieve`, `weeklyEffortExpectedHoursRetrieve`.
- The main component declares **24 `useState` hooks** spanning loading flags,
  modal state, inline-input state, edit state, and four cached server
  collections (`projects`, `allUserEntries`, `selectedWeekEntries`,
  `monthlyAssignments`).
- Concerns mixed in one file: week navigation calendar, holiday calendar,
  inline holiday form, modal holiday form, week-data fetcher, week-template
  resolver, submit / partial-update / destroy handlers, and JSX render.

## 2. Performance findings (grounded)

### 2.1 Initial load — sequential pagination of all projects

`fetchAllProjects` (`app/lib/api/pagination.ts:9`) walks the project list
**page-by-page sequentially**: each call awaits the previous one before
issuing the next request. With *N* pages of projects this is *O(N)*
serial round-trips inside what is otherwise a parallel fetch group.
The other four calls in the `Promise.all` at `weekly-effort.tsx:539` are
gated on the slowest member, so the screen TTI is bounded by paginated
project retrieval.

### 2.2 Initial load — unbounded user-history fetch

`projectsWeeklyeffortList({ user_username })` at L542 retrieves **every
weekly-effort row the user has ever created**. The screen only needs:

1. entries for `weekStart` (the selected week), and
2. the latest non-empty week, used as a "template" when the form is empty.

Both can be derived from a window of ~2 weeks. Today's call grows
linearly with tenure and is re-issued in full after every create / update /
delete (L805, L831, L894).

### 2.3 Cascading effect on week change

The week-change effect (L618–701) declares `allUserEntries` in its
dependency array (L701). Since each successful submit / edit / delete
calls `setAllUserEntries` with a new array, the effect re-runs and
re-issues `projectsWeeklyeffortList({ week_start_gte, week_start_lte })`
(L639) on every mutation — a second redundant network call piggybacking
on the post-mutation refetch in 2.2.

### 2.4 Derived data recomputed every render

- `projectProjects` and `nonProjectProjects` (L1002–1007) re-filter and
  re-sort the entire `projects` array on every render of the 1905-line
  component — including every keystroke in any input.
- `selectedWeekTotalHours` (L987) and `formTotalHours` (L990) are also
  recomputed every render.
- Inside `WeekCalendar`, the `dates`, `weeks`, `personalHolidayDates`
  set, and `publicHolidayDates` set are recomputed on every parent
  render, even when `weekStart` and the holiday lists have not changed.
  The component is not wrapped in `React.memo`.

### 2.5 Submit-time duplicate check is a network round-trip

`handleSubmit` (L867–871) re-fetches `projectsWeeklyeffortList` filtered
to the current week purely to detect duplicates. The same data is
already present in `selectedWeekEntries`, so this round-trip is
unnecessary latency on the user's critical path.

### 2.6 Refetch-everything after every mutation

`saveEditEntry` (L805), `deleteEntry` (L831), and `handleSubmit` (L894)
all refetch the **entire user history** rather than patching local
state optimistically. On a slow connection the user sees the spinner
for the full payload after each one-row edit.

### 2.7 Render cost compounded by component size

The 1905-line component re-renders on every state change in any of its
24 `useState` slots, including transient ones like `isHeaderHovered`
(L456). Hovering the existing-entries section header re-renders the
calendar, the missing-weeks panel, the monthly-assignments panel, and
the form.

### 2.8 Silent error swallowing

Multiple `try { ... } catch {}` blocks (L495, L518, L695, L790, L814,
L848, L916, L947, L979) hide failures from both the user and any
client-side log sink. Any of the perf issues above will be invisible
in production telemetry.

## 3. UX findings (grounded)

### 3.1 Hover-only action affordances

The "+ Project / + Non-Project / + Personal Holiday" buttons on the
existing-entries header (L1153) live inside a wrapper with
`opacity-0 group-hover:opacity-100`. They are invisible to keyboard
users and to touch users on mobile. The same pattern is used for the
edit pencil icon (L1340).

### 3.2 Whole-row click-to-edit

The existing-entries row at L1234 has `onClick={...startEditEntry}` on
the entire `div`, with nested `<button>`s using
`e.stopPropagation()` to avoid double-firing. Discoverability is poor
(no cursor-pointer hint until hover), and the row has no `role` /
`tabIndex` so it is not keyboard-reachable.

### 3.3 Destructive action via `window.confirm`

`deleteEntry` (L823) uses `window.confirm("このエントリを削除しますか？")`.
This blocks the main thread, cannot be styled or tested, and renders
inconsistently across browsers.

### 3.4 Inline validation

Validation errors (e.g. "有効なエントリがありません" L862, duplicate
warnings L879) surface only in the top-of-page error banner. Field-level
validation is absent — the user has to scan back up to the banner to
discover which row is at fault.

### 3.5 Hours field type

The hours `<input type="text" inputMode="numeric" pattern="[0-9]*">`
(L1244) plus `normalizeDigits` (L43) was added to fix the Japanese IME
full-width-digit issue (commit `0797a15`). It works, but exposing a
plain text input means screen readers do not announce numeric
constraints and arrow-key increment / decrement is lost.

### 3.6 Mobile layout

The header layout grid `grid-cols-1 md:grid-cols-2` (L1037) collapses
to a single column on mobile, but the calendar grid inside
`WeekCalendar` is fixed at `grid-cols-7` and is sized for desktop. No
explicit breakpoint testing has been done for the entry form on
sub-400px viewports.

## 4. Measurement plan

The acceptance criteria call for **baseline measurements (render time,
TTI, submit latency) on a representative dataset**. These cannot be
collected from a static read of the source — they require a running
instance with a populated database. The recommended methodology, to be
executed as part of the first follow-up issue:

1. **Initial mount + week change** — React DevTools Profiler. Record:
   - `WeeklyEffort` mount duration
   - `WeeklyEffort` commit count and longest commit during a single
     `setWeekStart` call
   - Top 3 components by self-render time
2. **Network waterfall** — Chrome DevTools Network panel. Record:
   - TTFB, total transfer, and gzipped payload size for each of the 5
     parallel calls
   - Number of pages requested by `fetchAllProjects`
   - Total payload size for `projectsWeeklyeffortList` for a user
     with ~12 months of history
3. **Submit latency** — `performance.mark` / `performance.measure`
   bracketing `handleSubmit` (`weekly-effort.tsx:854`). Record the
   delta between form submit and "form cleared" UI state for a
   3-entry submission against a primed cache and a cold cache.
4. **TTI / LCP** — Lighthouse run on `/weekly-effort` against a
   seeded staging dataset.

A representative dataset for these measurements is: ~50 active
projects, ~20 archived projects, the user with ~52 weeks of effort
history, and 8 holidays in the current month.

## 5. Ranked recommendations

Effort: **S** ≤ half-day · **M** ≤ 2 days · **L** > 2 days.
Impact rating reflects expected gain assuming the measurement plan in
section 4 confirms the suspected hot paths.

| # | Recommendation | Effort | Impact |
|---|---|---|---|
| 1 | Bound `projectsWeeklyeffortList` to the relevant week range (and the previous week for the template) instead of fetching the user's full history. Touch points: L542, L639, L805, L831, L867, L894. | S | High — payload and render cost both shrink as user tenure grows |
| 2 | Replace sequential pagination in `fetchAllProjects` with a single large-page-size request (or backend cursor). Until the backend supports a "all-in-one" page, fetch pages in parallel after the first response reveals the page count. | S | High — eliminates serial RTTs from the critical path |
| 3 | Memoize `projectProjects`, `nonProjectProjects`, `selectedWeekTotalHours`, `formTotalHours` with `useMemo`; wrap `WeekCalendar` and `HolidayCalendar` in `React.memo` and memoize their derived `dates` / `weeks` / holiday sets. | S | Medium — removes per-keystroke recomputation |
| 4 | Drop the duplicate-check round-trip in `handleSubmit` (L867) and validate against the already-loaded `selectedWeekEntries`. | S | Medium — removes one RTT from every submit |
| 5 | Patch local state optimistically after create / update / delete instead of refetching the user's full history. Roll back on error. | M | Medium — removes large refetch from critical path |
| 6 | Remove `allUserEntries` from the week-change effect dependency array (L701) to stop the cascade in §2.3. | S | Medium — eliminates duplicate refetch after every mutation |
| 7 | Decompose `weekly-effort.tsx` into `WeekCalendar`, `HolidayCalendar` (already extractable), `WeeklyEffortForm`, `ExistingEntriesList`, `MissingWeeksPanel`, `MonthlyAssignmentsPanel`, plus a `useWeeklyEffort` hook for fetch / mutate / state. Reduces re-render scope and unlocks proper memoization boundaries. | L | High (compounding) — also unblocks recommendations 3, 5, 8 |
| 8 | Move data fetching to React Query / SWR (or react-router loader). Provides automatic dedupe, cache, stale-while-revalidate, and removes most of the manual `useState` + `useEffect` choreography. | M | High — also removes the need for ad-hoc refetch logic in 5 / 6 |
| 9 | Replace silent `catch {}` blocks (§2.8) with structured logging and a user-visible toast. Required to validate post-fix measurements in production. | S | Low directly, High operationally |
| 10 | Make the hover-revealed action buttons (§3.1) keyboard-focus-visible, give the click-to-edit row (§3.2) `role="button"` and a focus ring, and replace `window.confirm` (§3.3) with the existing modal pattern. | S | Medium UX |
| 11 | Add inline field-level validation messages (§3.4) next to the offending row instead of (or in addition to) the top-of-page banner. | S | Medium UX |
| 12 | Mobile audit of the form and calendar at 360 / 390 / 414px viewports; collapse calendar day-cells and hours input to a touch-friendly layout. | M | Medium UX, larger if mobile usage is non-trivial |
| 13 | (Backend, optional) Add a single screen-load endpoint, e.g. `GET /api/weekly-effort/screen?week_start=…`, returning the projects list (filtered server-side to "open for week"), week entries, previous-week entries, monthly assignments, missing weeks, and expected hours in one payload. Reduces five round-trips to one. | M | High — but requires kippo backend change, so file as a kippo-backend issue |

## 6. Suggested follow-up issues

To be filed against `monkut/kippo-ui` and linked back to #34:

1. **Reduce weekly-effort initial payload** — recommendations 1, 2, 4, 6.
2. **Memoize derived data and sub-components in weekly-effort** —
   recommendation 3.
3. **Decompose `weekly-effort.tsx` into sub-components and a custom
   hook** — recommendation 7.
4. **Adopt a server-state library for weekly-effort fetches** —
   recommendations 5, 8.
5. **Weekly-effort accessibility and validation polish** —
   recommendations 9, 10, 11.
6. **Weekly-effort mobile layout audit** — recommendation 12.

A separate kippo-backend ticket is suggested for recommendation 13.

## 7. Open questions for reviewers

- Is React Query already in the dependency tree, or would adopting it
  count as a new dependency decision?
- What is the production page size for `projectsList`, and is there an
  upper bound the API will accept on `?page_size=`?
- Do we have a staging dataset that matches §4's representative
  profile, or should the first follow-up include seeding work?
- Are mobile users a meaningful share of the entry traffic, or is the
  audience effectively desktop-only?
