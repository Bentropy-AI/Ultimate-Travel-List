# CLAUDE.md — Ultimate Travel List: Architecture Reference

> **Maintained by Claude.** Update this file at the end of any session that changes structure, data, logic, or pages.  
> Repo: `bentropy-ai/Ultimate-Travel-List` · Hosted: GitHub Pages · Last updated: 2026-05-06


---

## 0. CRITICAL: How to Work on Traveller Pages

**The four traveller pages (`ben.html`, `shaz.html`, `paul.html`, `ruth.html`) are structurally identical.** They differ only in person ID, name, initial, colour variable, and colour hex. They are maintained as four separate files — no build step, no templating engine.

### Rule: always change all four pages together

**Never commit a change to one traveller page without applying it to all four.**

### Workflow for any change to a traveller page

1. Make the change to `ben.html` only and verify it works.
2. Run the substitution script below to generate the other three.
3. Commit all four files in a single commit.

### Substitution script

```python
import base64, json, urllib.request

TOKEN = "YOUR_PAT"
REPO  = "bentropy-ai/Ultimate-Travel-List"

with open('ben.html', 'r') as f:
    ben = f.read()

PEOPLE = [
    {'id':'shaz','name':'Shaz','initial':'S','color_var':'color-shaz','pstats_color':'#9b59f5','pstats_bg':'rgba(155,89,245,.07)','btn_fallback':'#9b59f5'},
    {'id':'paul','name':'Paul','initial':'P','color_var':'color-paul','pstats_color':'#3ecf8e','pstats_bg':'rgba(62,207,142,.07)','btn_fallback':'#3ecf8e'},
    {'id':'ruth','name':'Ruth','initial':'R','color_var':'color-ruth','pstats_color':'#e05c8e','pstats_bg':'rgba(224,92,142,.07)','btn_fallback':'#e05c8e'},
]

# All person-specific substitutions — extend this list if new patterns are added
def make_replacements(p):
    pid=p['id']; cv=p['color_var']; nm=p['name']; ini=p['initial']
    pc=p['pstats_color']; pb=p['pstats_bg']; bf=p['btn_fallback']
    return [
        ('<title>Ben - Travel Progress</title>', f'<title>{nm} - Travel Progress</title>'),
        ('#pStats .stat-card .stat-number { color: #4f8ef7 !important; }\n      #pStats .stat-card { border-top: 3px solid #4f8ef7; background: rgba(79,142,247,.07); }',
         f'#pStats .stat-card .stat-number {{ color: {pc} !important; }}\n      #pStats .stat-card {{ border-top: 3px solid {pc}; background: {pb}; }}'),
        ('class="person-avatar avatar-ben">B<', f'class="person-avatar avatar-{pid}">{ini}<'),
        ('style="color:var(--color-ben)">Ben<', f'style="color:var(--{cv})">{nm}<'),
        ('class="traveller-tabs tabs-ben"', f'class="traveller-tabs tabs-{pid}"'),
        ('background:linear-gradient(90deg,#2563c4,var(--color-ben))', f'background:linear-gradient(90deg,#2563c4,var(--{cv}))'),
        ('.tl-vt-zoom-btn.active{background:var(--color-ben);color:#fff;border-color:var(--color-ben)}',
         f'.tl-vt-zoom-btn.active{{background:var(--{cv});color:#fff;border-color:var(--{cv})}}'),
        ('.tl-date-col{font-weight:600;color:var(--color-ben)!important;font-size:.85rem}',
         f'.tl-date-col{{font-weight:600;color:var(--{cv})!important;font-size:.85rem}}'),
        ('background:var(--color-ben);color:#fff;border:none;border-radius:var(--radius-sm);font-size:.9rem;font-weight:600;cursor:pointer;transition:opacity var(--transition);white-space:nowrap}',
         f'background:var(--{cv});color:#fff;border:none;border-radius:var(--radius-sm);font-size:.9rem;font-weight:600;cursor:pointer;transition:opacity var(--transition);white-space:nowrap}}'),
        ('background:var(--color-ben,#4f8ef7);color:#fff;border:none;border-radius:var(--radius-sm);font-size:.9rem;font-weight:600;cursor:pointer;transition:opacity var(--transition)}',
         f'background:var(--{cv},{bf});color:#fff;border:none;border-radius:var(--radius-sm);font-size:.9rem;font-weight:600;cursor:pointer;transition:opacity var(--transition)}}'),
        ('background:var(--color-ben); color:#fff; border-radius:20px; padding:1px 8px; font-size:.72rem; font-weight:700; }',
         f'background:var(--{cv}); color:#fff; border-radius:20px; padding:1px 8px; font-size:.72rem; font-weight:700; }}'),
        ('var PERSON = "ben";', f'var PERSON = "{pid}";'),
        ("var TRAV_ID = 'ben';", f"var TRAV_ID = '{pid}';"),
        ("_tv.indexOf('ben')!==-1", f"_tv.indexOf('{pid}')!==-1"),
        ("pd.countries=store.getVisitedArray('ben','countries');\n              pd.capitals=store.getVisitedArray('ben','capitals');\n              pd.travellist1=store.getVisitedArray('ben','travellist1');\n              pd.travellist2=store.getVisitedArray('ben','travellist2');\n              pd.unesco=store.getVisitedArray('ben','unesco');\n              pd.animals=store.getVisitedArray('ben','animals');",
         f"pd.countries=store.getVisitedArray('{pid}','countries');\n              pd.capitals=store.getVisitedArray('{pid}','capitals');\n              pd.travellist1=store.getVisitedArray('{pid}','travellist1');\n              pd.travellist2=store.getVisitedArray('{pid}','travellist2');\n              pd.unesco=store.getVisitedArray('{pid}','unesco');\n              pd.animals=store.getVisitedArray('{pid}','animals');"),
        ("if(tripStore){ _trips=tripStore.getTrips('ben'); }", f"if(tripStore){{ _trips=tripStore.getTrips('{pid}'); }}"),
        ("var ben=_refreshMapData();", f"var {pid}=_refreshMapData();"),
        ("var cm=buildMap(res[0],res[1],res[2],res[3],ben);", f"var cm=buildMap(res[0],res[1],res[2],res[3],{pid});"),
        ("ben=_refreshMapData();cm=buildMap(res[0],res[1],res[2],res[3],ben);renderMap(cm);", f"{pid}=_refreshMapData();cm=buildMap(res[0],res[1],res[2],res[3],{pid});renderMap(cm);"),
        ("pd.countries=store.getVisitedArray('ben','countries');\n            pd.capitals=store.getVisitedArray('ben','capitals');\n            pd.travellist1=store.getVisitedArray('ben','travellist1');\n            pd.travellist2=store.getVisitedArray('ben','travellist2');\n          }\n          buildFromVisited({'ben':pd});",
         f"pd.countries=store.getVisitedArray('{pid}','countries');\n            pd.capitals=store.getVisitedArray('{pid}','capitals');\n            pd.travellist1=store.getVisitedArray('{pid}','travellist1');\n            pd.travellist2=store.getVisitedArray('{pid}','travellist2');\n          }}\n          buildFromVisited({{'{pid}':pd}});"),
        (f"visited['ben'] = {{\n                  countries:   store.getVisitedArray('ben','countries'),\n                  capitals:    store.getVisitedArray('ben','capitals'),\n                  travellist1: store.getVisitedArray('ben','travellist1'),\n                  travellist2: store.getVisitedArray('ben','travellist2'),\n                  unesco:      store.getVisitedArray('ben','unesco'),\n                  animals:     store.getVisitedArray('ben','animals')\n                }};",
         f"visited['{pid}'] = {{\n                  countries:   store.getVisitedArray('{pid}','countries'),\n                  capitals:    store.getVisitedArray('{pid}','capitals'),\n                  travellist1: store.getVisitedArray('{pid}','travellist1'),\n                  travellist2: store.getVisitedArray('{pid}','travellist2'),\n                  unesco:      store.getVisitedArray('{pid}','unesco'),\n                  animals:     store.getVisitedArray('{pid}','animals')\n                }};"),
        ("(t.travellers||[]).indexOf('ben') !== -1) homeRec = t;", f"(t.travellers||[]).indexOf('{pid}') !== -1) homeRec = t;"),
        ("return !t._home && (t.travellers||t.companions||[]).indexOf('ben') !== -1;", f"return !t._home && (t.travellers||t.companions||[]).indexOf('{pid}') !== -1;"),
        ("Store.getVisitedArray('ben','countries')", f"Store.getVisitedArray('{pid}','countries')"),
        ("Store.getVisitedArray('ben','capitals')", f"Store.getVisitedArray('{pid}','capitals')"),
        ("Store.getVisitedArray('ben','travellist1')", f"Store.getVisitedArray('{pid}','travellist1')"),
        ("Store.getVisitedArray('ben','travellist2')", f"Store.getVisitedArray('{pid}','travellist2')"),
        ("Store.getVisitedArray('ben','unesco')", f"Store.getVisitedArray('{pid}','unesco')"),
        ("TripStore.getTrips('ben')", f"TripStore.getTrips('{pid}')"),
        ("TripStore.load('ben')", f"TripStore.load('{pid}')"),
        (".indexOf('ben') !== -1;", f".indexOf('{pid}') !== -1;"),
        (f"var pd=visited['ben']||{{}};", f"var pd=visited['{pid}']||{{}};"),
        (f"var ben = visited['ben'] || {{}};", f"var {pid} = visited['{pid}'] || {{}};"),
        ("ben.countries", f"{pid}.countries"),
        ("ben.capitals", f"{pid}.capitals"),
        ("ben.travellist1", f"{pid}.travellist1"),
        ("ben.travellist2", f"{pid}.travellist2"),
        ("ben.unesco", f"{pid}.unesco"),
        ("ben.animals", f"{pid}.animals"),
    ]

for p in PEOPLE:
    pid = p['id']
    out = ben
    for old, new in make_replacements(p):
        out = out.replace(old, new)
    # Verify clean
    remaining = [(i+1, l.strip()[:80]) for i,l in enumerate(out.split('\n'))
                 if "'ben'" in l and 'data-trav="ben"' not in l and 'rgba(79,142,247' not in l]
    if remaining:
        print(f"WARNING {pid}: {len(remaining)} unreplaced 'ben' refs")
        for ln, txt in remaining: print(f"  L{ln}: {txt}")
    # Commit
    url = f'https://api.github.com/repos/{REPO}/contents/pages/{pid}.html'
    sha = json.loads(urllib.request.urlopen(urllib.request.Request(url,
        headers={{"Authorization":f"token {{TOKEN}}"}})).read())['sha']
    payload = json.dumps({{"message": f"Sync {{p['name']}}'s page from ben.html",
        "content": base64.b64encode(out.encode()).decode(), "sha": sha}}).encode()
    result = json.loads(urllib.request.urlopen(urllib.request.Request(url,
        data=payload, method='PUT',
        headers={{"Authorization":f"token {{TOKEN}}", "Content-Type":"application/json"}})).read())
    print(f"{{p['name']}}: {{'OK' if 'commit' in result else 'FAILED'}}")
```

### Person-specific values (for reference)

| Person | ID | Initial | `--color-*` var | Hex | pStats bg |
|---|---|---|---|---|---|
| Ben | `ben` | B | `color-ben` | `#4f8ef7` | `rgba(79,142,247,.07)` |
| Shaz | `shaz` | S | `color-shaz` | `#9b59f5` | `rgba(155,89,245,.07)` |
| Paul | `paul` | P | `color-paul` | `#3ecf8e` | `rgba(62,207,142,.07)` |
| Ruth | `ruth` | R | `color-ruth` | `#e05c8e` | `rgba(224,92,142,.07)` |

### If a new pattern is added to ben.html

If you introduce a new hardcoded `'ben'` reference in `ben.html`, add it to the `make_replacements` list in the script above **and** update this section of CLAUDE.md.

---

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
  "trips": [ { "country", "continent", "locations", "start", "finish", "type", "utl1", "utl2", "travellers" }, ... ]
}
```

`trips` is a **single flat array** shared across all travellers. Each trip has a `travellers` field (array of IDs) indicating who was on it. Every PUT writes the full record (visited + trips together) to prevent clobbering.

**Legacy migration:** If `trips` is found as a per-traveller object (old format), `_normalise()` in `travel.js` automatically converts it to the flat array on load.

### 4.2 Local Cache (localStorage)

| Key               | Contents                          |
|-------------------|-----------------------------------|
| `utl_store_v2`    | Full `visited` object (all 4 travellers) |
| `utl_trips_v1`    | Full `trips` flat array (all travellers)  |

Cache is read immediately on page load for instant render; remote is fetched async and overwrites cache on success.

### 4.3 Static Data Schemas

**travellers.json** — baseline arrays are legacy; live state comes from JSONBin:
```json
{ "id": "ben", "name": "Ben", "emoji": "B", "color": "#4f8ef7", "home": "United Kingdom",
  "countries": ["AL","AR",...], "travellist2": ["petra",...], ... }
```

**countries.json:** `{ "id": "GB", "name": "United Kingdom", "capital": "London", "continent": "Europe" }`

**travellist1.json / travellist2.json:** `{ "id": "temples-of-angkor", "name": "Temples of Angkor", "country": "Cambodia", "region": "Asia" }`

**unesco.json:** `{ "id": "...", "name": "...", "country": "France, ..." }` — note: `country` field can be comma-separated multi-country.

**animals.json:** `{ "id": "...", "name": "..." }`

### 4.4 Trip Object Schema

```js
{
  country:     String,      // matched to countries.json name
  continent:   String,      // auto-filled from countries.json
  locations:   String,      // free text e.g. "Manila, Bohol, El Nido"
  start:       "YYYY-MM-DD",
  finish:      "YYYY-MM-DD", // optional
  type:        "Travel" | "Work" | "Friends" | "Family",
  utl1:        [String],    // array of travellist1 item IDs or names
  utl2:        [String],    // array of travellist2 item IDs or names
  countries:   [String],    // array of country names e.g. ["United Kingdom","France"] — matched to countries.json names
  continent:   String,      // auto-derived on save: majority continent, or 'Multi-continent' if split
  travellers:  [String]     // array of ALL traveller IDs on this trip e.g. ["ben","shaz","paul"]
                            // NOTE: includes the person who logged it — no separate owner field
}
```

The `travellers` field replaces the old `companions` field. Legacy records with `companions` are handled gracefully — code always checks `t.travellers || t.companions`.

The `countries` field replaces the old single `country` string. Legacy records are auto-migrated by `_normalise()` in `travel.js` (`country → countries:[country]`). Code always checks `t.countries || (t.country ? [t.country] : [])`.

---

## 5. Core JavaScript Library (`js/travel.js`)

All pages load `travel.js` and use `window.TravelApp`. The file is **pure ES5**.

### 5.1 Exports (`window.TravelApp`)

| Export | Type | Purpose |
|--------|------|---------|
| `Store` | Object | Visited item CRUD (toggle/isVisited/getVisitedArray/getVisitedCount/load/onSave) |
| `TripStore` | Object | Trip log CRUD (load/getTrips/getAllTrips/saveTrips/onSave) |
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
TripStore.load(travId)            // Fetches full remote record; returns Promise<filtered trips[]>
TripStore.getTrips(travId)        // Synchronous; returns trips where travellers includes travId
TripStore.getAllTrips()           // Synchronous; returns the full flat trips array (use for add/edit/delete)
TripStore.saveTrips(travId, trips) // Replaces the ENTIRE flat trips array + debounced PUT
TripStore.onSave(fn)              // Register callback(status, travId)
```

**Critical pattern for add/edit/delete on traveller pages:**
- Display: `TripStore.getTrips(TRAV_ID)` — filtered view for this traveller
- Mutate: `TripStore.getAllTrips()` → splice/push → `TripStore.saveTrips(TRAV_ID, updatedFullArray)`
- The `oi` index in row render uses `loadTrips()` (= `getAllTrips()`) so Edit/Delete buttons reference the correct index in the full array

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

The **Travel Log** uses `TripStore.load(TRAV_ID)` then:
- `TripStore.getTrips(TRAV_ID)` to get the filtered display list (trips this traveller appears on)
- `TripStore.getAllTrips()` as the base for add/edit/delete operations (full flat array)
- `TripStore.saveTrips(TRAV_ID, fullArray)` to persist changes

Any traveller tagged on a trip can edit or delete it — the change affects the single central record and disappears from all traveller pages simultaneously. The modal pre-populates `TRAV_ID` as a non-removable traveller tag; other travellers are added via multi-select combo. The `travellers` field stores all IDs including self.

The map IIFE reads `utl_trips_v1` from localStorage and filters the flat array by `travellers.indexOf(TRAV_ID)` to get visit dates for the tooltip.

The **Country Completion table** is Ben-specific (only in `ben.html`) and calculates a weighted completion % per country:
- Country visited: 35%
- Capital visited: 15%
- TL1 items: 25%
- TL2 items: 25%
- (Weights adjusted if a country has no TL1 or TL2 entries)

The **amCharts 5 world map** uses a `NAME_MAP` to resolve non-ISO country names from TL1/TL2 data to ISO2 codes. The map colours countries by completion % using a lerp between `#22263a` → `#2a5298` → `#3a78d4` → `#4f8ef7`. The hover tooltip shows: country name + capital, a separator, completion %, visited/capital checkmarks, TL1/TL2 fractions, UNESCO fraction, and — when trip log entries exist — a **Timeline section** listing all visit months (`MMM-YY` format, latest first, separated by ` | `). Trip data is read from `utl_trips_v1` localStorage (filtered by `trip.country === countryName`).

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
- Travel log form uses `tf-travellers-*` element IDs (`tf-travellers-input`, `tf-travellers-list`, `tf-travellers-tags`, `tf-travellers-combo`)
- Visited tick colours on tracker pages use `data-trav` CSS attribute selectors (`.cc-check.yes[data-trav="ben"]` etc.) — not a shared green

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
| 2026-05-07 | **Map legend colours** — gradient bar and swatches updated to use each traveller's colour palette. Ben=blue, Shaz=purple, Paul=green, Ruth=pink. |
| 2026-05-07 | **Summary stat cards** — coloured top border and tinted background added to `#pStats` cards on each traveller page matching their colour. Stat numbers coloured via `#pStats .stat-card .stat-number` with `!important`. |
| 2026-05-07 | **Home bucket per-traveller** — `_home` records now stamped with `travellers:[TRAV_ID]`. Save/lookup/render all filter by TRAV_ID so each traveller has independent UK UTL ticks. |
| 2026-05-07 | **Map IIFE fixes (shaz/paul/ruth)** — `TRAV_ID` replaced with hardcoded id in map IIFE (declared too late). Duplicate `var tc`/`var cm` declarations removed. `Store.load()` added to trigger remote fetch and re-render map. |
| 2026-05-07 | **Trip filter by TRAV_ID** — `render()` now filters `trips` by `travellers.indexOf(TRAV_ID)` so Paul/Ruth only see trips they were tagged on. |
| 2026-05-07 | **Multiple render fixes** — (1) CC table render() was building rowsHtml but never assigning to tbody.innerHTML. (2) Travel log render() referenced `hRec` before it was defined — caused silent ReferenceError stopping render. Fixed by defining `hRec` locally at top of render(). (3) `_fetchFullRecord` was not calling `_applyVisited()` so JSONBin data never updated in-memory state. (4) `loadAllData()` only read localStorage, never fetched JSONBin — added onRemote callback and direct JSONBin fetch. (5) CC table IIFE read localStorage directly — replaced with direct JSONBin fetch. |
| 2026-05-07 | **Nightly backup workflow** added at `.github/workflows/backup.yml`. Runs at 2am UTC daily (and on manual dispatch). Fetches full JSONBin record and commits it to `data/backup.json`. Requires `JSONBIN_KEY` repository secret. |
| 2026-05-07 | **Data restored** from `utl_jb_visited` localStorage cache after race condition in `saveTrips` wiped JSONBin visited data. Race condition fixed with `_visitedLoaded` guard flag in `travel.js`. |
| 2026-05-06 | **Home country** — `home` field added to all traveller profiles in `travellers.json` (currently `"United Kingdom"` for all four). Map tooltip shows "Home Country" indicator for the home country. No trip entry needed for home — UTL items ticked directly on tracker pages. `_homeCountry` variable populated in map IIFE from travellers data. |
| 2026-05-06 | **Multi-country trips** — `country` field replaced with `countries:[]` array. Modal uses multi-select combo (same pattern as travellers). Continent auto-derived on save (majority wins; "Multi-continent" if split). Map tooltip matches against `countries[]`. Timeline bar shows "Primary +N" if multiple. Search filters across all countries. Legacy `country` string auto-migrated by `_normalise()`. CSV format uses pipe-separated countries. |
| 2026-05-06 | **Unified trip architecture** — `trips` in JSONBin refactored from per-traveller object `{ben:[],shaz:[]}` to a single flat array. Each trip has a `travellers:[String]` field (all travellers including self). `TripStore.getAllTrips()` added. `saveTrips` now replaces the full array. Any traveller can edit/delete any trip they appear on. Legacy `companions` field handled gracefully. |
| 2026-05-06 | **Timeline tab rolled out to all traveller pages** — `shaz.html`, `paul.html`, `ruth.html` now match `ben.html` with Progress + Timeline tabs, world map, country completion table, visual timeline, travel log, and add/edit modal. Per-traveller colours applied throughout. |
| 2026-05-06 | **Visited ticks coloured by traveller** on all tracker pages (`ultimatetravellist1`, `ultimatetravellist2`, `countries`, `unesco`) using CSS `data-trav` attribute selectors. |
| 2026-05-06 | Capital column icon on `countries.html` changed from building emoji to 📍 pushpin (`&#128205;`). |
| 2026-05-06 | Travel Log summary line extended to show UTL I and UTL II visit counts (filter-aware, only shown if non-zero). |
| 2026-05-05 | `CLAUDE.md` created from full repo analysis. |
| 2026-05-05 | Map hover tooltip extended with Timeline section on all 4 traveller pages. |
| ~2026-04 | Timeline tab first added to `ben.html` (Visual Timeline + Travel Log + modal). |
| ~2026-04 | `TripStore` added to `travel.js`; JSONBin record extended to hold trips alongside visited. |
| ~2026-04 | Country Completion table and amCharts 5 world map added to `ben.html`. |
| ~2026-03 | `travellist2.json` and TL2 tracker page added. Analytics / Family Dashboard page added. |

---

## 11. How to Use This File

At the start of a future session, say:  
> *"Please reference CLAUDE.md in the repo to understand the site before making changes."*

After any session that modifies structure, data schemas, new pages, or significant logic, update the relevant sections of this file and commit it alongside the code changes.
