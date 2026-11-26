# nvBenz

Personal fuel tracker — vehicles, fill-ups, consumption and costs.

Built to replace Fuelio and the ever ending enshittification of apps (subscription, useless features, etc).

Offline-first: the entire database lives on your device (IndexedDB). Installable as a PWA on iPhone and any smartphone.

Launch it here: [https://aadm.github.io/nvBenz](https://aadm.github.io/nvBenz/)

Oh the name? nv-what? Similarly to what I wrote for [my other app](https://github.com/aadm/nvAppnt) that I made following similar urges: "Inspired by [nvAlt](https://en.wikipedia.org/wiki/Notational_Velocity) and the lack of open-source alternatives".

## Table of Contents

- [Features](#features)
- [Units & consumption](#units--consumption)
- [Import your Fuelio archive](#import-your-fuelio-archive)
- [CSV format](#csv-format)
- [Export to GitHub gist](#export-to-github-gist)
- [Setup — GitHub Pages](#setup--github-pages)
- [Run locally on a PC (Chrome)](#run-locally-on-a-pc-chrome)
- [Mobile usage — install on iPhone](#mobile-usage--install-on-iphone)
- [Offline behavior & data safety](#offline-behavior--data-safety)
- [Customizing the UI](#customizing-the-ui)
- [TODO / future ideas](#todo--future-ideas)
- [File structure](#file-structure)

## Features

- Vehicle database (cars and motorbikes) with nickname-based quick switching
- One-handed refueling entry: price per liter + total paid (liters auto-calculated)
- Fuel type dropdown: Diesel, Diesel+, HVO, Unleaded 95, Unleaded 98 (extensible)
- Fuelio-style consumption: intervals between full tanks; partial fills accumulate
- Dual-axis home chart: consumption (blue) + total cost (black/white), last 6 months
- Stats page with time-range selector (All, This month, Last month, This year, 1 yr ago, 2 yr ago)
- Fixed consumption scale 5-25 km/l on stats charts
- Price per liter chart in green with data-point markers for short periods
- Monthly cost & liters bar chart: solid colors, adjacent pairs, last 12 months
- CSV import/export of the full archive (Fuelio-compatible)
- Import log with full per-row detail (warnings, skipped rows, duplicates)
- Export to a GitHub secret gist (manual backup / sync bridge)
- GPS coordinates preserved on import (for future location features)
- Works offline; all data stored locally on the device
- Default currency: Euro (€), changeable in Settings
- Material Symbols icons (downloaded from Google's official icon set)
- Large fonts and >= 48px touch targets for one-handed use

## Units, consumption & currency

Default is **metric** (km, liters). Two consumption display modes:

| Mode | Meaning |
|------|---------|
| km/l | Kilometers per liter (default) |
| l/100 km | Liters per 100 km |

### Currency (entry currency + EUR storage)

All costs are **stored in euros** — regardless of the selected currency. The
currency selector in Settings only controls the **fill-up entry form**: amounts
typed there (price per liter, total paid) are shown in the selected currency and
converted to EUR on save using the conversion factor.

When a non-EUR currency is selected in Settings, an editable factor input
appears below the selector: `1 EUR = X <currency>`. The default factor is
fetched live from [frankfurter.app](https://frankfurter.app) (ECB reference
rates, CORS-enabled, 3-second timeout) when online; offline it falls back to
hardcoded sane defaults in `js/views/settings.js` (`DEFAULT_FACTORS`). The user
can always override the factor manually — edits persist on change.

Recent fill-ups and full-history lists report the fuel type of each entry
(intervals show the union of fuel types across their fill-ups).

The monthly cost & liters chart follows the selected time range: year-type
ranges (This yr, 1 yr ago, 2 yr ago) redraw it with that window's monthly data;
other ranges (All, This mo, Last mo) keep the last-12-months view.

Consumption is computed Fuelio-style: an interval starts at a full tank. Liters consumed
between two full tanks divided by distance traveled gives the interval consumption. Partial
fills accumulate their liters into the current open interval until the next full tank.

Chart conventions:
- All x-axis labels use `Mon-YY` format (e.g., `Dec-26`, `Mar-24`), flat/horizontal
- Exactly 3 x-axis tick labels (left, center, right) via explicit callback
- Exactly 3 y-axis tick labels, integers only (no floats)
- Consumption axis: blue (`#60a5fa` dark / `#2563eb` light), fixed scale in two modes:
  - `km/l` mode: extent 8-22 with tick labels at 10, 15, 20 km/l
  - `l/100km` mode: inverted axis (`reverse: true`) so better (lower) values sit
    at the top, extent 4.5 (top) to 12.5 (bottom) — the exact conversion of the
    km/l extent — with tick labels at 5, 7, 10 l/100km (the middle tick is
    deliberately not at the geometric midpoint)
- Cost axis: black/white (theme-aware), dynamic clean range with buffer
- Price per liter: green (`#4ade80` dark / `#16a34a` light), FIXED range 1.5-2.5 €/l
  with ticks at €1.5, €2, €2.5 — outlier values are clipped rather than allowed to
  widen the axis
- Home chart (Consumption & costs): cost axis recomputes dynamically from the
  displayed data with exactly 3 ticks forced at min/mid/max via afterBuildTicks
- Avg consumption card values convert with the selected unit (km/l ⇄ l/100km)
- Total liters on the Total costs card are rounded up to whole liters
- Monthly bar chart y-axes: bottom tick (0) has its label hidden — only mid and top
  are displayed
- No grid lines anywhere
- Line thickness: 3px
- Bar chart: solid colors (no outline), adjacent pairs within each month
  (`barPercentage: 1.0`), visible gap between months (`categoryPercentage: 0.7`)
- Data-point markers shown only when time range is "This month" or "Last month"

## Import your Fuelio archive

Your Fuelio export (`.fuelio` zip) contains one `vehicle-<n>-local.csv` per vehicle. Each
file has multiple sections marked by `## SectionName`:

- `## Vehicle` — vehicle metadata (name, make, model, year, plate, tank capacity)
- `## Log` — refueling records (the only section with fill-up data)
- All other sections (`## Costs`, `## TripLog`, `## FavStations`, `## Pictures`, etc.)
  are **ignored** during import

The importer also handles **plain CSVs** (no section markers) — the whole file is treated
as a fill-up log, with the vehicle name derived from the filename.

To import:

1. Extract the `.fuelio` zip on your PC or phone.
2. Open nvBenz, go to **More → Import / Export**.
3. Tap **Choose files** and select the `vehicle-*-local.csv` files (you can select all 8
   at once). Do **not** select the `.fuelio`/`.zip` itself — the browser cannot unzip it
   without a library; select the extracted CSVs.
4. Review the import summary, then tap **View full import log** for per-row details
   (skipped rows, duplicates, warnings).

Required columns (any of these aliases work):

| Field | Accepted column names |
|-------|----------------------|
| date | `Date`, `date` |
| odo | `Odo (km)`, `Odo`, `odo`, `odometer`, `Odometer` |
| liters | `Fuel (l)`, `Fuel`, `liters`, `Liters`, `litres`, `Litres` |
| cost | `Price`, `price`, `cost`, `Cost`, `total`, `Total` |
| full | `Full`, `full` (1 = full tank, 0 = partial) |
| notes | `Notes`, `notes`, `note`, `Note` |
| lat | `latitude`, `Latitude`, `lat`, `Lat` |
| lng | `longitude`, `Longitude`, `lng`, `lon`, `Lon`, `Lng` |
| FuelType (numeric) | `FuelType` — Fuelio's per-installation fuel type code |

GPS coordinates are stored on each fill-up record for a future location-recording feature.

**Fuel type resolution** — Fuelio changed how it stores fuel type between
versions: older entries carry it as free text in **Notes** (manually typed),
newer entries use a numeric **FuelType** code. The resolution order reflects
which the app itself recorded:

1. **Numeric FuelType code** (priority) — when present, non-zero, and mapped.
   The user's Fuelio IDs: `110 → Unleaded 95`, `112 → Unleaded 98`,
   `201 → Diesel`, `202 → Diesel+`, `220 → HVO`, `211 → HVO`.
   Note on `211`: in the original Fuelio app this ID is **Biodiesel**; for
   import purposes it is approximated as **HVO** — the same usage intent in
   this fleet, though not strictly equivalent fuel chemistry (table:
   `FUEL_TYPE_CODES` in `js/views/import-export.js` — edit if your IDs
   differ). Codes not in the table (e.g. `219`) fall through to Notes
   detection.
2. **Notes keywords** (fallback) — `hvo`, `diesel+`, `unleaded 95/98`,
   `lpg`, `petrol`, `benzina`.
3. Neither resolves → `Unspecified`, then the second pass below applies.

**Second pass — vehicle majority type**: after all rows of a vehicle are
processed, the import counts every resolved (non-Unspecified) type and fills
that vehicle's remaining Unspecified rows — both just-imported and
pre-existing — with the most frequent one. The VW's 133 legacy rows become
Diesel, the Volvo's 46 become Unleaded 95, etc. Vehicles with no resolved
types at all (no codes, no notes) are left Unspecified. The pass is
idempotent: filled rows are no longer Unspecified, so re-importing changes
nothing. The import log lists the fill count per vehicle and the summary
reports the total.

**De-duplication with repair**: re-importing the same CSV reuses the existing
vehicle (by name) and matches fill-ups by date + odometer. When the archive
resolves a different (or missing) fuel type than what is stored, the record
is **corrected in place** — this both backfills Unspecified rows and fixes
rows typed by an earlier, wrong mapping. Stored types are never downgraded
to Unspecified. The import log lists every correction (`old → new`) and the
summary reports the count.

## CSV format

The CSV export ("Export fill-ups") produces a single clean fill-ups table —
`nvBenz-fillups.csv` — that opens correctly in any spreadsheet and is directly
re-importable via the plain-CSV import mode:

```
id,vehicleId,date,odo,liters,cost,full,fuelType,notes,lat,lng
```
- `date`: `yyyy-MM-dd` or `yyyy-MM-ddTHH:mm`
- `full`: `1` for full tank, `0` for partial
- `cost`: always EUR (see the currency section)

The JSON export contains the complete archive (vehicles, fuel types,
fill-ups) and is the format to use for backups.

Download note: the blob object URL is revoked only after a delay — revoking
it synchronously after the anchor click silently aborts the download in
Safari/iOS (this was the CSV export bug).

## Export to GitHub gist

In **Settings → GitHub export (gist)**:

1. Create a Personal Access Token at https://github.com/settings/tokens with the `gist`
   scope. Copy it.
2. Paste the token into nvBenz Settings. It is stored only in your browser's IndexedDB and
   is sent only to api.github.com.
3. Tap **Export to GitHub gist**. nvBenz creates a **secret gist** containing
   `nvBenz-export.json` (vehicles, fuel types, fill-ups, exported at timestamp).
4. Re-exporting updates the same gist (the Gist ID is remembered).

## JSON import (backup restore / version upgrades)

**More → Import / Export → Import JSON archive** restores a
`nvBenz-export.json` file — the path for moving to a new phone or
recovering data after a version upgrade:

1. Vehicles are matched **by name** — existing ones are reused, new ones
   created (with fresh ids; `defaultFuelTypeId` references are translated)
2. Fuel types are matched **by name** the same way
3. Fill-ups are attached to the mapped vehicle and matched **by date +
   odometer** — duplicates are skipped, so re-importing the same archive
   changes nothing

JSON is the recommended backup format: it is lossless (vehicles with all
metadata, fuel types, fill-ups with GPS) and round-trips between versions.
Use the CSV export for spreadsheet interchange, not for restores.

## Setup — GitHub Pages

nvBenz is a static site with no build step. Host it on GitHub Pages (free) and install it
on your phone like a native app.

```bash
cd ~/GITHUB/nvBenz
git init
git add .
git commit -m "nvBenz initial commit"
gh repo create nvBenz --public --source=. --push
```

Then enable GitHub Pages:

```bash
gh api repos/aadm/nvBenz/pages -X PUT \
  -f build_type=legacy \
  -f source.branch=main \
  -f source.path=/
```

The app will be available at `https://aadm.github.io/nvBenz/`.

The service worker (`sw.js`) uses a versioned cache (currently `nvBenz-v21`). Bump this
version in `sw.js` to force a cache wipe on the next launch after an update.

## Run locally on a PC (Chrome)

To test the current build on your PC in Chrome without deploying:

```bash
cd ~/GITHUB/nvBenz
python3 -m http.server 8081
```

Open `http://localhost:8081` in Chrome.

- Chrome treats `localhost` as a secure origin, so the service worker registers and the
  PWA works (offline caching, IndexedDB).
- Open DevTools → Application → Service Workers to confirm the SW is active.
- DevTools → Application → IndexedDB to inspect `nvBenz` (vehicles, fuel_types, fillups,
  settings).

To clear a stale service worker (common during development):

```javascript
// In DevTools Console:
navigator.serviceWorker.getRegistrations().then(r => r.forEach(w => w.unregister()));
```

Then hard-refresh (`Ctrl+Shift+R`) or use an Incognito window.

## Mobile usage — install on iPhone

1. Open the app URL in Safari: `https://aadm.github.io/nvBenz/`
2. Tap the **Share** button (square with arrow) at the bottom of Safari.
3. Scroll down and tap **Add to Home Screen**.
4. The app appears on your home screen with its own icon and launches full-screen
   (standalone), like a native app.

### Refreshing after updates

The service worker caches `index.html`. After an update on GitHub Pages:

1. Close the app fully (swipe up from the app switcher).
2. Re-open from the home screen.

If the old version still loads, remove from Home Screen and re-install via Share →
"Add to Home Screen".

## Offline behavior & data safety

- All data lives in IndexedDB on the device. Nothing leaves the phone unless you trigger a
  GitHub gist export.
- The app shell and Chart.js are cached by the service worker; the app works fully offline
  after the first visit.
- iOS may evict IndexedDB data under storage pressure. **Export a CSV (or gist) regularly
  as a backup.**
- The GitHub PAT is stored in IndexedDB in clear text. It is sent only to api.github.com.
  Use a token with the minimum scope (`gist`).

## Customizing the UI

All user-facing text lives in the view modules under `js/views/`. Key locations:

| What | Where to edit |
|------|--------------|
| "About" text in More | `js/views/more.js` — the `<div class="section-title">About</div>` section |
| More menu items (labels, subtitles) | `js/views/more.js` — the `.list-row` entries |
| Home card labels (Avg consumption, Total cost, etc.) | `js/views/home.js` — the `.card .label` divs |
| Home section titles (Consumption & price, Recent fill-ups) | `js/views/home.js` — the `.section-title` divs |
| "View All" button text | `js/views/home.js` — `#btn-view-all` |
| Fill-up form labels (Price per liter, Total paid, etc.) | `js/views/fillup.js` — the `.form-group label` elements |
| Vehicle edit modal labels (Nickname, Make, Model, etc.) | `js/views/vehicles.js` — the `#veh-form` labels |
| Settings labels (Units, Consumption, Currency, Theme) | `js/views/settings.js` — the `.setting-row` entries |
| Import/Export instructions | `js/views/import-export.js` — the `<p>` blocks |
| Stats time-range button labels | `js/views/stats.js` — the `TIME_RANGES` array at the top |
| Toast messages (saved, deleted, errors) | `showToast('...')` calls throughout `js/views/*.js` |
| Bottom nav labels (Home, Fill-up, Vehicles, More) | `index.html` — the `.nav-label` spans |
| Chart y-axis labels (€, km/l, l) | `js/charts.js` — the `callback:` functions in `ticks` |
| Chart date format (Mon-YY) | `js/charts.js` — the `formatDateLabel()` function |
| Colors (accent, background, text) | `css/style.css` — the `:root` and `[data-theme="light"]` CSS variables |
| Icons | `js/icons.js` — Material Symbols SVG paths (from fonts.gstatic.com) |

## TODO / future ideas

- Store the per-vehicle majority fuel type as a `preferredFuelType` field
  (computed during the import second pass) and pre-select it on the
  fill-up form + show/edit it in the vehicle form
- Settings option to configure the fixed price-per-liter chart range
  (currently hardcoded 1.5-2.5 €/l in `js/charts.js` `priceChart`)
- "Import from gist" button to restore data on a second phone (export already works)
- GPS recording of refueling location from the fill-up form (lat/lng already
  stored on Fuelio import, ready to use)
- Per-vehicle default fuel type auto-selected on the fill-up form
- Android install prompt via `beforeinstallprompt`
- Fill-up series interpolation when a refueling was missed (Fuelio-style
  "missed fill-up" flag support)

## File structure

```
nvBenz/
  index.html            # App shell (nav icons inline, links to entry module)
  manifest.json         # PWA manifest
  sw.js                 # Service worker (offline cache)
  css/style.css         # Styles (mobile-first, large fonts, theme variables)
  idb.js                # Tiny IndexedDB wrapper
  js/app.js             # Application entry point (window.app actions)
  js/db.js              # Database layer (vehicles, fuel_types, fillups, settings)
  js/model.js           # Business logic (Fuelio-style consumption, stats, unit conversion)
  js/charts.js          # Chart.js rendering (all chart types, theme-aware colors)
  js/icons.js           # Material Symbols icons (actual Google SVG paths)
  js/router.js          # View switching + toast
  js/github.js          # GitHub gist export via PAT
  js/views/home.js      # Home dashboard (vehicle switcher, cards, dual-axis chart)
  js/views/fillup.js    # One-handed fill-up entry (price/liter + total → liters)
  js/views/fillup-list.js # Full fill-up history with tap-to-edit
  js/views/stats.js     # Stats page (time-range selector, 3 charts)
  js/views/vehicles.js # Vehicle management (add/edit/delete, set active)
  js/views/import-export.js # CSV/JSON import/export with full log
  js/views/settings.js  # Settings (units, currency, theme, GitHub gist)
  js/views/more.js      # More menu (links to Import/Export, Settings, About text)
  vendor/chart.js       # Chart.js v2.9.4 (vendored for offline use)
  icons/
    favicon.svg
    icon-180.png
    icon-192.png
    icon-512.png
  README.md             # This file
```

No npm, no build step, no framework — vanilla JavaScript throughout.



## Favicon

Favicon (used by browsers like Chrome, Firefox etc) is the Google Material Symbols `local_gas_station` icon.

## Icon Generation

I started from the icon drawn for [nvAppnt](https://github.com/aadm/nvAppnt) in in Inkscape, added the favicon above, and placed the fuel pump roughly in line with the colored ribbon, stretched until balanced and that was it.

(I also tried for several minutes to make something nicer in Gemini and Claude but the results were terrible; honestly this is what baffles me -- LLM that can produce a whole FPS game from scratch with minimal prompts, drawings and videos of pelicans and otters doing absurd things, but thn you ask for a super simple, clean icon and it all falls apart... maybe the singularity is not that close).


![nvBenz icon](icons/icon-512.png)

(aadm, November 2026)