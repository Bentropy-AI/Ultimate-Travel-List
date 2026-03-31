/**
 * travel.js — Shared utilities for Ultimate Travel List
 * All pages include this file to share data-loading and rendering logic.
 */

/* ─────────────────────────────────────────────
   DATA LOADING
───────────────────────────────────────────── */

/**
 * Resolve the correct path prefix depending on whether we are
 * in the root (index.html) or inside /pages/*.html
 */
function getRoot() {
    const path = window.location.pathname;
    // If path contains /pages/ we need to go up one level
  return path.includes('/pages/') ? '../' : './';
}

async function fetchJSON(file) {
    const root = getRoot();
    const res = await fetch(`${root}data/${file}`);
    if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
    return res.json();
}

async function loadAllData() {
    const [travellers, countries, animals, unesco, peaks, tl1, tl2] = await Promise.all([
          fetchJSON('travellers.json'),
          fetchJSON('countries.json'),
          fetchJSON('animals.json'),
          fetchJSON('unesco.json'),
          fetchJSON('county_peaks.json'),
          fetchJSON('travellist1.json'),
          fetchJSON('travellist2.json').catch(() => [])
        ]);
    return { travellers, countries, animals, unesco, peaks, tl1, tl2 };
}

/* ─────────────────────────────────────────────
   PROGRESS HELPERS
───────────────────────────────────────────── */

/** Return count of items a traveller has visited from a master list */
function countVisited(traveller, category, masterList) {
    const visited = traveller[category] || [];
    return visited.length;
}

/** Return percentage 0-100 */
function pct(visited, total) {
    if (!total) return 0;
    return Math.round((visited / total) * 100);
}

/* ─────────────────────────────────────────────
   DOM BUILDERS
───────────────────────────────────────────── */

/**
 * Build a progress bar element.
 * @param {number} value  - visited count
 * @param {number} total  - total count
 * @param {string} cls    - CSS class for colour (paul|ruth|ben|shaz|success)
 */
function buildProgressBar(value, total, cls = '') {
    const p = pct(value, total);
    return `
        <div class="progress-wrap">
              <div class="progress-label">
                      <span>${value} / ${total}</span>
                              <span>${p}%</span>
                                    </div>
                                          <div class="progress-bar">
                                                  <div class="progress-fill ${cls}" style="width:${p}%"></div>
                                                        </div>
                                                            </div>`;
}

/**
 * Build a stat card.
 */
function buildStatCard(number, label) {
    return `
        <div class="stat-card">
              <span class="stat-number">${number}</span>
                    <span class="stat-label">${label}</span>
                        </div>`;
}

/**
 * Render the shared site navigation.
 * Pass the active page key so the correct link gets the .active class.
 * Keys: home | paul | ruth | ben | shaz | overview | countries | animals | unesco | peaks | list1 | list2
 */
function renderNav(activeKey) {
    const root = getRoot();

  const travellers = [
    { key: 'paul',  label: 'Paul',  href: `${root}pages/paul.html`  },
    { key: 'ruth',  label: 'Ruth',  href: `${root}pages/ruth.html`  },
    { key: 'ben',   label: 'Ben',   href: `${root}pages/ben.html`   },
    { key: 'shaz',  label: 'Shaz',  href: `${root}pages/shaz.html`  },
      ];

  const lists = [
    { key: 'overview',  label: 'Overview',     href: `${root}pages/overview.html`  },
    { key: 'countries', label: 'Countries',    href: `${root}pages/countries.html` },
    { key: 'animals',   label: 'Animals',      href: `${root}pages/animals.html`   },
    { key: 'unesco',    label: 'UNESCO',        href: `${root}pages/unesco.html`    },
    { key: 'peaks',     label: 'County Peaks', href: `${root}pages/peaks.html`     },
    { key: 'list1',     label: 'Travel List I', href: `${root}pages/ultimatetravellist1.html` },
    { key: 'list2',     label: 'Travel List II',href: `${root}pages/ultimatetravellist2.html` },
      ];

  const navLink = ({ key, label, href }) =>
        `<li><a href="${href}" class="${key === activeKey ? 'active' : ''}">${label}</a></li>`;

  document.querySelector('.site-nav .nav-inner').innerHTML = `
      <a class="nav-brand" href="${root}index.html">✈ Travel Tracker</a>
          <ul class="nav-links">
                ${travellers.map(navLink).join('')}
                      <li style="width:1px;background:var(--color-border);margin:4px 4px;"></li>
                            ${lists.map(navLink).join('')}
                                </ul>`;
}

/* ─────────────────────────────────────────────
   LIST RENDERERS
───────────────────────────────────────────── */

/**
 * Render a searchable/filterable checklist for a single traveller.
 * container    - DOM element to render into
 * masterList   - array of items from master JSON
 * visitedIds   - array of ids the traveller has visited
 * labelFn      - function(item) => display string
 * filterGroups - optional array of { label, key } for group filter buttons
 * groupFn      - function(item) => group key string
 */
function renderChecklist({ container, masterList, visitedIds, labelFn, filterGroups, groupFn, travClass }) {
    const visitedSet = new Set(visitedIds);

  let currentFilter = 'all';
    let searchTerm = '';

  function filtered() {
        return masterList.filter(item => {
                const matchGroup = currentFilter === 'all' || (groupFn && groupFn(item) === currentFilter);
                const matchSearch = !searchTerm || labelFn(item).toLowerCase().includes(searchTerm);
                return matchGroup && matchSearch;
        });
  }

  function render() {
        const items = filtered();
        const visitedCount = items.filter(i => visitedSet.has(i.id)).length;

      container.innerHTML = `
            <div class="filter-bar">
                    <input class="search-input" type="search" placeholder="Search…" value="${searchTerm}">
                            <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                                    <button class="filter-btn ${currentFilter === 'visited' ? 'active' : ''}" data-filter="visited">Visited</button>
                                            <button class="filter-btn ${currentFilter === 'unvisited' ? 'active' : ''}" data-filter="unvisited">Not Yet</button>
                                                    ${filterGroups ? filterGroups.map(g =>
                                                                `<button class="filter-btn ${currentFilter === g.key ? 'active' : ''}" data-filter="${g.key}">${g.label}</button>`
                                                                                              ).join('') : ''}
                                                                                                    </div>
                                                                                                          ${buildProgressBar(visitedCount, items.length, travClass)}
                                                                                                                <ul class="item-list" style="margin-top:1rem">
                                                                                                                        ${items.map(item => {
                                                                                                                                    const v = visitedSet.has(item.id);
                                                                                                                                    return `<li>
                                                                                                                                                <span class="check ${v ? 'visited' : ''}">${v ? '✓' : ''}</span>
                                                                                                                                                            <span class="item-name">${labelFn(item)}</span>
                                                                                                                                                                        ${groupFn ? `<span class="badge badge-info">${groupFn(item)}</span>` : ''}
                                                                                                                                                                                  </li>`;
                                                                                                                          }).join('')}
                                                                                                                                  ${items.length === 0 ? '<li class="empty-msg">No items match your search.</li>' : ''}
                                                                                                                                        </ul>`;

      // Bind events
      container.querySelector('.search-input').addEventListener('input', e => {
              searchTerm = e.target.value.toLowerCase();
              render();
      });

      container.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
              btn.addEventListener('click', () => {
                        const f = btn.dataset.filter;
                        if (f === 'visited')   { currentFilter = 'visited';   masterList = masterList; }
                        else if (f === 'unvisited') { currentFilter = 'unvisited'; }
                        else { currentFilter = f; }

                                           // Override filtered() for visited/unvisited
                                           if (f === 'visited' || f === 'unvisited') {
                                                       const want = f === 'visited';
                                                       // Temporarily wrap
                                           }
                        currentFilter = f;
                        render();
              });
      });
  }

  // Override filter for visited/unvisited
  const origFiltered = filtered;
    function filtered2() {
          if (currentFilter === 'visited')   return masterList.filter(i => visitedSet.has(i.id) && (!searchTerm || labelFn(i).toLowerCase().includes(searchTerm)));
          if (currentFilter === 'unvisited') return masterList.filter(i => !visitedSet.has(i.id) && (!searchTerm || labelFn(i).toLowerCase().includes(searchTerm)));
          return masterList.filter(item => {
                  const matchGroup = currentFilter === 'all' || (groupFn && groupFn(item) === currentFilter);
                  const matchSearch = !searchTerm || labelFn(item).toLowerCase().includes(searchTerm);
                  return matchGroup && matchSearch;
          });
    }

  // Replace render() to use filtered2
  container.renderList = function() {
        const items = filtered2();
        const visitedCount = items.filter(i => visitedSet.has(i.id)).length;
        const totalCount = filtered2 === filtered ? masterList.length : items.length;

        container.innerHTML = `
              <div class="filter-bar">
                      <input class="search-input" type="search" placeholder="Search…" value="${searchTerm}">
                              <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                                      <button class="filter-btn ${currentFilter === 'visited' ? 'active' : ''}" data-filter="visited">Visited</button>
                                              <button class="filter-btn ${currentFilter === 'unvisited' ? 'active' : ''}" data-filter="unvisited">Not Yet</button>
                                                      ${filterGroups ? filterGroups.map(g =>
                                                                  `<button class="filter-btn ${currentFilter === g.key ? 'active' : ''}" data-filter="${g.key}">${g.label}</button>`
                                                                                                ).join('') : ''}
                                                                                                      </div>
                                                                                                            ${buildProgressBar(masterList.filter(i => visitedSet.has(i.id)).length, masterList.length, travClass)}
                                                                                                                  <ul class="item-list" style="margin-top:1rem">
                                                                                                                          ${items.map(item => {
                                                                                                                                      const v = visitedSet.has(item.id);
                                                                                                                                      return `<li>
                                                                                                                                                  <span class="check ${v ? 'visited' : ''}">${v ? '✓' : ''}</span>
                                                                                                                                                              <span class="item-name">${labelFn(item)}</span>
                                                                                                                                                                          ${groupFn ? `<span class="badge badge-info">${groupFn(item)}</span>` : ''}
                                                                                                                                                                                    </li>`;
                                                                                                                            }).join('')}
                                                                                                                                    ${items.length === 0 ? '<li style="padding:1rem;color:var(--color-muted)">No items match your search.</li>' : ''}
                                                                                                                                          </ul>`;

        container.querySelector('.search-input').addEventListener('input', e => {
                searchTerm = e.target.value.toLowerCase();
                container.renderList();
        });
        container.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
                btn.addEventListener('click', () => {
                          currentFilter = btn.dataset.filter;
                          container.renderList();
                });
        });
  };

  container.renderList();
}

/**
 * Render a multi-traveller comparison table.
 * masterList  - array of items
 * travellers  - array of traveller objects with .id and .name
 * category    - key in traveller object (e.g. 'countries')
 * labelFn     - function(item) => string
 * groupFn     - optional function(item) => group string
 */
function renderComparisonTable({ container, masterList, travellers, category, labelFn, groupFn }) {
    let searchTerm = '';
    let currentFilter = 'all';

  const sets = {};
    travellers.forEach(t => { sets[t.id] = new Set(t[category] || []); });

  function filtered() {
        return masterList.filter(item => {
                const matchSearch = !searchTerm || labelFn(item).toLowerCase().includes(searchTerm);
                const matchGroup  = currentFilter === 'all' || (groupFn && groupFn(item) === currentFilter);
                return matchSearch && matchGroup;
        });
  }

  function render() {
        const items = filtered();
        const groups = groupFn ? [...new Set(masterList.map(groupFn))].sort() : [];

      container.innerHTML = `
            <div class="filter-bar">
                    <input class="search-input" type="search" placeholder="Search…" value="${searchTerm}">
                            <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                                    ${groups.map(g =>
                                                `<button class="filter-btn ${currentFilter === g ? 'active' : ''}" data-filter="${g}">${g}</button>`
                                                         ).join('')}
                                                               </div>
                                                                     <div style="overflow-x:auto">
                                                                             <table class="comparison-table">
                                                                                       <thead>
                                                                                                   <tr>
                                                                                                                 <th>${category.charAt(0).toUpperCase() + category.slice(1)}</th>
                                                                                                                               ${groupFn ? '<th>Group</th>' : ''}
                                                                                                                                             ${travellers.map(t => `<th style="color:${t.color}">${t.name}</th>`).join('')}
                                                                                                                                                         </tr>
                                                                                                                                                                   </thead>
                                                                                                                                                                             <tbody>
                                                                                                                                                                                         ${items.map(item => `
                                                                                                                                                                                                       <tr>
                                                                                                                                                                                                                       <td>${labelFn(item)}</td>
                                                                                                                                                                                                                                       ${groupFn ? `<td><span class="badge badge-info">${groupFn(item)}</span></td>` : ''}
                                                                                                                                                                                                                                                       ${travellers.map(t =>
                                                                                                                                                                                                                                                                           `<td><span class="dot ${sets[t.id].has(item.id) ? 'visited' : 'not-visited'}" title="${sets[t.id].has(item.id) ? 'Visited' : 'Not visited'}"></span></td>`
                                                                                                                                                                                                                                                                                        ).join('')}
                                                                                                                                                                                                                                                                                                      </tr>`).join('')}
                                                                                                                                                                                                                                                                                                                  ${items.length === 0 ? `<tr><td colspan="${3 + travellers.length}" style="text-align:center;color:var(--color-muted);padding:2rem">No items match.</td></tr>` : ''}
                                                                                                                                                                                                                                                                                                                            </tbody>
                                                                                                                                                                                                                                                                                                                                    </table>
                                                                                                                                                                                                                                                                                                                                          </div>`;

      container.querySelector('.search-input').addEventListener('input', e => {
              searchTerm = e.target.value.toLowerCase();
              render();
      });
        container.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
                btn.addEventListener('click', () => { currentFilter = btn.dataset.filter; render(); });
        });
  }

  render();
}

/* ─────────────────────────────────────────────
   EXPORTS (used via global window object since no bundler)
───────────────────────────────────────────── */
window.TravelApp = {
    loadAllData,
    fetchJSON,
    getRoot,
    countVisited,
    pct,
    buildProgressBar,
    buildStatCard,
    renderNav,
    renderChecklist,
    renderComparisonTable,
};
