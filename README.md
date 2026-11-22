# nvBenz

Personal fuel tracker — vehicles, fill-ups, consumption and costs. Built to replace Fuelio
without being tied to a commercial app. Offline-first: the entire database lives on your
device (IndexedDB). Installable as a PWA on iPhone and any smartphone.

Launch it here: `https://aadm.github.io/nvBenz/`

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

## Units & consumption

Default is **metric** (km, liters). Two consumption display modes:

| Mode | Meaning |
|------|---------|
| km/l | Kilometers per liter (default) |
| l/100 km | Liters per 100 km |

Consumption is computed Fuelio-style: an interval starts at a full tank. Liters consumed
between two full tanks divided by distance traveled gives the interval consumption. Partial
fills accumulate their liters into the current open interval until the next full tank.

Chart conventions:
- All x-axis labels use `Mon-YY` format (e.g., `Dec-26`, `Mar-24`), flat/horizontal
- Exactly 3 x-axis tick labels (left, center, right) via explicit callback
- Exactly 3 y-axis tick labels (bottom, center, top) via explicit `stepSize = (max-min)/2`
- Y-axis tick labels are integers (no floats)
- Clean axis limits: values rounded to nearest 5/10/25/50 depending on magnitude
  (e.g., 51 → 50, 151 → 150)
- Consumption axis: blue (`#60a5fa` dark / `#2563eb` light), fixed extent 8-22 km/l
  with tick labels at 10, 15, 20 (2 km/l buffer above/below the tick range, applied
  on both the home chart and the stats consumption chart)
- Cost axis: black/white (theme-aware), dynamic clean range with buffer
- Price per liter: green (`#4ade80` dark / `#16a34a` light), dynamic clean range
  (sane defaults ~1-3 €/l for typical fuel prices)
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

GPS coordinates are stored on each fill-up record for a future location-recording feature.

**De-duplication**: re-importing the same CSV reuses the existing vehicle (by name) and
skips fill-ups already present (matched by date + odometer). No duplicates are created.

## CSV format

**vehicles.csv**
```
id,name,make,model,year,plate,kind,tankCapacity,defaultFuelTypeId,active,createdAt,updatedAt
```

**fillups.csv**
```
id,vehicleId,date,odo,liters,cost,full,fuelType,notes,lat,lng
```
- `date`: `yyyy-MM-dd` or `yyyy-MM-ddTHH:mm`
- `full`: `1` for full tank, `0` for partial

**fuel_types.csv**
```
id,name,active
```

## Export to GitHub gist

In **Settings → GitHub export (gist)**:

1. Create a Personal Access Token at https://github.com/settings/tokens with the `gist`
   scope. Copy it.
2. Paste the token into nvBenz Settings. It is stored only in your browser's IndexedDB and
   is sent only to api.github.com.
3. Tap **Export to GitHub gist**. nvBenz creates a **secret gist** containing
   `nvBenz-export.json` (vehicles, fuel types, fill-ups, exported at timestamp).
4. Re-exporting updates the same gist (the Gist ID is remembered).

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

The service worker (`sw.js`) uses a versioned cache (currently `nvBenz-v15`). Bump this
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
