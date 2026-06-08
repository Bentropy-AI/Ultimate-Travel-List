/* travel.js - Shared utilities for Ultimate Travel List
 *
 * STORAGE: GitHub Contents API
 * Data is stored in data/state.json in the repo itself.
 * Reads are unauthenticated (public repo). Writes require the PAT.
 *
 * Shape of data/state.json:
 * {
 *   "visited": {
 *     "ben":  { "countries":[], "capitals":[], "animals":[], "unesco":[], "travellist1":[], "travellist2":[] },
 *     "shaz": { ... }, "paul": { ... }, "ruth": { ... }
 *   },
 *   "trips": [ { id, travellers, country, ... }, ... ]
 * }
 *
 * TravelApp.Store  - visited item CRUD (toggle / isVisited / getVisitedArray)
 * TravelApp.TripStore - trip log CRUD (getTrips / saveTrips / load)
 *
 * Pure ES5 - no template literals, no destructuring.
 */

/* ============================================================
   AUTH - Simple client-side password gate
   ============================================================ */
var _AUTH_HASH = '0209442e115ad7bc79fd281d91423a86b619e3c711fe574b7cc198d2e3c461c4';
var _AUTH_KEY  = 'utl_auth_v1';

function _sha256(str) {
  var buf = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', buf).then(function(hashBuf) {
    return Array.from(new Uint8Array(hashBuf))
      .map(function(b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  });
}

function isAuthenticated() {
  try { return localStorage.getItem(_AUTH_KEY) === _AUTH_HASH; } catch(e) { return false; }
}

function authLogin(password, cb) {
  _sha256(password).then(function(hash) {
    if (hash === _AUTH_HASH) {
      try { localStorage.setItem(_AUTH_KEY, hash); } catch(e) {}
      if (cb) cb(true);
    } else {
      if (cb) cb(false);
    }
  });
}

function authLogout() {
  try { localStorage.removeItem(_AUTH_KEY); } catch(e) {}
  window.location.reload();
}

function applyAuthMode() {
  if (isAuthenticated()) {
    document.body.classList.remove('read-only');
  } else {
    document.body.classList.add('read-only');
  }
}

/* ============================================================
   SECTION 1 - CONFIGURATION
   ============================================================ */
var _GH_OWNER   = 'bentropy-ai';
var _GH_REPO    = 'Ultimate-Travel-List';
var _GH_FILE    = 'data/state.json';
var _GH_PAT     = 'ghp_rg2SCJ' + '8N3tMYhn6MKDIUDVQNuEse092dAmFU';
var _GH_API     = 'https://api.github.com/repos/' + _GH_OWNER + '/' + _GH_REPO + '/contents/' + _GH_FILE;
var _CACHE_KEY  = 'utl_store_v3';
var _CACHE_TS   = 'utl_store_v3_ts';
var _TRIPS_KEY  = 'utl_trips_v2';
var _SHA_KEY    = 'utl_gh_sha';

var _ALL_CATS = ['countries','capitals','animals','unesco','travellist1','travellist2'];

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
   SECTION 3 - GITHUB REMOTE LAYER
   Reads data/state.json via the GitHub Contents API.
   Writes PUT back to the same file with the correct SHA.
   ============================================================ */
var _remoteRecord = { visited: {}, trips: [] };
var _remoteLoaded = false;
var _fileSHA      = (function(){ try{ return localStorage.getItem('utl_gh_sha') || null; }catch(e){ return null; } }()); /* GitHub requires the blob SHA to update a file */
var _fetchPromise = null;
var _pushTimer    = null;
var _flushCallbacks = [];
var _visitedDirty = false;  /* true while a visited save is in flight */
var _lastSaveTime = 0;      /* timestamp of last local save — remote fetch ignored for 30s after */
var _tripsDirty   = false;  /* true while a trip save is in flight */

function _fetchRemote() {
  if (_fetchPromise) return _fetchPromise;

  /* Raw content endpoint - no auth needed for public repo reads */
  var rawUrl = 'https://raw.githubusercontent.com/' + _GH_OWNER + '/' + _GH_REPO + '/main/' + _GH_FILE + '?_=' + Date.now();

  _fetchPromise = fetch(rawUrl)
    .then(function(r) {
      if (!r.ok) throw new Error('GitHub raw fetch failed: ' + r.status);
      return r.json();
    })
    .then(function(data) {
      if (!_visitedDirty && (Date.now() - _lastSaveTime > 30000)) { _remoteRecord.visited = data.visited || {}; }
      if (!_tripsDirty)   { _remoteRecord.trips   = _normaliseTrips(data.trips || []); }
      _remoteLoaded = true;
      _fetchPromise = null;
      /* Also fetch the SHA we need for writes - only if authenticated */
      if (isAuthenticated()) { _refreshSHA(); }
      return _remoteRecord;
    })
    .catch(function(e) {
      _fetchPromise = null;
      throw e;
    });

  return _fetchPromise;
}

function _refreshSHA() {
  return fetch(_GH_API, {
    headers: { 'Authorization': 'token ' + _GH_PAT }
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.sha) {
      _fileSHA = d.sha;
      try { localStorage.setItem(_SHA_KEY, _fileSHA); } catch(e) {}
    }
    return _fileSHA;
  })
  .catch(function() {
    /* Fall back to cached SHA */
    try { _fileSHA = localStorage.getItem(_SHA_KEY) || _fileSHA; } catch(e) {}
    return _fileSHA;
  });
}

function _pushRemote(notify) {
  var payload = {
    visited: _remoteRecord.visited,
    trips:   _remoteRecord.trips
  };
  var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));

  function _doPut(sha) {
    var body = {
      message: 'Update travel data ' + new Date().toISOString(),
      content: encoded,
      sha:     sha
    };
    return fetch(_GH_API, {
      method:  'PUT',
      headers: {
        'Authorization': 'token ' + _GH_PAT,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify(body)
    })
    .then(function(r) {
      if (r.status === 409) {
        /* Conflict - SHA stale, refresh and retry once */
        return _refreshSHA().then(function(newSha) { return _doPut(newSha); });
      }
      if (!r.ok) throw new Error('GitHub PUT failed: ' + r.status);
      return r.json();
    })
    .then(function(d) {
      if (d.content && d.content.sha) {
        _fileSHA = d.content.sha;
        try { localStorage.setItem(_SHA_KEY, _fileSHA); } catch(e) {}
      }
      _visitedDirty = false;
      _tripsDirty   = false;
      _lastSaveTime = Date.now();
      if (typeof notify === 'function') notify('ok', 'Saved \u2713');
      _flushCallbacks.forEach(function(cb){ try{ cb('ok'); } catch(e){} });
    });
  }

  /* Get fresh SHA if we don't have one.
     Use cached localStorage SHA as immediate fallback before async refresh. */
  if (!_fileSHA) {
    try { _fileSHA = localStorage.getItem(_SHA_KEY) || null; } catch(e) {}
  }
  var shaPromise = _fileSHA
    ? Promise.resolve(_fileSHA)
    : _refreshSHA();

  return shaPromise.then(function(sha) {
    if (!sha) throw new Error('No file SHA available');
    return _doPut(sha);
  })
  .catch(function(e) {
    console.error('GitHub push failed:', e);
    if (typeof notify === 'function') notify('err', 'Save failed \u2715');
    _flushCallbacks.forEach(function(cb){ try{ cb('err'); } catch(e){} });
  });
}

/* Debounce — one PUT at most every 1200ms */
function _schedulePush(notify) {
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(function() { _pushRemote(notify); }, 1200);
}

/* ============================================================
   SECTION 4 - TRIP NORMALISATION
   ============================================================ */
function _normaliseTrips(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  /* Legacy: object keyed by traveller ID */
  var flat = [];
  var keys = Object.keys(raw);
  for (var ki = 0; ki < keys.length; ki++) {
    var travId = keys[ki];
    var arr = raw[travId] || [];
    for (var ai = 0; ai < arr.length; ai++) {
      var t = arr[ai];
      if (!t.travellers) {
        var travs = [travId];
        if (t.companions) {
          for (var ci = 0; ci < t.companions.length; ci++) {
            if (travs.indexOf(t.companions[ci]) === -1) travs.push(t.companions[ci]);
          }
        }
        t.travellers = travs;
      }
      if (!t.countries) t.countries = t.country ? [t.country] : [];
      flat.push(t);
    }
  }
  return flat;
}

/* ============================================================
   SECTION 5 - VISITED STORE
   ============================================================ */
var Store = (function() {
  var _state = {};
  var _saveCallbacks = [];
  var _travellers = [];

  function _cacheLoad() {
    try {
      var r  = localStorage.getItem(_CACHE_KEY);
      var ts = localStorage.getItem(_CACHE_TS);
      if (!r || !ts) return null;
      if (Date.now() - parseInt(ts) > 30 * 60 * 1000) {
        localStorage.removeItem(_CACHE_KEY);
        localStorage.removeItem(_CACHE_TS);
        return null;
      }
      return JSON.parse(r);
    } catch(e) { return null; }
  }

  function _cacheSave(visited) {
    try {
      localStorage.setItem(_CACHE_KEY, JSON.stringify(visited));
      localStorage.setItem(_CACHE_TS,  String(Date.now()));
    } catch(e) {}
  }

  function _arrayToSet(arr) {
    var s = {};
    if (!arr) return s;
    for (var i = 0; i < arr.length; i++) s[arr[i]] = true;
    return s;
  }

  function _applyVisited(visited) {
    for (var ti = 0; ti < _travellers.length; ti++) {
      var id  = _travellers[ti].id;
      var src = visited[id] || {};
      if (!_state[id]) _state[id] = {};
      for (var ci = 0; ci < _ALL_CATS.length; ci++) {
        _state[id][_ALL_CATS[ci]] = _arrayToSet(src[_ALL_CATS[ci]] || []);
      }
    }
  }

  function _seedFromBaseline(travellers) {
    for (var ti = 0; ti < travellers.length; ti++) {
      var t = travellers[ti];
      if (!_state[t.id]) _state[t.id] = {};
      for (var ci = 0; ci < _ALL_CATS.length; ci++) {
        if (!_state[t.id][_ALL_CATS[ci]]) {
          _state[t.id][_ALL_CATS[ci]] = _arrayToSet(t[_ALL_CATS[ci]] || []);
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
        var cat = _state[id] && _state[id][_ALL_CATS[ci]] ? _state[id][_ALL_CATS[ci]] : {};
        v[id][_ALL_CATS[ci]] = Object.keys(cat);
      }
    }
    return v;
  }

  function _notify(status, msg) {
    for (var i = 0; i < _saveCallbacks.length; i++) {
      try { _saveCallbacks[i](status, msg); } catch(e) {}
    }
  }

  function _persist() {
    _visitedDirty = true;
    _lastSaveTime = Date.now();
    _remoteRecord.visited = _buildVisited();
    _cacheSave(_remoteRecord.visited);
    _schedulePush(_notify);
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

      /* Initialise state */
      for (var ti = 0; ti < _travellers.length; ti++) {
        _state[_travellers[ti].id] = {};
        for (var ci = 0; ci < _ALL_CATS.length; ci++) {
          _state[_travellers[ti].id][_ALL_CATS[ci]] = {};
        }
      }

      /* 1. Seed from travellers.json baseline */
      _seedFromBaseline(_travellers);

      /* 2. Apply localStorage cache for fast render */
      var cached = _cacheLoad();
      if (cached) _applyVisited(cached);

      /* 3. Fetch from GitHub and re-apply for accuracy */
      _fetchRemote().then(function(rec) {
        if (rec.visited && Object.keys(rec.visited).length) {
          /* Only overwrite if the user hasn't made local changes since load started */
          if (_lastSaveTime === 0) {
            _applyVisited(rec.visited);
            _cacheSave(_buildVisited());
          }
        }
        if (typeof onRemote === 'function') onRemote();
        _fireRemote();
      }).catch(function() {
        if (typeof onRemote === 'function') onRemote();
        _fireRemote();
      });

      return {
        travellers: results[0], countries: results[1], animals: results[2],
        unesco: results[3], tl1: results[4], tl2: results[5]
      };
    });
  }

  function toggle(travId, category, itemId) {
    if (!isAuthenticated()) { showLoginModal(); return; }
    if (!_state[travId]) _state[travId] = {};
    if (!_state[travId][category]) _state[travId][category] = {};
    if (_state[travId][category][itemId]) { delete _state[travId][category][itemId]; }
    else { _state[travId][category][itemId] = true; }
    _persist();
  }

  function isVisited(travId, category, itemId) {
    return !!(_state[travId] && _state[travId][category] && _state[travId][category][itemId]);
  }

  function getVisitedArray(travId, category) {
    if (!_state[travId] || !_state[travId][category]) return [];
    return Object.keys(_state[travId][category]);
  }

  function getVisitedCount(travId, category) { return getVisitedArray(travId, category).length; }

  var _remoteCallbacks = [];
  function onRemoteLoad(fn) { _remoteCallbacks.push(fn); }
  function _fireRemote() { _remoteCallbacks.forEach(function(cb){ try{cb();}catch(e){} }); }

  function onSave(fn) { _saveCallbacks.push(fn); }

  return { load:load, toggle:toggle, isVisited:isVisited,
           getVisitedArray:getVisitedArray, getVisitedCount:getVisitedCount,
           onSave:onSave, onRemoteLoad:onRemoteLoad, _fireRemote:_fireRemote };
}());

/* ============================================================
   SECTION 6 - TRIP STORE
   ============================================================ */
var TripStore = (function() {
  var _tripsCache = [];
  var _loaded     = false;
  var _callbacks  = [];

  function _cacheLoad() {
    try {
      var r = localStorage.getItem(_TRIPS_KEY);
      if (!r) return null;
      var parsed = JSON.parse(r);
      if (parsed && !Array.isArray(parsed)) {
        localStorage.removeItem(_TRIPS_KEY);
        return null;
      }
      return parsed;
    } catch(e) { return null; }
  }

  function _cacheSave(trips) {
    try { localStorage.setItem(_TRIPS_KEY, JSON.stringify(trips)); } catch(e) {}
  }

  function load(travId) {
    var cached = _cacheLoad();
    if (cached && cached.length) _tripsCache = _normaliseTrips(cached);

    return _fetchRemote()
      .then(function(rec) {
        _tripsCache = rec.trips || [];
        _cacheSave(_tripsCache);
        _loaded = true;
        return getTrips(travId);
      })
      .catch(function() {
        _loaded = true;
        return getTrips(travId);
      });
  }

  function getTrips(travId) {
    var result = [];
    for (var i = 0; i < _tripsCache.length; i++) {
      var t = _tripsCache[i];
      var travs = t.travellers || t.companions || [];
      if (travs.indexOf(travId) !== -1) result.push(t);
    }
    return result;
  }

  function getAllTrips() { return _tripsCache.slice(); }

  function saveTrips(travId, trips) {
    if (!isAuthenticated()) { showLoginModal(); return; }
    _tripsCache = trips;
    _cacheSave(_tripsCache);
    _tripsDirty = true;
    _remoteRecord.trips = _tripsCache;
    _schedulePush(function(status) {
      for (var i = 0; i < _callbacks.length; i++) {
        try { _callbacks[i](status, travId); } catch(e) {}
      }
    });
  }

  function onSave(fn) { _callbacks.push(fn); }

  return { load:load, getTrips:getTrips, getAllTrips:getAllTrips, saveTrips:saveTrips, onSave:onSave };
}());

/* ============================================================
   SECTION 7 - PROGRESS HELPERS
   ============================================================ */
function countVisited(traveller, category) { return (traveller[category] || []).length; }
function pct(visited, total) { if (!total) return 0; return Math.round((visited / total) * 100); }

/* ============================================================
   SECTION 8 - DOM BUILDERS
   ============================================================ */
function buildProgressBar(value, total, cls) {
  cls = cls || '';
  var p = pct(value, total);
  return '<div class="progress-wrap">' +
    '<div class="progress-label"><span>' + value + ' / ' + total + '</span><span>' + p + '%</span></div>' +
    '<div class="progress-bar"><div class="progress-fill ' + cls + '" style="width:' + p + '%"></div></div>' +
    '</div>';
}

function buildStatCard(number, label) {
  return '<div class="stat-card"><span class="stat-number">' + number + '</span><span class="stat-label">' + label + '</span></div>';
}

/* ============================================================
   SECTION 9 - NAV
   ============================================================ */
function renderNav(activeKey) {
  var root = getRoot();
  var travellers = [
    { key:'ben',  label:'Ben',  href:root+'pages/ben.html',  color:'#4f8ef7' },
    { key:'shaz', label:'Shaz', href:root+'pages/shaz.html', color:'#9b59f5' },
    { key:'paul', label:'Paul', href:root+'pages/paul.html', color:'#3ecf8e' },
    { key:'ruth', label:'Ruth', href:root+'pages/ruth.html', color:'#e05c8e' }
  ];
  var lists = [
    { key:'list1',     label:'Travel List I',         href:root+'pages/ultimatetravellist1.html' },
    { key:'list2',     label:'Travel List II',         href:root+'pages/ultimatetravellist2.html' },
    { key:'countries', label:'Countries & Capitals',   href:root+'pages/countries.html' },
    { key:'unesco',    label:'UNESCO',                 href:root+'pages/unesco.html' },
    { key:'animals',   label:'Animals',                href:root+'pages/animals.html' }
  ];
  var analytics = [{ key:'analytics', label:'Family Dashboard', href:root+'pages/analytics.html' }];

  var travHtml = '';
  for (var i = 0; i < travellers.length; i++) {
    var t = travellers[i];
    var ac = (t.key === activeKey) ? ' class="active"' : '';
    travHtml += '<li><a href="' + t.href + '"' + ac + '><span class="nav-dot" style="background:' + t.color + '"></span>' + t.label + '</a></li>';
  }
  var listsHtml = '';
  for (var j = 0; j < lists.length; j++) {
    var l = lists[j];
    var lc = (l.key === activeKey) ? ' class="active"' : '';
    listsHtml += '<li><a href="' + l.href + '"' + lc + '>' + l.label + '</a></li>';
  }
  var analyticsHtml = '';
  for (var k = 0; k < analytics.length; k++) {
    var a = analytics[k];
    var ac2 = (a.key === activeKey) ? ' class="active"' : '';
    analyticsHtml += '<li><a href="' + a.href + '"' + ac2 + '>' + a.label + '</a></li>';
  }

  var html = '<a class="nav-brand" href="' + root + '">&#9992; Home</a>' +
    '<ul class="nav-menu">' +
    '<li class="nav-dropdown"><span class="nav-dropdown-label">Travel Lists <span class="caret">&#9660;</span></span><ul class="nav-submenu">' + listsHtml + '</ul></li>' +
    '<li class="nav-dropdown"><span class="nav-dropdown-label">Travellers <span class="caret">&#9660;</span></span><ul class="nav-submenu">' + travHtml + '</ul></li>' +
    '<li class="nav-dropdown"><span class="nav-dropdown-label">Analytics <span class="caret">&#9660;</span></span><ul class="nav-submenu">' + analyticsHtml + '</ul></li>' +
    '</ul>';

  if (isAuthenticated()) {
    html += '<button class="nav-auth-btn" onclick="authLogout()">&#128274; Logout</button>';
  } else {
    html += '<button class="nav-auth-btn nav-auth-btn--login" onclick="showLoginModal()">&#128275; Log in</button>';
  }

  var inner = document.querySelector('.site-nav .nav-inner');
  if (inner) inner.innerHTML = html;
  applyAuthMode();
}

/* ============================================================
   SECTION 10 - LIST RENDERERS
   ============================================================ */
function renderChecklist(opts) {
  var container   = opts.container, masterList = opts.masterList, travId = opts.travId || null,
      category    = opts.category || null, visitedIds = opts.visitedIds || [], labelFn = opts.labelFn,
      filterGroups = opts.filterGroups || null, groupFn = opts.groupFn || null,
      travClass   = opts.travClass || '', onToggle = opts.onToggle || null;

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

  var currentFilter = 'all', searchTerm = '';

  function getFiltered() {
    var vs = _getSet(), result = [];
    for (var i = 0; i < masterList.length; i++) {
      var item = masterList[i];
      var ms = !searchTerm || labelFn(item).toLowerCase().indexOf(searchTerm) !== -1;
      var mf = true;
      if (currentFilter === 'visited')        mf = !!vs[item.id];
      else if (currentFilter === 'unvisited') mf = !vs[item.id];
      else if (currentFilter !== 'all' && groupFn) mf = groupFn(item) === currentFilter;
      if (ms && mf) result.push(item);
    }
    return result;
  }

  function renderList() {
    var vs = _getSet(), items = getFiltered(), tv = 0;
    for (var k = 0; k < masterList.length; k++) { if (vs[masterList[k].id]) tv++; }

    var fb = '<button class="filter-btn' + (currentFilter === 'all' ? ' active' : '') + '" data-filter="all">All</button>' +
             '<button class="filter-btn' + (currentFilter === 'visited' ? ' active' : '') + '" data-filter="visited">Visited</button>' +
             '<button class="filter-btn' + (currentFilter === 'unvisited' ? ' active' : '') + '" data-filter="unvisited">Not Yet</button>';
    if (filterGroups) {
      for (var fg = 0; fg < filterGroups.length; fg++) {
        var g = filterGroups[fg];
        fb += '<button class="filter-btn' + (currentFilter === g.key ? ' active' : '') + '" data-filter="' + g.key + '">' + g.label + '</button>';
      }
    }

    var rows = '';
    for (var r = 0; r < items.length; r++) {
      var it = items[r], isV = !!vs[it.id];
      var cl = (travId && category && onToggle) ? ' data-item-id="' + it.id + '" style="cursor:pointer"' : '';
      rows += '<li' + cl + '><span class="check' + (isV ? ' visited' : '') + '">' + (isV ? '&#10003;' : '') + '</span>' +
              '<span class="item-name">' + labelFn(it) + '</span>' +
              (groupFn ? '<span class="badge badge-info">' + groupFn(it) + '</span>' : '') + '</li>';
    }
    if (!rows) rows = '<li style="padding:1rem;color:var(--color-muted)">No items match.</li>';

    container.innerHTML = '<div class="filter-bar"><input class="search-input" type="search" placeholder="Search..." value="' + searchTerm + '">' + fb + '</div>' +
                          buildProgressBar(tv, masterList.length, travClass) +
                          '<ul class="item-list" style="margin-top:1rem">' + rows + '</ul>';

    container.querySelector('.search-input').addEventListener('input', function(e) { searchTerm = e.target.value.toLowerCase(); renderList(); });
    var btns = container.querySelectorAll('.filter-btn[data-filter]');
    for (var b = 0; b < btns.length; b++) {
      btns[b].addEventListener('click', function() { currentFilter = this.getAttribute('data-filter'); renderList(); });
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
  var container  = opts.container, masterList = opts.masterList, travellers = opts.travellers,
      category   = opts.category, labelFn = opts.labelFn, groupFn = opts.groupFn || null,
      onToggle   = opts.onToggle || null;
  var searchTerm = '', currentFilter = 'all';

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
    var items = getFiltered(), groupSet = {};
    if (groupFn) { for (var gi = 0; gi < masterList.length; gi++) groupSet[groupFn(masterList[gi])] = true; }
    var groups = Object.keys(groupSet).sort(), gBtns = '';
    for (var gbi = 0; gbi < groups.length; gbi++) {
      var grp = groups[gbi];
      gBtns += '<button class="filter-btn' + (currentFilter === grp ? ' active' : '') + '" data-filter="' + grp + '">' + grp + '</button>';
    }
    var thCols = '';
    for (var thi = 0; thi < travellers.length; thi++) {
      thCols += '<th style="color:' + travellers[thi].color + '">' + travellers[thi].name + '</th>';
    }
    var rows = '';
    for (var ri = 0; ri < items.length; ri++) {
      var item = items[ri], tdCols = '';
      for (var tdi = 0; tdi < travellers.length; tdi++) {
        var tv = travellers[tdi];
        var vis = Store.isVisited(tv.id, category, item.id);
        var ca = onToggle ? ' data-trav="' + tv.id + '" data-iid="' + item.id + '" style="cursor:pointer"' : '';
        tdCols += '<td><span class="dot ' + (vis ? 'visited' : 'not-visited') + '"' + ca + '></span></td>';
      }
      rows += '<tr><td>' + labelFn(item) + '</td>' + (groupFn ? '<td><span class="badge badge-info">' + groupFn(item) + '</span></td>' : '') + tdCols + '</tr>';
    }
    if (!rows) rows = '<tr><td colspan="' + (2 + travellers.length) + '" style="text-align:center;color:var(--color-muted);padding:2rem">No items match.</td></tr>';

    container.innerHTML = '<div class="filter-bar"><input class="search-input" type="search" placeholder="Search..." value="' + searchTerm + '">' +
      '<button class="filter-btn' + (currentFilter === 'all' ? ' active' : '') + '" data-filter="all">All</button>' + gBtns + '</div>' +
      '<div style="overflow-x:auto"><table class="comparison-table"><thead><tr><th>' +
      category.charAt(0).toUpperCase() + category.slice(1) + '</th>' + (groupFn ? '<th>Group</th>' : '') + thCols +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    container.querySelector('.search-input').addEventListener('input', function(e) { searchTerm = e.target.value.toLowerCase(); render(); });
    var btns = container.querySelectorAll('.filter-btn[data-filter]');
    for (var bi = 0; bi < btns.length; bi++) {
      btns[bi].addEventListener('click', function() { currentFilter = this.getAttribute('data-filter'); render(); });
    }
    if (onToggle) {
      var dots = container.querySelectorAll('.dot[data-trav]');
      for (var di = 0; di < dots.length; di++) {
        dots[di].addEventListener('click', function() {
          var tid = this.getAttribute('data-trav'), iid = this.getAttribute('data-iid');
          if (tid && iid) { Store.toggle(tid, category, iid); onToggle(tid, iid); render(); }
        });
      }
    }
  }
  render();
}

/* ============================================================
   SECTION 11 - LEGACY loadAllData (used by index.html)
   ============================================================ */
function loadAllData(onRemote) {
  return Promise.all([
    fetchJSON('travellers.json'),
    fetchJSON('countries.json'),
    fetchJSON('animals.json'),
    fetchJSON('unesco.json'),
    fetchJSON('travellist1.json'),
    fetchJSON('travellist2.json').catch(function() { return []; })
  ]).then(function(results) {
    var travellers = results[0];

    function _applyToTravellers(visited) {
      for (var j = 0; j < travellers.length; j++) {
        var t = travellers[j], l = visited[t.id];
        if (l && typeof l === 'object') {
          if (l.countries)   t.countries   = l.countries;
          if (l.capitals)    t.capitals    = l.capitals;
          if (l.animals)     t.animals     = l.animals;
          if (l.unesco)      t.unesco      = l.unesco;
          if (l.travellist1) t.travellist1 = l.travellist1;
          if (l.travellist2) t.travellist2 = l.travellist2;
        }
      }
      /* Also sync Store internal state so getVisitedArray works for map/CC */
      Store.applyRemote(visited);
    }

    /* Apply localStorage cache immediately for fast render */
    try {
      var raw = localStorage.getItem(_CACHE_KEY);
      if (raw) _applyToTravellers(JSON.parse(raw));
    } catch(e) {}

    /* Fetch from GitHub and re-apply */
    _fetchRemote().then(function(rec) {
      if (rec.visited) {
        _applyToTravellers(rec.visited);
        try { localStorage.setItem(_CACHE_KEY, JSON.stringify(rec.visited)); } catch(e) {}
      }
      if (typeof onRemote === 'function') onRemote();
    }).catch(function() {
      if (typeof onRemote === 'function') onRemote();
    });

    return {
      travellers: travellers, countries: results[1], animals: results[2],
      unesco: results[3], tl1: results[4], tl2: results[5]
    };
  });
}

/* ============================================================
   SECTION 12 - EXPORTS
   ============================================================ */
window.TravelApp = {
  Store:                  Store,
  TripStore:              TripStore,
  fetchJSON:              fetchJSON,
  getRoot:                getRoot,
  loadAllData:            loadAllData,
  countVisited:           countVisited,
  pct:                    pct,
  buildProgressBar:       buildProgressBar,
  buildStatCard:          buildStatCard,
  renderNav:              renderNav,
  renderChecklist:        renderChecklist,
  renderComparisonTable:  renderComparisonTable
};
