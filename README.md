# Field Finder

A web-based crop scouting tool for hunters and farmers. Search any location to see USDA NASS Cropland Data Layer (CDL) crop data overlaid on an interactive map — useful for identifying grain fields, food plots, and habitat when scouting for upland birds and other wildlife.

Replaces a Python CLI (`ff-py/ff.py`) with a real-time, browser-based experience.

## What It Does

1. Search any address or enter coordinates to set a location
2. Choose a year (1997–2024) and search radius (1–50 miles)
3. Filter by crop type (corn, soybeans, wheat, sorghum, alfalfa, and more)
4. View the CDL crop overlay directly on an interactive map
5. Drop waypoints to mark spots of interest (persisted across sessions)

## Tech Stack

- **Framework**: SvelteKit (TypeScript) — frontend + backend in one project
- **Map**: Leaflet.js — open source, no API key required
- **Crop data**: USDA NASS CropScape CDL API (free, no key required)
- **Geocoding**: Nominatim / OpenStreetMap (free, no key required)
- **Styling**: Tailwind CSS
- **Database**: SQLite via Drizzle ORM (not yet used — deferred until a feature needs it)

## Getting Started

```sh
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Key Notes

- CDL API requests are proxied server-side to avoid CORS restrictions
- CDL API is slow (expect 3–10 seconds per search)
- Coordinates use EPSG:4326 for input; the server reprojects to EPSG:5070 (Albers) for the CDL API
- All user settings (location, radius, year, crop filters, waypoints) are persisted to `localStorage`

## Data Source

USDA NASS CropScape: https://nassgeodata.gmu.edu/CropScape/

## Development

```sh
npm run check    # type-check
npm run lint     # ESLint + Prettier check
npm run test     # Vitest unit tests
npm run build    # production build
```
