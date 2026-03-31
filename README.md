# Ultimate Travel List

A family travel tracking website built with pure HTML, CSS and JavaScript — no build tools, no backend, just static files on GitHub Pages.

## Structure

```
Ultimate-Travel-List/
css/styles.css          All styles (dark theme, responsive)
js/travel.js            Shared utilities: data loading, nav, renderers
data/travellers.json    Per-person progress (the key file to update)
data/countries.json     195 countries
data/animals.json       50 iconic wildlife species
data/unesco.json        40 UNESCO World Heritage Sites
data/county_peaks.json  40 English county highest points
data/travellist1.json   Custom travel list I
data/travellist2.json   Custom travel list II
pages/paul.html         Paul's progress page
pages/ruth.html         Ruth's progress page
pages/ben.html          Ben's progress page
pages/shaz.html         Shaz's progress page
pages/overview.html     Family comparison dashboard
pages/countries.html    Countries comparison table
pages/animals.html      Animals comparison table
pages/unesco.html       UNESCO sites comparison table
pages/peaks.html        County peaks comparison table
pages/ultimatetravellist1.html  Travel List I
pages/ultimatetravellist2.html  Travel List II
index.html              Homepage
404.html                Error page
```

## How to Update Travel Progress

Edit data/travellers.json and add item IDs to each person's arrays:

```json
{
  "id": "paul",
  "name": "Paul",
  "countries":    ["GB", "FR", "ES"],
  "animals":      ["african-lion", "giraffe"],
  "unesco":       ["taj-mahal"],
  "county_peaks": ["cumbria-peak"],
  "travellist1":  [],
  "travellist2":  []
}
```

IDs come from the master list files. Countries use ISO codes (e.g. "GB"), others use the id field from their respective JSON files.

## How to Add a New Traveller

1. Add entry to data/travellers.json with unique id, name, color and empty arrays
2. 2. Create pages/[name].html - copy an existing person page and change the PERSON constant
   3. 3. Add nav link in js/travel.js in the travellers array inside renderNav()
      4. 4. Add a card on index.html
        
         5. ## Tech Stack
        
         6. Pure HTML5 / CSS3 / Vanilla JavaScript, no framework, no build step, hosted free on GitHub Pages.
