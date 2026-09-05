# HANDOFF — Merge tranche 1, plan tranche 2a, then the map-layers work (resume here)

**Date:** 2026-09-04 · **Branch:** `fix/audit-tranche-1` (PR #3, OPEN, mergeable) · **Worktree:** none, primary checkout

## Read this first

The branch has **4 unpushed commits** on top of what PR #3 shows on GitHub. They are docs only: the
new design spec, two rounds of review fixes, and this handoff + living-doc sync. Nothing else changed. Push them before merging so
the spec rides into `main` with the PR:

```bash
git push origin fix/audit-tranche-1
```

`planning/audit-2026-08-26.md` (the work queue) exists **only on this branch** until PR #3 merges.
Do not look for it on `main`.

## What was established this session (verified live, do not re-investigate)

Research question: can Field Finder absorb the two things the group still opens onX for — property
lines and spotting ponds/stock tanks on imagery? **Yes, without a paid API, with one gap.**

| Finding                                                                                                             | Evidence                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| USGS aerial imagery is a free, keyless, public-domain XYZ tile service                                              | `basemap.nationalmap.gov/.../USGSImageryOnly/MapServer/tile/{z}/{y}/{x}` — ~0.35 s/tile, good to zoom 16               |
| Nebraska publishes a free statewide parcel feature service, but **it has no owner-name field**                      | `gis.ne.gov/Enterprise/rest/services/StatewideParcelsExternal/FeatureServer/0` — 1,770 parcels / 10 mi box / 0.6 s     |
| Colorado's free statewide parcels **do** carry owner name + mailing address                                         | `gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0`                     |
| Kansas, Iowa, SD, WY, MO: no confirmed free statewide owner-bearing service                                         | Kansas is county-by-county; Iowa behind registration; others unverified                                                |
| PAD-US 4.1 (public land) is free; manager **name** is in `Loc_Mang`, `Mang_Name` is a code                          | `services.arcgis.com/v01gqwM5QqNysAAi/.../Fee_Managers_PADUS/FeatureServer/0` — Darr Strip WMA is 2 polygons (OA + RA) |
| Nebraska Open Fields & Waters walk-in tracts are a feature service whose name carries the season                    | `services5.arcgis.com/IOshH1zLrIieqrNk/.../OFW_2026_2027_QA_Web_Map_View/FeatureServer/0`                              |
| USGS hydrography has ponds down to ~0.25 acre — viable water data layer, **deferred** (owner chose imagery instead) | NHDPlus HR layer 9: 1,171 water bodies in the 10 mi box                                                                |
| Regrid is the paid fallback for owner names elsewhere; base price hidden behind sign-up                             | Self-serve: 2,000 records + 200,000 tiles/month, $0.10/record overage                                                  |

Owner decisions made in session (do not re-ask): coverage = Nebraska + neighbors; need boundaries
**and** owner name **and** public/private; free first with a paid slot later; visual imagery over a
water data layer; yearly parcel freshness is fine; approach = free-first per-state providers; build
order imagery → parcels → public land; **slot all of it after audit tranche 2a**.

## The spec

`docs/superpowers/specs/2026-09-04-property-lines-imagery-public-land-design.md` — one spec, three
sub-projects, one implementation plan each. Reviewed twice by a spec-reviewer subagent: round 1
found four real issues (all fixed — click bubbling into `onMapClick`, bbox cap on wide displays,
per-layer zoom thresholds, missing PR #3 prerequisite); round 2 **Approved**.

**wpknox had not yet read the spec when the session ended.** Ask for that read before writing any
plan against it.

## What to do next, in order

1. **Push and merge PR #3.** Run `superpowers:finishing-a-development-branch`; wpknox chooses.
   After merge, pull `main` and confirm `src/lib/constants.ts` and the timeout helpers in
   `src/lib/server/cdl.ts` are present — the layers spec depends on them.
2. **Write the tranche 2a plan** with `superpowers:writing-plans`. Scope is audit section F items
   **F1** (overlay layer orphaned when two renders overlap), **F4** (split `loadingMessage`
   ownership), **F2** (`SearchResult` needs `year`). Definitions: `planning/audit-2026-08-26.md`
   lines ~241–280; grouping rationale in its "Tranche 2 — TO BE PLANNED" table.
3. **Review the plan, then execute it** with `superpowers:subagent-driven-development`, same loop as
   tranche 1 (plan review → subagent per task → spec review → quality review). New branch, e.g.
   `fix/audit-tranche-2a`.
4. **Then** plan sub-project 1 of the layers spec (aerial imagery toggle) — smallest, no server work.
   Sub-projects 2 and 3 follow. Tranche 3 (UI redesign) stays last so it sees the final layer set.

## User decisions — do NOT do without asking

- Merging or pushing anything (nothing was pushed this session).
- Adding a paid provider (Regrid) or any API key.
- Adding states beyond Nebraska and Colorado to the parcel layer.
- Reordering 2a vs the layers work.

## Blocked on USDA CDL being healthy (unchanged from last session)

Confirming whether `CDL_MAX_YEAR` can move to 2025, and audit plan 2d (e2e smoke test). B2/B3 were
already live-verified on 2026-08-26 with a stubbed `/api/search` (see CONTEXT.md), so they are not
blocked. None of this blocks 2a or the layers work.

## Housekeeping

- No dev server running; nothing in the worktree directory.
- A temporary branch `docs/layers-spec` was created and deleted this session; if you see references
  to it, they are stale.
- `/msync` was run at the end of this session; `memory/CONTEXT.md`, `memory/decisions.md`, and
  `planning/features.md` reflect the above.
