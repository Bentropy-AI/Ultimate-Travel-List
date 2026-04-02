/* travel.js - Shared utilities for Ultimate Travel List
 *
 * SINGLE SOURCE OF TRUTH ARCHITECTURE
 * ------------------------------------
 * All visited-state is stored in one JSONBin record with this shape:
 *
 *   { "visited": {
 *       "ben":  { "countries":[], "capitals":[], "animals":[], "unesco":[], "travellist1":[], "travellist2":[] },
 *       "shaz": { ... },
 *       "paul": { ... },
 *       "ruth": { ... }
 *   }}
 *
 * TravelApp.Store is the central data module.  Every page (comparison
 * tables AND individual traveller pages) calls:
 *
 *   TravelApp.Store.load(onRemote)   -> Promise resolving all static data
 *   TravelApp.Store.toggle(id, cat, itemId)  -> flip one item, debounce-save
 *   TravelApp.Store.isVisited(id, cat, itemId) -> boolean
 *   TravelApp.Store.getVisitedArray(id, cat)   -> string[]
 *   TravelApp.Store.onSave(fn)      -> register callback for save status
 *
 * To add a new list category (e.g. "peaks"):
 *   1. Add data/peaks.json
 *   2. Add "peaks":[] to _ALL_CATS below
 *   3. Fetch the file in Store.load() and return it in the resolved object
 *   4. Build your page using Store.toggle / Store.isVisited
 *   No changes needed to any other file.
 *
 * Pure ES5 - no template literals, no destructuring.
 */

/* ============================================================
   SECTION 1 - CONFIGURATION
   ============================================================ */

var _BIN_ID  = '69cd4cbd36566621a86d74ab';
var _API_KEY = '$2a$10$ZBPwhHYl3Fa7.3xScA8xVe4Nq7UfBqDgk/kFuk7E7dDktRt8yapM.';
var _BIN_URL = 'https://api.jsonbin.io/v3/b/' + _BIN_ID;
var _CACHE_KEY = 'utl_store_v2';

/* All recognised category keys. Add new ones here as the site grows. */
var _ALL_CATS = ['countries', 'capitals', 'animals', 'unesco', 'travellist1', 'travellist2'];

/* ============================================================
   SECTION 2 - ROOT / FETCH HELPERS
   ============================================================ */

function getRoot() {
  var path = window.location.pathname;
  return (path.indexOf('/pages/') !== -1) ? '../' : './';
}

function fetchJSON(file) {
  var root = getRoot();
  return fetch(root + 'data/' + file).then(function(res) {
    if (!res.ok) throw new Error('Failed to load ' + file + ': ' + res.status);
    return res.json();
  });
}

/* ============================================================
   SECTION 3 - CENTRAL STORE
   ============================================================ */

var Store = (function() {

  var _state = {};
  var _saveCallbacks = [];
  var _saveTimer = null;
  var _travellers = [];

  function _cacheLoad() {
    try {
      var raw = localStorage.getItem(_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function _cacheSave(visited) {
    try { localStorage.setItem(_CACHE_KEY, JSON.stringify(visited)); } catch(e) {}
  }

  function _arrayToSet(arr) {
    var s = {};
    if (!arr) return s;
    for (var i = 0; i < arr.length; i++) s[arr[i]] = true;
    return s;
  }

  function _applyVisited(visited) {
    for (var ti = 0; ti < _travellers.length; ti++) {
      var id = _travellers[ti].id;
      if (!_state[id]) _state[id] = {};
      var src = visited[id] || {};
      for (var ci = 0; ci < _ALL_CATS.length; ci++) {
        var cat = _ALL_CATS[ci];
        _state[id][cat] = _arrayToSet(src[cat] || []);
      }
    }
  }

  function _seedFromBaseline(travellers) {
    for (var ti = 0; ti < travellers.length; ti++) {
      var t = travellers[ti];
      if (!_state[t.id]) _state[t.id] = {};
      for (var ci = 0; ci < _ALL_CATS.length; ci++) {
        var cat = _ALL_CATS[ci];
        if (!_state[t.id][cat]) {
          _state[t.id][cat] = _arrayToSet(t[cat] || []);
        }
      }
    }
  }

  function _buildVisited() {
    var v = {};
    for (var ti = 0; ti < _travellers.length; ti++) {
      var id = _travellers[ti].id;
      v[id] = {};
      for (var ci = 0; ci < _ALL_CATS.length; ci++) {
        var cat = _ALL_CATS[ci];
        v[id][cat] = Object.keys(_state[id] && _state[id][cat] ? _state[id][cat] : {});
      }
    }
    return v;
  }

  function _fetchRemote() {
    return fetch(_BIN_URL + '/latest', {
      headers: { 'X-Master-Key': _API_KEY }
    }).then(function(r) {
      if (!r.ok) throw new Error('JSONBin GET failed: ' + r.status);
      return r.json();
    }).then(function(d) {
      return (d.record && d.record.visited) ? d.record.visited : null;
    });
  }

  function _pushRemote(visited) {
    return fetch(_BIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': _API_KEY
      },
      body: JSON.stringify({ visited: visited })
    }).then(function(r) {
      if (!r.ok) throw new Error('JSONBin PUT failed: ' + r.status);
      return r.json();
    });
  }

  function _notify(status, msg) {
    for (var i = 0; i < _saveCallbacks.length; i++) {
      try { _saveCallbacks[i](status, msg); } catch(e) {}
    }
  }

  function _persist() {
    var visited = _buildVisited();
    _cacheSave(visited);
    _pushRemote(visited)
      .then(function() { _notify('ok', 'Saved ✓'); })
      .catch(function() { _notify('err', 'Save failed ✕ - check connection'); });
  }

  function load(onRemote) {
    return Promise.all([
      fetchJSON('travellers.json'),
      fetchJSON('countries.json'),
      fetchJSON('animals.json'),
      fetchJSON('unesco.json'),
      fetchJSON('travellist1.json'),
      fetchJSON('travellist2.json').catch(function() { return []; })
    ]).then(function(results) {
      _travellers = results[0];
      var countries = results[1];
      var animals   = results[2];
      var unesco    = results[3];
      var tl1       = results[4];
      var tl2       = results[5];

      for (var ti = 0; ti < _travellers.length; ti++) {
        _state[_travellers[ti].id] = {};
        for (var ci = 0; ci < _ALL_CATS.length; ci++) {
          _state[_travellers[ti].id][_ALL_CATS[ci]] = {};
        }
      }

      _seedFromBaseline(_travellers);

      var cached = _cacheLoad();
      if (cached) _applyVisited(cached);

      _fetchRemote().then(function(remote) {
        if (remote) {
          _applyVisited(remote);
          _cacheSave(_buildVisited());
        }
        if (typeof onRemote === 'function') onRemote();
      }).catch(function() {
        if (typeof onRemote === 'function') onRemote();
      });

      return {
        travellers: _travellers,
        countries:  countries,
        animals:    animals,
        unesco:     unesco,
        tl1:        tl1,
        tl2:        tl2
      };
    });
  }

  function toggle(travId, category, itemId) {
    if (!_state[travId]) _state[travId] = {};
    if (!_state[travId][category]) _state[travId][category] = {};
    if (_state[travId][category][itemId]) {
      delete _state[travId][category][itemId];
    } else {
      _state[travId][category][itemId] = true;
    }
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_persist, 600);
  }

  function isVisited(travId, category, itemId) {
    return !!(_state[travId] && _state[travId][category] && _state[travId][category][itemId]);
  }

  function getVisitedArray(travId, category) {
    if (!_state[travId] || !_state[travId][category]) return [];
    return Object.keys(_state[travId][category]);
  }

  function getVisitedCount(travId, category) {
    return getVisitedArray(travId, category).length;
  }

  function onSave(fn) {
    _saveCallbacks.push(fn);
  }

  return {
    load:             load,
    toggle:           toggle,
    isVisited:        isVisited,
    getVisitedArray:  getVisitedArray,
    getVisitedCount:  getVisitedCount,
    onSave:           onSave
  };

}());

/* ============================================================
   SECTION 4 - PROGRESS HELPERS
   ============================================================ */

function countVisited(traveller, category) {
  var visited = traveller[category] || [];
  return visited.length;
}

function pct(visited, total) {
  if (!total) return 0;
  return Math.round((visited / total) * 100);
}

/* ============================================================
   SECTION 5 - DOM BUILDERS
   ============================================================ */

function buildProgressBar(value, total, cls) {
  cls = cls || '';
  var p = pct(value, total);
  return '<div class="progress-wrap">' +
    '<div class="progress-label">' +
      '<span>' + value + ' / ' + total + '</span>' +
      '<span>' + p + '%</span>' +
    '</div>' +
    '<div class="progress-bar">' +
      '<div class="progress-fill ' + cls + '" style="width:' + p + '%"></div>' +
    '</div>' +
  '</div>';
}

function buildStatCard(number, label) {
  return '<div class="stat-card">' +
    '<span class="stat-number">' + number + '</span>' +
    '<span class="stat-label">' + label + '</span>' +
  '</div>';
}

/* ============================================================
   SECTION 6 - NAV
   ============================================================ */

function renderNav(activeKey) {
  var root = getRoot();
  var travellers = [
    { key: 'ben',  label: 'Ben',  href: root + 'pages/ben.html',  color: '#4f8ef7' },
    { key: 'shaz', label: 'Shaz', href: root + 'pages/shaz.html', color: '#9b59f5' },
    { key: 'paul', label: 'Paul', href: root + 'pages/paul.html', color: '#3ecf8e' },
    { key: 'ruth', label: 'Ruth', href: root + 'pages/ruth.html', color: '#e05c8e' }
  ];
  var lists = [
    { key: 'list1',     label: 'Travel List I',        href: root + 'pages/ultimatetravellist1.html' },
    { key: 'list2',     label: 'Travel List II',       href: root + 'pages/ultimatetravellist2.html' },
    { key: 'countries', label: 'Countries & Capitals', href: root + 'pages/countries.html' },
    { key: 'unesco',    label: 'UNESCO',               href: root + 'pages/unesco.html' },
    { key: 'animals',   label: 'Animals',              href: root + 'pages/animals.html' }
  ];
  var analytics = [
    { key: 'analytics', label: 'Family Dashboard', href: root + 'pages/analytics.html' }
  ];
  var travHtml = '';
  for (var i = 0; i < travellers.length; i++) {
    var t = travellers[i];
    var aCls = (t.key === activeKey) ? ' class="active"' : '';
    travHtml += '<li><a href="' + t.href + '"' + aCls + '><span class="nav-dot" style="background:' + t.color + '"></span>' + t.label + '</a></li>';
  }
  var listsHtml = '';
  for (var j = 0; j < lists.length; j++) {
    var l = lists[j];
    var lCls = (l.key === activeKey) ? ' class="active"' : '';
    listsHtml += '<li><a href="' + l.href + '"' + lCls + '>' + l.label + '</a></li>';
  }
  var analyticsHtml = '';
  for (var k = 0; k < analytics.length; k++) {
    var a = analytics[k];
    var aCl = (a.key === activeKey) ? ' class="active"' : '';
    analyticsHtml += '<li><a href="' + a.href + '"' + aCl + '>' + a.label + '</a></li>';
  }
  var html =
    '<a class="nav-brand" href="' + root + '">&#9992; Travel Tracker</a>' +
    '<ul class="nav-menu">' +
      '<li class="nav-dropdown"><span class="nav-dropdown-label">Travel Lists <span class="caret">&#9660;</span></span><ul class="nav-submenu">' + listsHtml + '</ul></li>' +
      '<li class="nav-dropdown"><span class="nav-dropdown-label">Travellers <span class="caret">&#9660;</span></span><ul class="nav-submenu">' + travHtml + '</ul></li>' +
      '<li class="nav-dropdown"><span class="nav-dropdown-label">Analytics <span class="caret">&#9660;</span></span><ul class="nav-submenu">' + analyticsHtml + '</ul></li>' +
    '</ul>';
  var inner = document.querySelector('.site-nav .nav-inner');
  if (inner) inner.innerHTML = html;
}

/* ============================================================
   SECTION 7 - LIST RENDERERS
   ============================================================ */

function renderChecklist(opts) {
  var container    = opts.container;
  var masterList   = opts.masterList;
  var travId       = opts.travId || null;
  var category     = opts.category || null;
  var visitedIds   = opts.visitedIds || [];
  var labelFn      = opts.labelFn;
  var filterGroups = opts.filterGroups || null;
  var groupFn      = opts.groupFn || null;
  var travClass    = opts.travClass || '';
  var onToggle     = opts.onToggle || null;

  function _getSet() {
    var s = {};
    if (travId && category) {
      var arr = Store.getVisitedArray(travId, category);
      for (var i = 0; i < arr.length; i++) s[arr[i]] = true;
    } else {
      for (var j = 0; j < visitedIds.length; j++) s[visitedIds[j]] = true;
    }
    return s;
  }

  var currentFilter = 'all';
  var searchTerm = '';

  function getFiltered() {
    var visitedSet = _getSet();
    var result = [];
    for (var i = 0; i < masterList.length; i++) {
      var item = masterList[i];
      var matchSearch = !searchTerm || labelFn(item).toLowerCase().indexOf(searchTerm) !== -1;
      var matchGroup = true;
      if (currentFilter === 'visited')        matchGroup = !!visitedSet[item.id];
      else if (currentFilter === 'unvisited') matchGroup = !visitedSet[item.id];
      else if (currentFilter !== 'all' && groupFn) matchGroup = groupFn(item) === currentFilter;
      if (matchSearch && matchGroup) result.push(item);
    }
    return result;
  }

  function renderList() {
    var visitedSet = _getSet();
    var items = getFiltered();
    var totalVisited = 0;
    for (var k = 0; k < masterList.length; k++) {
      if (visitedSet[masterList[k].id]) totalVisited++;
    }
    var fbtns =
      '<button class="filter-btn' + (currentFilter==='all'?' active':'') + '" data-filter="all">All</button>' +
      '<button class="filter-btn' + (currentFilter==='visited'?' active':'') + '" data-filter="visited">Visited</button>' +
      '<button class="filter-btn' + (currentFilter==='unvisited'?' active':'') + '" data-filter="unvisited">Not Yet</button>';
    if (filterGroups) {
      for (var fg = 0; fg < filterGroups.length; fg++) {
        var g = filterGroups[fg];
        fbtns += '<button class="filter-btn' + (currentFilter===g.key?' active':'') + '" data-filter="' + g.key + '">' + g.label + '</button>';
      }
    }
    var rows = '';
    for (var r = 0; r < items.length; r++) {
      var it = items[r];
      var isV = !!visitedSet[it.id];
      var clickable = (travId && category && onToggle) ? ' data-item-id="' + it.id + '" style="cursor:pointer"' : '';
      rows += '<li' + clickable + '>' +
        '<span class="check' + (isV?' visited':'') + '">' + (isV?'&#10003;':'') + '</span>' +
        '<span class="item-name">' + labelFn(it) + '</span>' +
        (groupFn ? '<span class="badge badge-info">' + groupFn(it) + '</span>' : '') +
        '</li>';
    }
    if (!rows) rows = '<li style="padding:1rem;color:var(--color-muted)">No items match.</li>';
    container.innerHTML =
      '<div class="filter-bar">' +
        '<input class="search-input" type="search" placeholder="Search..." value="' + searchTerm + '">' +
        fbtns +
      '</div>' +
      buildProgressBar(totalVisited, masterList.length, travClass) +
      '<ul class="item-list" style="margin-top:1rem">' + rows + '</ul>';
    container.querySelector('.search-input').addEventListener('input', function(e) {
      searchTerm = e.target.value.toLowerCase();
      renderList();
    });
    var btns = container.querySelectorAll('.filter-btn[data-filter]');
    for (var b = 0; b < btns.length; b++) {
      btns[b].addEventListener('click', function() {
        currentFilter = this.getAttribute('data-filter');
        renderList();
      });
    }
    if (travId && category && onToggle) {
      var lis = container.querySelectorAll('li[data-item-id]');
      for (var li = 0; li < lis.length; li++) {
        lis[li].addEventListener('click', function() {
          var iid = this.getAttribute('data-item-id');
          if (iid) { Store.toggle(travId, category, iid); onToggle(iid); renderList(); }
        });
      }
    }
  }
  renderList();
}

function renderComparisonTable(opts) {
  var container  = opts.container;
  var masterList = opts.masterList;
  var travellers = opts.travellers;
  var category   = opts.category;
  var labelFn    = opts.labelFn;
  var groupFn    = opts.groupFn || null;
  var onToggle   = opts.onToggle || null;

  var searchTerm = '';
  var currentFilter = 'all';

  function getFiltered() {
    var result = [];
    for (var i = 0; i < masterList.length; i++) {
      var item = masterList[i];
      var ms = !searchTerm || labelFn(item).toLowerCase().indexOf(searchTerm) !== -1;
      var mg = currentFilter === 'all' || (groupFn && groupFn(item) === currentFilter);
      if (ms && mg) result.push(item);
    }
    return result;
  }

  function render() {
    var items = getFiltered();
    var groupSet = {};
    if (groupFn) {
      for (var gi = 0; gi < masterList.length; gi++) groupSet[groupFn(masterList[gi])] = true;
    }
    var groups = Object.keys(groupSet).sort();
    var gBtns = '';
    for (var gbi = 0; gbi < groups.length; gbi++) {
      var grp = groups[gbi];
      gBtns += '<button class="filter-btn' + (currentFilter===grp?' active':'') + '" data-filter="' + grp + '">' + grp + '</button>';
    }
    var thCols = '';
    for (var thi = 0; thi < travellers.length; thi++) {
      thCols += '<th style="color:' + travellers[thi].color + '">' + travellers[thi].name + '</th>';
    }
    var rows = '';
    for (var ri = 0; ri < items.length; ri++) {
      var item = items[ri];
      var tdCols = '';
      for (var tdi = 0; tdi < travellers.length; tdi++) {
        var tv = travellers[tdi];
        var vis = Store.isVisited(tv.id, category, item.id);
        var clickAttr = onToggle ? ' data-trav="' + tv.id + '" data-iid="' + item.id + '" style="cursor:pointer"' : '';
        tdCols += '<td><span class="dot ' + (vis?'visited':'not-visited') + '"' + clickAttr + '></span></td>';
      }
      rows += '<tr><td>' + labelFn(item) + '</td>' +
        (groupFn ? '<td><span class="badge badge-info">' + groupFn(item) + '</span></td>' : '') +
        tdCols + '</tr>';
    }
    if (!rows) rows = '<tr><td colspan="' + (2+travellers.length) + '" style="text-align:center;color:var(--color-muted);padding:2rem">No items match.</td></tr>';
    container.innerHTML =
      '<div class="filter-bar">' +
        '<input class="search-input" type="search" placeholder="Search..." value="' + searchTerm + '">' +
        '<button class="filter-btn' + (currentFilter==='all'?' active':'') + '" data-filter="all">All</button>' +
        gBtns +
      '</div>' +
      '<div style="overflow-x:auto"><table class="comparison-table">' +
        '<thead><tr><th>' + category.charAt(0).toUpperCase() + category.slice(1) + '</th>' +
        (groupFn?'<th>Group</th>':'') + thCols + '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
    container.querySelector('.search-input').addEventListener('input', function(e) {
      searchTerm = e.target.value.toLowerCase();
      render();
    });
    var btns = container.querySelectorAll('.filter-btn[data-filter]');
    for (var bi = 0; bi < btns.length; bi++) {
      btns[bi].addEventListener('click', function() {
        currentFilter = this.getAttribute('data-filter');
        render();
      });
    }
    if (onToggle) {
      var dots = container.querySelectorAll('.dot[data-trav]');
      for (var di = 0; di < dots.length; di++) {
        dots[di].addEventListener('click', function() {
          var tid = this.getAttribute('data-trav');
          var iid = this.getAttribute('data-iid');
          if (tid && iid) { Store.toggle(tid, category, iid); onToggle(tid, iid); render(); }
        });
      }
    }
  }
  render();
}

/* ============================================================
   SECTION 8 - LEGACY loadAllData
   Kept for personal pages (ben.html etc) that render read-only
   checklists. Now merges from the Store cache so they reflect
   the shared state automatically on page load.
   ============================================================ */

function loadAllData() {
  return Promise.all([
    fetchJSON('travellers.json'),
    fetchJSON('countries.json'),
    fetchJSON('animals.json'),
    fetchJSON('unesco.json'),
    fetchJSON('travellist1.json'),
    fetchJSON('travellist2.json').catch(function() { return []; })
  ]).then(function(results) {
    var travellers = results[0];
    try {
      var raw = localStorage.getItem(_CACHE_KEY);
      if (raw) {
        var local = JSON.parse(raw);
        for (var j = 0; j < travellers.length; j++) {
          var t = travellers[j];
          var l = local[t.id];
          if (l && typeof l === 'object') {
            if (l.countries)   t.countries   = l.countries;
            if (l.capitals)    t.capitals    = l.capitals;
            if (l.animals)     t.animals     = l.animals;
            if (l.unesco)      t.unesco      = l.unesco;
            if (l.travellist1) t.travellist1 = l.travellist1;
            if (l.travellist2) t.travellist2 = l.travellist2;
          }
        }
      }
    } catch(e) {}
    return {
      travellers: travellers,
      countries:  results[1],
      animals:    results[2],
      unesco:     results[3],
      tl1:        results[4],
      tl2:        results[5]
    };
  });
}

/* ============================================================
   SECTION 9 - EXPORTS
   ============================================================ */

window.TravelApp = {
  Store:                 Store,
  fetchJSON:             fetchJSON,
  getRoot:               getRoot,
  loadAllData:           loadAllData,
  countVisited:          countVisited,
  pct:                   pct,
  buildProgressBar:      buildProgressBar,
  buildStatCard:         buildStatCard,
  renderNav:             renderNav,
  renderChecklist:       renderChecklist,
  renderComparisonTable: renderComparisonTable
};
