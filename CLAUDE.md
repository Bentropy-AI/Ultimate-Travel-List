# CLAUDE.md — Ultimate Travel List: Architecture Reference

> **Maintained by Claude.** Update this file at the end of any session that changes structure, data, logic, or pages.  
> Repo: `bentropy-ai/Ultimate-Travel-List` · Hosted: GitHub Pages · Last updated: 2026-05-05

---

## 1. Project Overview

A family travel-tracking website with no build step — pure HTML, ES5 JavaScript, and CSS served directly via GitHub Pages. Tracks six categories of travel achievement for four family members. All state is persisted remotely via JSONBin and locally via `localStorage` as a cache.

**Constraints (always respect these):**
- Pure ES5 — no template literals, no destructuring, no arrow functions, no modules
- No build step, no npm, no bundler
- No server-side logic — everything runs in the browser
- Single external CSS file; page-specific styles are inline `<style>` blocks
- All data files are static JSON in `/data/`

---

## 2. File Structure

```
/                          ← repo root
├── index.html             ← Home / Master Overview page
├── css/
│   └── styles.css         ← Global styles (CSS custom properties, layout, components)
├── js/
│   └── travel.js          ← Core shared library (ALL shared logic lives here)
├── data/
│   ├── travellers.json    ← Traveller profiles + baseline visited arrays
│   ├── countries.json     ← Master country list (id=ISO2, name, capital, continent)
│   ├── animals.json       ← Master animals list
│   ├── unesco.json        ← Master UNESCO sites list (large: ~12k lines)
│   ├── travellist1.json   ← Travel List I destinations (500 items: id, name, country, region)
│   └── travellist2.json   ← Travel List II destinations (500 items: id, name, country, region)
└── pages/
    ├── ultimatetravellist1.html   ← TL I tracker (family comparison table)
    ├── ultimatetravellist2.html   ← TL II tracker (family comparison table)
    ├── countries.html             ← Countries & Capitals tracker
    ├── unesco.html                ← UNESCO sites tracker
    ├── animals.html               ← Animals tracker
    ├── analytics.html             ← Family Dashboard (comparison table + category cards)
    ├── ben.html                   ← Ben's profile (Progress tab + Timeline tab)
    ├── shaz.html                  ← Shaz's profile (same structure as ben.html)
    ├── paul.html                  ← Paul's profile
    └── ruth.html                  ← Ruth's profile
```

---

## 3. Travellers

| ID    | Name | Colour    | CSS class       |
|-------|------|-----------|-----------------|
| `ben` | Ben  | `#4f8ef7` | `traveller-ben` / `avatar-ben` |
| `shaz`| Shaz | `#9b59f5` | `traveller-shaz` |
| `paul`| Paul | `#3ecf8e` | `traveller-paul` |
| `ruth`| Ruth | `#e05c8e` | `traveller-ruth` |

---

## 4. Data Model

### 4.1 Remote State (JSONBin)

Single JSONBin record (`bin ID: 69cd4cbd36566621a86d74ab`) holds the entire mutable state:

```json
{
  "visited": {
    "ben":  { "countries":[], "capitals":[], "animals":[], "unesco":[], "travellist1":[], "travellist2":[] },
    "shaz": { ... },
    "paul": { ... },
    "ruth": { ... }
  },
  "trips": {
    "ben":  [ { "id", "country", "continent", "locations", "start", "finish", "type", "utl1", "utl2", "companions" } ],
    "shaz": [],
    "paul": [],
    "ruth": []
  }
}
```

Every PUT writes the **full record** (visited + trips together) to prevent clobbering.

### 4.2 Local Cache (localStorage)

| Key               | Contents                          |
|-------------------|-----------------------------------|
| `utl_store_v2`    | Full `visited` object (all 4 travellers) |
| `utl_trips_v1`    | Full `trips` object (all 4 travellers)   |

Cache is read immediately on page load for instant render; remote is fetched async and overwrites cache on success.

### 4.3 Static Data Schemas

**travellers.json** — baseline arrays are legacy; live state comes from JSONBin:
```json
{ "id": "ben", "name": "Ben", "emoji": "B", "color": "#4f8ef7",
  "countries": ["AL","AR",...], "travellist2": ["petra",...], ... }
```

**countries.json:** `{ "id": "GB", "name": "United Kingdom", "capital": "London", "continent": "Europe" }`

**travellist1.json / travellist2.json:** `{ "id": "temples-of-angkor", "name": "Temples of Angkor", "country": "Cambodia", "region": "Asia" }`

**unesco.json:** `{ "id": "...", "name": "...", "country": "France, ..." }` — note: `country` field can be comma-separated multi-country.

**animals.json:** `{ "id": "...", "name": "..." }`

### 4.4 Trip Object Schema

```js
{
  id:          String,      // auto-generated or omitted
  country:     String,      // matched to countries.json name
  continent:   String,      // auto-filled from countries.json
  locations:   String,      // free text e.g. "Manila, Bohol, El Nido"
  start:       "YYYY-MM-DD",
  finish:      "YYYY-MM-DD", // optional
  type:        "Travel" | "Work" | "Friends" | "Family",
  utl1:        [String],    // array of travellist1 item IDs or names
  utl2:        [String],    // array of travellist2 item IDs or names
  companions:  [String]     // array of traveller IDs e.g. ["shaz","paul"]
}
```

---

## 5. Core JavaScript Library (`js/travel.js`)

All pages load `travel.js` and use `window.TravelApp`. The file is **pure ES5**.

### 5.1 Exports (`window.TravelApp`)

| Export | Type | Purpose |
|--------|------|---------|
| `Store` | Object | Visited item CRUD (toggle/isVisited/getVisitedArray/getVisitedCount/load/onSave) |
| `TripStore` | Object | Trip log CRUD (load/getTrips/saveTrips/onSave) |
| `fetchJSON(file)` | Function | Fetches from `/data/{file}` with correct root path |
| `getRoot()` | Function | Returns `../` when in `/pages/`, `./` from root |
| `loadAllData()` | Function | Legacy — loads all 6 data files, merges localStorage cache into traveller objects |
| `renderNav(activeKey)` | Function | Builds the site nav HTML; activeKey identifies the current page |
| `buildProgressBar(value, total, cls)` | Function | Returns HTML string for a progress bar |
| `buildStatCard(number, label)` | Function | Returns HTML string for a stat card |
| `renderChecklist(opts)` | Function | Renders a filterable/searchable checklist with toggle support |
| `renderComparisonTable(opts)` | Function | Renders a multi-traveller comparison table with dot toggles |
| `countVisited(traveller, category)` | Function | Returns count from a traveller object's array |
| `pct(visited, total)` | Function | Returns integer percentage |

### 5.2 Store API

```js
Store.load(onRemoteCallback)   // Loads all 6 data files + remote state; returns Promise<{travellers,countries,...}>
Store.toggle(travId, category, itemId)   // Toggles visited state + debounced PUT to JSONBin
Store.isVisited(travId, category, itemId)  // Returns boolean
Store.getVisitedArray(travId, category)    // Returns array of visited IDs
Store.getVisitedCount(travId, category)    // Returns integer count
Store.onSave(fn)               // Register callback(status, msg) — called after each PUT
```

### 5.3 TripStore API

```js
TripStore.load(travId)         // Fetches full remote record; returns Promise<trips[]>
TripStore.getTrips(travId)     // Synchronous; returns cached trips array
TripStore.saveTrips(travId, trips)  // Replaces trips array + debounced PUT
TripStore.onSave(fn)           // Register callback(status, travId)
```

### 5.4 JSONBin Configuration

```js
_BIN_ID    = '69cd4cbd36566621a86d74ab'
_API_KEY   = '$2a$10$ZBPwhHYl3Fa7.3xScA8xVe4Nq7UfBqDgk/kFuk7E7dDktRt8yapM.'
_BIN_URL   = 'https://api.jsonbin.io/v3/b/' + _BIN_ID
_CACHE_KEY = 'utl_store_v2'          // localStorage key for visited
_TRIPS_CACHE_KEY = 'utl_trips_v1'    // localStorage key for trips
```

PUT calls are **debounced at 800ms**. Failed PUTs retry once after 2 seconds.

### 5.5 Nav Keys

Pass the correct key to `renderNav(activeKey)`:

| Page | Key |
|------|-----|
| index.html | `"home"` |
| ultimatetravellist1.html | `"list1"` |
| ultimatetravellist2.html | `"list2"` |
| countries.html | `"countries"` |
| unesco.html | `"unesco"` |
| animals.html | `"animals"` |
| analytics.html | `"analytics"` |
| ben.html | `"ben"` |
| shaz.html | `"shaz"` |
| paul.html | `"paul"` |
| ruth.html | `"ruth"` |

---

## 6. Page Patterns

### 6.1 Standard Page Boilerplate

```html
<link rel="stylesheet" href="../css/styles.css">   <!-- or ./css/styles.css from root -->
<script src="../js/travel.js"></script>
<script>
  var app = window.TravelApp;
  app.renderNav('pageKey');
  // page logic here using app.Store, app.TripStore, etc.
</script>
```

### 6.2 List/Tracker Pages (TL1, TL2, Countries, UNESCO, Animals)

Pattern:
1. Call `Store.load(redrawFn)` which returns `Promise<data>`
2. In `.then()`, store `_travellers` and the relevant data array
3. `redrawFn` calls `renderSummary()` + `renderTable()`
4. Table has per-traveller checkboxes; clicking calls `Store.toggle()` then `redraw()`
5. Register `Store.onSave()` for save toast notification

### 6.3 Traveller Profile Pages (ben.html, shaz.html, paul.html, ruth.html)

Two tabs:
- **Progress tab** (`#tab-progress`): stat cards + amCharts 5 world map + Country Completion table
- **Timeline tab** (`#tab-timeline`): Visual Timeline (SVG-based gantt) + Travel Log table + Add/Edit modal

Tab switching logic is at the bottom of the page in a self-contained IIFE.

The **Visual Timeline** (`window._vtRender`) uses SVG drawn from scratch. Scales: `decade` (0.35px/day), `year` (3.2px/day), `month` (24px/day). Trips are lane-assigned to avoid overlap.

The **Travel Log** uses `TripStore.load(TRAV_ID)` then `TripStore.getTrips()` / `TripStore.saveTrips()`.

The **Country Completion table** is Ben-specific (only in `ben.html`) and calculates a weighted completion % per country:
- Country visited: 35%
- Capital visited: 15%
- TL1 items: 25%
- TL2 items: 25%
- (Weights adjusted if a country has no TL1 or TL2 entries)

The **amCharts 5 world map** uses a `NAME_MAP` to resolve non-ISO country names from TL1/TL2 data to ISO2 codes. The map colours countries by completion % using a lerp between `#22263a` → `#2a5298` → `#3a78d4` → `#4f8ef7`.

### 6.4 Home Page (index.html)

Uses `loadAllData()` (legacy helper). Displays:
- Stats grid: counts from each category, each linking to the relevant tracker page
- Traveller cards: per-person progress bars across all categories

### 6.5 Analytics Page (analytics.html)

Uses `loadAllData()`. Displays:
- Family comparison table (all travellers × all categories)
- Progress by category cards

---

## 7. CSS Architecture

Single file: `css/styles.css`. Uses CSS custom properties defined on `:root`.

**Key CSS variables:**
```css
--color-bg, --color-surface, --color-surface2
--color-text, --color-muted
--color-border
--color-primary, --color-accent
--color-success, --color-warning, --color-danger
--color-ben (#4f8ef7), --color-shaz (#9b59f5), --color-paul (#3ecf8e), --color-ruth (#e05c8e)
--radius, --radius-sm
--transition
```

**Reusable component classes:**
- `.page-wrapper`, `.site-nav`, `.nav-inner`, `.page-hero`
- `.container`, `.section`, `.section-title`
- `.stats-grid`, `.stat-card`, `.stat-number`, `.stat-label`
- `.card`, `.card-link`
- `.progress-bar`, `.progress-fill`, `.progress-wrap`, `.progress-label`
- `.filter-bar`, `.filter-btn`, `.search-input`
- `.item-list` (checklist items)
- `.comparison-table` (multi-traveller dot table)
- `.badge`, `.badge-info`
- `.loading-msg`, `.empty-msg`
- `.site-footer`
- `.person-hero`, `.person-avatar`
- `.traveller-tabs`, `.traveller-tab`, `.tab-panel` (traveller page tabs)

**Progress bar fill colours by traveller:**
`.progress-fill.ben`, `.progress-fill.shaz`, `.progress-fill.paul`, `.progress-fill.ruth`

Page-specific styles are always in inline `<style>` blocks in the `<head>` of that page — never added to `styles.css` unless they are genuinely reusable across multiple pages.

---

## 8. Rendering Patterns & Conventions

- **All DOM building uses string concatenation** (`html += '<div>...'`) — no template literals
- **Event delegation** is used on containers wherever possible
- **`data-*` attributes** carry item IDs and traveller IDs on interactive elements
- **`var` only** — no `let` or `const`
- **`for` loops** — no `forEach`, `map`, `filter` on arrays unless already in the codebase
- **`function` declarations** — no arrow functions
- Save toast pattern: fixed position `div.save-toast`, toggled with `.show` class, auto-removed after 1.8s
- Search is always lowercase `.toLowerCase()` matched against `.indexOf()`

---

## 9. Known Country Name Mappings

Some TL1/TL2 items use non-standard country names. The `NAME_MAP` in `travel.js` and `ben.html` resolves these:

```js
'Bosnia' → 'BA', 'UAE' → 'AE', 'UK' → 'GB', 'USA' → 'US',
'England' → 'GB', 'Scotland' → 'GB', 'Northern Ireland' → 'GB', 'Wales' → 'GB',
'Bosnia-Herzegovina' → 'BA', 'Argentina/Brazil' → ['AR','BR'],
'Zimbabwe/Zambia' → ['ZW','ZM'], 'Israel/Jordan' → ['IL','JO'], ...
```

UNESCO `country` fields can be multi-value (comma-separated) and use `UNESCO_NM` for name→ISO mapping.

---

## 10. Recent Changes Log

| Date | Change |
|------|--------|
| 2026-05-05 | `CLAUDE.md` created from full repo analysis |
| ~2026-04 | Timeline tab added to traveller pages (Visual Timeline + Travel Log + modal) |
| ~2026-04 | `TripStore` added to `travel.js` alongside `Store`; single JSONBin record now holds both `visited` and `trips` |
| ~2026-04 | Travel companion tracking added to trip modal (multi-select, stored as traveller ID array) |
| ~2026-04 | Country Completion table added to `ben.html` (weighted % per country) |
| ~2026-04 | amCharts 5 world map added to `ben.html` with completion colour gradient |
| ~2026-03 | `travellist2.json` and TL2 tracker page added |
| ~2026-03 | Analytics / Family Dashboard page added |

---

## 11. How to Use This File

At the start of a future session, say:  
> *"Please reference CLAUDE.md in the repo to understand the site before making changes."*

After any session that modifies structure, data schemas, new pages, or significant logic, update the relevant sections of this file and commit it alongside the code changes.
