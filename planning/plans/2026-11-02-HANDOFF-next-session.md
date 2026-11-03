---
id: handoff-2026-11-02
type: planning
description: Session handoff — tranche 2a and PR #4 merged; next session plans the UI/UX redesign (tranche 3) with the frontend-design plugin
related:
  - planning/audit-2026-08-26.md
  - memory/CONTEXT.md
  - memory/decisions.md
  - planning/features.md
  - docs/superpowers/specs/2026-09-04-property-lines-imagery-public-land-design.md
---

# HANDOFF — Plan the UI/UX redesign (resume here)

**Date:** 2026-11-02 · **Branch:** start from an up-to-date `main` · **Worktree:** none

## Where things stand

Everything is merged. No open PRs, no WIP branches.

| PR      | What                                                                            |
| ------- | ------------------------------------------------------------------------------- |
| #3      | Audit tranche 1 (B1–B5, C1)                                                     |
| #4      | Dove quick wins: 2025 CDL data, Millet filter, Dove preset (`cfbc853`)          |
| #5 (2a) | Audit tranche 2a: F1, F2, F4, F5 — overlay hardening (see PR body for evidence) |

State of `main` after 2a: vitest **92/92**, svelte-check 0/0 (670 files), lint OK, build OK. `CDL_MAX_YEAR` is 2025. CDL was healthy on 2026-11-02 (~13 s per request).

Details of 2a live in `memory/decisions.md` (2026-11-02 entry) and the audit's section F markers. Don't re-derive them.

## The next session's job: plan tranche 3 (UI/UX redesign)

wpknox's instruction: **plan the UI update with the `frontend-design` skill**. Planning only, no implementation, unless wpknox says otherwise.

**Order (from the audit's "Tranche 3" section — read it first):**

1. **`brainstorming`** skill — agree a direction with wpknox before any design or code. One question at a time.
2. **`frontend-design:frontend-design`** (the plugin; the old project-local copy is gone) for the visual and interaction design. `theme-factory` is available for a colour/type/spacing system.
3. **`writing-plans`** → plan reviewed by a subagent → the usual execution loop (implementer subagent → spec reviewer → quality reviewer) in a later session.

**Constraints the redesign must keep** (settled decisions, see `decisions.md`):

- No auto-triggered searches; explicit Search button (CDL takes seconds).
- Inform, don't restrict (e.g. the radius warning above 15 mi rather than a cap).
- All user state persists to localStorage.
- Legend and filter swatches come from the live `georaster.palette`; never hardcode them back. The hardcoded `CROPS` hexes stay as the pre-search fallback.
- `CLAUDE.md` UX goals: live geocoding feedback, always-visible legend, marker for the searched location.
- MapView's two position sources stay separate: live `center`/`radius` drive the marker and bbox preview; the frozen `searchResult` snapshot drives the overlay.
- The page is the sole writer of `loadingMessage` (F4). Don't re-add a two-way binding for it.

**Decisions to put to wpknox during brainstorming:**

1. **D2–D5 overlap.** D2 (cancel a running search), D3 (lat/lon entry affordance), D4 (Area Summary vanishes mid-search), D5 (generic error text). Either fold them into tranche 3 and drop them from 2b/2c, or fix them first. Doing both is wasted work. D1 (persist year) is plumbing and stays in 2c.
2. **Sequencing vs the map layers.** The map-layers spec (aerial imagery → parcels → public land) also adds UI: a basemap switcher, layer toggles, popups, and a shared bottom-left hint slot. Options: redesign first so the layer controls are designed in from the start, or layers first and restyle them afterwards. All of them touch `MapView.svelte` and `+page.svelte`, so they can't run in parallel. **wpknox still hasn't read** `docs/superpowers/specs/2026-09-04-property-lines-imagery-public-land-design.md`; the redesign should at least leave room for those controls.
3. **Mobile.** "Mobile-optimized layout" is in the features ideas list. The group uses this for scouting, so phones in the field are likely. Decide whether it's in scope.

## Other queued work (not next)

- **Tranche 2b** (honest errors), **2c** (cleanup batch, now including the 2a review nits), **2d** (e2e smoke test). See the audit's Tranche 2 table.
- **Year comparison** is unblocked now that 2a is done.
- **Map layers**, sub-projects 1–3, per the spec above.
- Dove feature ideas are in `planning/features.md`.

## Execution model (wpknox's standing instruction)

- The session lead orchestrates. Each plan task goes to a fresh implementer subagent, then a spec-compliance reviewer, then a code-quality reviewer. Plans are reviewed by a subagent before execution.
- Templates: `.claude/skills/subagent-driven-development/` and `.claude/skills/requesting-code-review/code-reviewer.md`.
- Models: `sonnet` for mechanical implementers and spec reviewers; the default model for integration tasks and all quality reviews.
- Hand subagents the task text extracted to a scratchpad file, not the whole plan.
- Live checks: dev server on port 5199 plus the Playwright MCP. Stubbing `window.fetch` for `/api/search` lets the client path run without CDL. Replay a real captured raster when timing matters (4c lesson).
- Commit messages: no attribution or Co-Authored-By lines.

## User decisions — do NOT do without asking

- Pushing, opening or merging PRs.
- Adding a paid provider (Regrid) or any API key.
- Adding parcel states beyond NE and CO.
- Changing the Dove preset's crop list (corn deliberately excluded; open water deferred).
