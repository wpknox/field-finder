## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: prettier, eslint, vitest, tailwindcss, drizzle

---

# Field Finder — Webapp

A web-based reimagining of `../ff-py/ff.py`. The goal is to provide a much better user experience for exploring USDA crop data overlaid on an interactive map.

## Session Start Checklist

At the beginning of every new session in this project, read these files **in order** before doing anything else:

1. `memory/CONTEXT.md` — current project state, active work, key technical facts
2. `memory/decisions.md` — append-only log of why things are the way they are
3. `planning/features.md` — feature status (implemented / in-progress / planned / ideas)

After reading, briefly summarize what you understand about the current state so the user can correct any outdated context before work begins.

## File Frontmatter Convention

All living documents in `memory/` and `planning/` carry YAML frontmatter. Use these fields to locate and understand files without reading their full content:

| Field         | Purpose                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `id`          | Stable slug for cross-referencing (e.g. `context`, `decisions`, `features`) |
| `type`        | Category: `memory`, `planning`, or `skill`                                  |
| `description` | One-line summary of what the file contains                                  |
| `related`     | List of other files relevant to this one                                    |

When told to "check context" or "check decisions", use the `id` field to locate the right file instantly.

## What the Original Script Does

`ff.py` is a Python terminal script that:

1. Accepts a location (address geocoded via Nominatim, or raw lat/lon) and a radius in miles
2. Accepts a year (2000–2024)
3. Calls the **USDA NASS CropScape CDL API** to fetch a raster crop data file for the bounding box
4. Optionally filters to specific crop types (sorghum, wheat, oats, alfalfa, etc.)
5. Downloads a PNG image of the crop layer
6. Overlays the PNG on a Folium (Leaflet.js) map and saves it as an HTML file

The CLI flow is clunky — text prompts, no live preview, manual file management — hence this webapp.

## Data Source

### USDA NASS Cropland Data Layer (CDL) API

- Base URL: `https://nassgeodata.gmu.edu/axis2/services/CDLService`
- Explorer UI: `https://nassgeodata.gmu.edu/CropScape/`
- API returns XML with URLs pointing to hosted raster/PNG files
- Coordinate system: EPSG:5070 (Albers Equal Area) for bounding boxes; EPSG:4326 for lat/lon input
- Geocoding: Nominatim (OpenStreetMap) — `https://nominatim.openstreetmap.org/search`

### Key API Endpoints

| Endpoint                                            | Purpose                              |
| --------------------------------------------------- | ------------------------------------ |
| `GetCDLFile?year=YYYY&bbox=x_min,y_min,x_max,y_max` | Get raster file URL for bounding box |
| `ExtractCDLByValues?file=<url>&values=<csv_ids>`    | Filter to specific crop value IDs    |
| `GetCDLImage?files=<url>&format=png`                | Get PNG image URL for a raster file  |

### Crop Color Legend

| Color        | Crop                  | CDL Value |
| ------------ | --------------------- | --------- |
| Yellow       | Corn                  | 1         |
| Green        | Soybeans              | 5         |
| Orange       | Sorghum               | 4         |
| Brown        | Winter Wheat          | 24        |
| Purple       | Oats                  | 28        |
| Magenta      | Barley                | 21        |
| Light Yellow | Sunflower             | 6         |
| Light Green  | Pasture               | 176       |
| Blue         | Open Water            | 111       |
| Light Blue   | Woody Wetlands/Rivers | 190       |
| Gray         | Fallow/Idle Cropland  | 61        |
| Pink         | Alfalfa               | 36        |
| Light Brown  | Spring Wheat          | 23        |

## Coordinate Math

- Bounding box is computed from a center lat/lon + radius in miles
- Lat degrees per mile: `miles / 69.0`
- Lon degrees per mile: `miles / (69.0 * cos(radians(lat)))`
- Bounding box must be projected to EPSG:5070 (Albers) before calling CDL API

## Default/Test Location

Lat: `40.553950`, Lon: `-100.076157` — a Bed & Breakfast near Eustis, NE.
Used as the baseline reference point for testing and development.

## UX Goals (Improvements over the CLI)

- Address search bar with live geocoding feedback
- Interactive map (Leaflet or Mapbox) — user can pan/zoom freely
- UI controls for radius and year — sliders or dropdowns, no prompts
- Checkboxes to toggle which crop types to display
- Crop overlay rendered directly on the map (no file download required by user)
- Color legend always visible on the map
- Marker for the searched location

## Tech Stack

- **Framework**: SvelteKit — handles both frontend UI and backend API routes in one project
  - Server routes (`+server.ts`) proxy CDL API calls and handle coordinate math (keeping API calls server-side avoids CORS issues)
  - Form actions and load functions for SSR where useful
- **Map**: Leaflet.js (via `leaflet` npm package) — open source, no API key required
- **Database**: SQLite via `better-sqlite3` — lightweight, file-based, zero infra, perfect for <20 users
  - ORM: Drizzle ORM (type-safe, minimal overhead) — keep this optional until a DB is actually needed
- **Styling**: TBD (plain CSS or a lightweight utility library like UnoCSS)
- **Deployment**: Local dev first; deployment TBD

## Project Layout

```text
field-finder/
  .claude/
    skills/         # Reusable skill docs (see Skills table below)
  memory/
    CONTEXT.md      # Living project state — read at every session start
    decisions.md    # Append-only decision log
  planning/
    features.md     # Feature status: implemented / in-progress / planned / ideas
  src/
    lib/
      server/       # Server-only utilities (CDL API calls, coordinate math, DB)
      components/   # Svelte UI components
    routes/         # SvelteKit pages and API endpoints
  CLAUDE.md
```

## Skills

Skills live in `.claude/skills/<skill-name>/SKILL.md`. When a skill is relevant or requested, **read its SKILL.md in full before taking any action**.

| Skill                            | Description                                                                                         | Path                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `brainstorming`                  | Turn ideas into approved designs before writing any code                                            | `.claude/skills/brainstorming/SKILL.md`                  |
| `dispatching-parallel-agents`    | Delegate independent tasks to multiple agents simultaneously                                        | `.claude/skills/dispatching-parallel-agents/SKILL.md`    |
| `executing-plans`                | Implement a written plan with checkpoints and verification                                          | `.claude/skills/executing-plans/SKILL.md`                |
| `finishing-a-development-branch` | Wrap up a branch: verify tests, then merge / PR / keep / discard                                    | `.claude/skills/finishing-a-development-branch/SKILL.md` |
| `receiving-code-review`          | Evaluate and act on code review feedback with technical rigor                                       | `.claude/skills/receiving-code-review/SKILL.md`          |
| `requesting-code-review`         | Request a structured code review via subagent                                                       | `.claude/skills/requesting-code-review/SKILL.md`         |
| `subagent-driven-development`    | Implement a plan using per-task subagents with spec + quality review                                | `.claude/skills/subagent-driven-development/SKILL.md`    |
| `systematic-debugging`           | Debug by root cause investigation before attempting any fix                                         | `.claude/skills/systematic-debugging/SKILL.md`           |
| `test-driven-development`        | Write failing test first, then minimal code to pass (red-green-refactor)                            | `.claude/skills/test-driven-development/SKILL.md`        |
| `using-git-worktrees`            | Create isolated git workspaces for parallel branch development                                      | `.claude/skills/using-git-worktrees/SKILL.md`            |
| `using-superpowers`              | Protocol for when and how to invoke skills                                                          | `.claude/skills/using-superpowers/SKILL.md`              |
| `verification-before-completion` | Run fresh verification commands before claiming any work is done                                    | `.claude/skills/verification-before-completion/SKILL.md` |
| `writing-plans`                  | Write a detailed, TDD-structured implementation plan                                                | `.claude/skills/writing-plans/SKILL.md`                  |
| `writing-skills`                 | Create new reusable skill documentation using TDD principles                                        | `.claude/skills/writing-skills/SKILL.md`                 |
| `frontend-design`                | Design and implement polished, accessible frontend UI                                               | `.claude/skills/frontend-design/SKILL.md`                |
| `skill-creator`                  | Build well-structured, reliable, evaluated custom skills — **use this when creating any new skill** | `.claude/skills/skill-creator/SKILL.md`                  |
| `theme-factory`                  | Generate consistent visual themes (colors, typography, spacing)                                     | `.claude/skills/theme-factory/SKILL.md`                  |
