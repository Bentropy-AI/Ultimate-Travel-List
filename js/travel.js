/* travel.js - Shared utilities for Ultimate Travel List
 *
 * SINGLE SOURCE OF TRUTH ARCHITECTURE
 * ------------------------------------
 * All state is stored in one JSONBin record with this shape:
 *
 * {
 *   "visited": {
 *     "ben":  { "countries":[], "capitals":[], "animals":[], "unesco":[], "travellist1":[], "travellist2":[] },
 *     "shaz": { ... }, "paul": { ... }, "ruth": { ... }
 *   },
 *   "trips": {
 *     "ben":  [ { id, country, continent, locations, start, finish, type, utl1, utl2 }, ... ],
 *     "shaz": [], "paul": [], "ruth": []
 *   }
 * }
 *
 * TravelApp.Store     - visited item CRUD  (toggle / isVisited / getVisitedArray)
 * TravelApp.TripStore - trip log CRUD      (getTrips / saveTrips / load)
 *
 * Both share a single JSONBin round-trip so every PUT preserves
 * visited AND trips together - no data is ever overwritten.
 *
 * Pure ES5 - no template literals, no destructuring.
 */


/* ============================================================
   AUTH - Simple client-side password gate
   Password hash can be updated via GitHub secret or direct edit
   ============================================================ */
var _AUTH_HASH = '190ae5a26660093e48c27859b7ce9f92436bf1bfc4a0ab6dc175c842950c71f6';
var _AUTH_KEY  = 'utl_auth_v1';

function _sha256(str) {
  /* Simple SHA-256 using SubtleCrypto - returns Promise<hex string> */
  var buf = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', buf).then(function(hashBuf) {
    return Array.from(new Uint8Array(hashBuf))
      .map(function(b) { return b.toString(16).padStart(2,'0'); })
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
  /* Add or remove 'read-only' class on body */
  if (isAuthenticated()) {
    document.body.classList.remove('read-only');
  } else {
    document.body.classList.add('read-only');
  }
}

/* ============================================================
   SECTION 1 - CONFIGURATION
   ============================================================ */
var _BIN_ID   = '69cd4cbd36566621a86d74ab';
var _API_KEY  = '$2a$10$ZBPwhHYl3Fa7.3xScA8xVe4Nq7UfBqDgk/kFuk7E7dDktRt8yapM.';
var _BIN_URL  = 'https://api.jsonbin.io/v3/b/' + _BIN_ID;
var _CACHE_KEY = 'utl_store_v2';
var _TRIPS_CACHE_KEY = 'utl_trips_v1';

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
   SECTION 3 - SHARED REMOTE LAYER
   Reads and writes the FULL JSONBin record so visited and trips
   are never clobbered by each other.
   ============================================================ */
var _remoteRecord = { visited: {}, trips: [] };
var _tripsCache    = [];   /* flat trips array — shared between TripStore and _fetchFullRecord */
var _visitedLoaded = false; /* guard: don't PUT trips until visited is loaded */
var _remoteLoaded  = false;
var _pendingFlush  = null;
var _flushCallbacks = [];

var _fetchPromise = null;
function _fetchFullRecord() {
  /* Deduplicate concurrent fetches — reuse in-flight promise */
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = fetch(_BIN_URL + '/latest', {
    headers: { 'X-Master-Key': _API_KEY }
  }).then(function(r) {
    if (!r.ok) throw new Error('JSONBin GET failed: ' + r.status);
    return r.json();
  }).then(function(d) {
    var rec = d.record || {};
    if (rec.visited) { _applyVisited(rec.visited); _remoteRecord.visited = rec.visited; }
    _visitedLoaded = true;
    _remoteRecord.trips   = _normalise(rec.trips || []);
    _tripsCache           = _remoteRecord.trips; /* sync _tripsCache - now in outer scope */
    try { localStorage.setItem('utl_trips_v1', JSON.stringify(_tripsCache)); } catch(e) {}
    _remoteLoaded = true;
    _fetchPromise = null;
    return _remoteRecord;
  }).catch(function(e) {
    _fetchPromise = null;
    throw e;
  });
  return _fetchPromise;
}

function _pushFullRecord() {
  /* Always GET fresh trips before PUT so visited saves never wipe trips */
  return fetch(_BIN_URL + '/latest', { headers: { 'X-Master-Key': _API_KEY } })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var latestTrips = (d.record && d.record.trips) ? d.record.trips : _tripsCache;
      var payload = {
        visited: _remoteRecord.visited,
        trips: latestTrips.length ? latestTrips : _tripsCache
      };
      return fetch(_BIN_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': _API_KEY },
        body: JSON.stringify(payload)
      });
    })
    .then(function(r) {
      if (!r.ok) throw new Error('JSONBin PUT failed: ' + r.status);
      return r.json();
    });
}

/* debounce – one PUT at most every 800ms */
var _pushTimer = null;
function _schedulePush(notify) {
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(function() {
    _pushFullRecord().then(function() {
      if (typeof notify === 'function') notify('ok', 'Saved \u2713');
      _flushCallbacks.forEach(function(cb){ try{ cb('ok'); }catch(e){} });
    }).catch(function() {
      setTimeout(function() {
        _pushFullRecord().catch(function() {
          if (typeof notify === 'function') notify('err', 'Save failed \u2715');
          _flushCallbacks.forEach(function(cb){ try{ cb('err'); }catch(e){} });
        });
      }, 2000);
    });
  }, 800);
}

/* ============================================================
   SECTION 4 - VISITED STORE  (unchanged public API)
   ============================================================ */
var Store = (function() {
  var _state       = {};
  var _saveCallbacks = [];
  var _travellers  = [];

  function _cacheLoad() {
    try { var r = localStorage.getItem(_CACHE_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; }
  }
  function _cacheSave(visited) {
    try { localStorage.setItem(_CACHE_KEY, JSON.stringify(visited)); } catch(e) {}
  }
  function _arrayToSet(arr) {
    var s = {}; if (!arr) return s;
    for (var i = 0; i < arr.length; i++) s[arr[i]] = true; return s;
  }
  function _applyVisited(visited) {
    for (var ti = 0; ti < _travellers.length; ti++) {
      var id = _travellers[ti].id;
      if (!_state[id]) _state[id] = {};
      var src = visited[id] || {};
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
        if (!_state[t.id][_ALL_CATS[ci]]) _state[t.id][_ALL_CATS[ci]] = _arrayToSet(t[_ALL_CATS[ci]] || []);
      }
    }
  }
  function _buildVisited() {
    var v = {};
    for (var ti = 0; ti < _travellers.length; ti++) {
      var id = _travellers[ti].id; v[id] = {};
      for (var ci = 0; ci < _ALL_CATS.length; ci++) {
        v[id][_ALL_CATS[ci]] = Object.keys(_state[id] && _state[id][_ALL_CATS[ci]] ? _state[id][_ALL_CATS[ci]] : {});
      }
    }
    return v;
  }
  function _notify(status, msg) {
    for (var i = 0; i < _saveCallbacks.length; i++) { try { _saveCallbacks[i](status, msg); } catch(e) {} }
  }
  function _persist() {
    _remoteRecord.visited = _buildVisited();
    _cacheSave(_remoteRecord.visited);
    _schedulePush(_notify);
  }

  function load(onRemote) {
    return Promise.all([
      fetchJSON('travellers.json'), fetchJSON('countries.json'), fetchJSON('animals.json'),
      fetchJSON('unesco.json'),     fetchJSON('travellist1.json'),
      fetchJSON('travellist2.json').catch(function(){ return []; })
    ]).then(function(results) {
      _travellers = results[0];
      for (var ti = 0; ti < _travellers.length; ti++) {
        _state[_travellers[ti].id] = {};
        for (var ci = 0; ci < _ALL_CATS.length; ci++) _state[_travellers[ti].id][_ALL_CATS[ci]] = {};
      }
      _seedFromBaseline(_travellers);
      var cached = _cacheLoad();
      if (cached) _applyVisited(cached);

      _fetchFullRecord().then(function(rec) {
        if (rec.visited) { _applyVisited(rec.visited); _cacheSave(_buildVisited()); _visitedLoaded = true; }
        if (typeof onRemote === 'function') onRemote();
      }).catch(function() {
        if (typeof onRemote === 'function') onRemote();
      });

      return { travellers: results[0], countries: results[1], animals: results[2],
               unesco: results[3], tl1: results[4], tl2: results[5] };
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
  function onSave(fn) { _saveCallbacks.push(fn); }

  return { load:load, toggle:toggle, isVisited:isVisited,
           getVisitedArray:getVisitedArray, getVisitedCount:getVisitedCount, onSave:onSave };
}());

/* Migrate legacy per-traveller trips object to flat array if needed */
function _normalise(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
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
            if (travs.indexOf(t.companions[ci]) === -1) { travs.push(t.companions[ci]); }
          }
        }
        t.travellers = travs;
      }
      /* Migrate legacy single country string to countries array */
      if (!t.countries) {
        t.countries = t.country ? [t.country] : [];
      }
      flat.push(t);
    }
  }
  return flat;
}

/* ============================================================
   SECTION 5 - TRIP STORE  (new - single source of truth for trip log)
   ============================================================ */
var TripStore = (function() {
  /* Unified flat trips array - each trip has a 'travellers' field (array of IDs).
   * _tripsCache is declared in outer scope so _fetchFullRecord can also populate it. */
  var _loaded = false;
  var _callbacks = [];

  function _cacheLoad() {
    try {
      var r = localStorage.getItem(_TRIPS_CACHE_KEY);
      if (!r) return null;
      var parsed = JSON.parse(r);
      /* Discard legacy per-traveller object — force re-fetch so flat array gets cached */
      if (parsed && !Array.isArray(parsed)) {
        localStorage.removeItem(_TRIPS_CACHE_KEY);
        return null;
      }
      return parsed;
    } catch(e) { return null; }
  }
  function _cacheSave(trips) {
    try { localStorage.setItem(_TRIPS_CACHE_KEY, JSON.stringify(trips)); } catch(e) {}
  }

  /* Load trips from remote (or cache on failure). Returns Promise<trips_for_traveller[]> */
  function load(travId) {
    var cached = _cacheLoad();
    if (cached && cached.length) { _tripsCache = _normalise(cached); }

    /* Fetch trips directly — don't rely on _fetchFullRecord sharing */
    return fetch(_BIN_URL + '/latest', { headers: { 'X-Master-Key': _API_KEY } })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var rec = d.record || {};
        _tripsCache = _normalise(rec.trips || []);
        _cacheSave(_tripsCache);
        /* Also apply visited data so _visitedLoaded guard is satisfied */
        if (rec.visited) { _applyVisited(rec.visited); }
        _remoteRecord.trips = _tripsCache;
        _visitedLoaded = true;
        _loaded = true;
        return getTrips(travId);
      }).catch(function() {
        _visitedLoaded = true;
        _loaded = true;
        return getTrips(travId);
      });
  }

  /* Get all trips a traveller appears on */
  function getTrips(travId) {
    var result = [];
    for (var i = 0; i < _tripsCache.length; i++) {
      var t = _tripsCache[i];
      var travs = t.travellers || t.companions || [];
      if (travs.indexOf(travId) !== -1) { result.push(t); }
    }
    return result;
  }

  /* Replace the entire flat trips array (used after add/edit/delete from any page) */
  function saveTrips(travId, trips) {
    if (!isAuthenticated()) { showLoginModal(); return; }
    _tripsCache = trips;
    _cacheSave(_tripsCache);
    if (!_visitedLoaded) {
      /* visited not yet loaded — skip PUT to avoid clobbering visited data */
      return;
    }
    /* Always GET fresh visited before PUT to prevent data loss */
    fetch(_BIN_URL + '/latest', { headers: { 'X-Master-Key': _API_KEY } })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var safeVisited = (d.record && d.record.visited) ? d.record.visited : _remoteRecord.visited;
        var payload = { visited: safeVisited, trips: _tripsCache };
        return fetch(_BIN_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': _API_KEY },
          body: JSON.stringify(payload)
        });
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.record && d.record.visited) { _remoteRecord.visited = d.record.visited; }
        for (var i = 0; i < _callbacks.length; i++) { try { _callbacks[i]('success', travId); } catch(e) {} }
      })
      .catch(function(e) {
        console.error('saveTrips failed:', e);
      });
  }

  /* Get the full unfiltered trips array (for add/edit/delete operations) */
  function getAllTrips() {
    return _tripsCache.slice();
  }

  function onSave(fn) { _callbacks.push(fn); }

  return { load:load, getTrips:getTrips, getAllTrips:getAllTrips, saveTrips:saveTrips, onSave:onSave };
}());

/* ============================================================
   SECTION 6 - PROGRESS HELPERS
   ============================================================ */
function countVisited(traveller, category) { return (traveller[category] || []).length; }
function pct(visited, total) { if (!total) return 0; return Math.round((visited / total) * 100); }

/* ============================================================
   SECTION 7 - DOM BUILDERS
   ============================================================ */
function buildProgressBar(value, total, cls) {
  cls = cls || ''; var p = pct(value, total);
  return '<div class="progress-wrap">' +
    '<div class="progress-label"><span>' + value + ' / ' + total + '</span><span>' + p + '%</span></div>' +
    '<div class="progress-bar"><div class="progress-fill ' + cls + '" style="width:' + p + '%"></div></div>' +
    '</div>';
}
function buildStatCard(number, label) {
  return '<div class="stat-card"><span class="stat-number">' + number + '</span><span class="stat-label">' + label + '</span></div>';
}

/* ============================================================
   SECTION 8 - NAV
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
    { key:'list1',     label:'Travel List I',        href:root+'pages/ultimatetravellist1.html' },
    { key:'list2',     label:'Travel List II',       href:root+'pages/ultimatetravellist2.html' },
    { key:'countries', label:'Countries & Capitals', href:root+'pages/countries.html' },
    { key:'unesco',    label:'UNESCO',               href:root+'pages/unesco.html' },
    { key:'animals',   label:'Animals',              href:root+'pages/animals.html' }
  ];
  var analytics = [{ key:'analytics', label:'Family Dashboard', href:root+'pages/analytics.html' }];
  var travHtml = ''; for (var i=0;i<travellers.length;i++) {
    var t=travellers[i]; var ac=(t.key===activeKey)?' class="active"':'';
    travHtml+='<li><a href="'+t.href+'"'+ac+'><span class="nav-dot" style="background:'+t.color+'"></span>'+t.label+'</a></li>';
  }
  var listsHtml = ''; for (var j=0;j<lists.length;j++) {
    var l=lists[j]; var lc=(l.key===activeKey)?' class="active"':'';
    listsHtml+='<li><a href="'+l.href+'"'+lc+'>'+l.label+'</a></li>';
  }
  var analyticsHtml = ''; for (var k=0;k<analytics.length;k++) {
    var a=analytics[k]; var ac2=(a.key===activeKey)?' class="active"':'';
    analyticsHtml+='<li><a href="'+a.href+'"'+ac2+'>'+a.label+'</a></li>';
  }
  var html = '<a class="nav-brand" href="'+root+'">&#9992; Travel Tracker</a>' +
    '<ul class="nav-menu">' +
    '<li class="nav-dropdown"><span class="nav-dropdown-label">Travel Lists <span class="caret">&#9660;</span></span><ul class="nav-submenu">'+listsHtml+'</ul></li>' +
    '<li class="nav-dropdown"><span class="nav-dropdown-label">Travellers <span class="caret">&#9660;</span></span><ul class="nav-submenu">'+travHtml+'</ul></li>' +
    '<li class="nav-dropdown"><span class="nav-dropdown-label">Analytics <span class="caret">&#9660;</span></span><ul class="nav-submenu">'+analyticsHtml+'</ul></li>' +
    '</ul>';
  /* Add login/logout button */
  if (isAuthenticated()) {
    html += '<button class="nav-auth-btn" onclick="authLogout()">&#128274; Logout</button>';
  } else {
    html += '<button class="nav-auth-btn nav-auth-btn--login" onclick="showLoginModal()">&#128275; Edit Mode</button>';
  }
  var inner = document.querySelector('.site-nav .nav-inner');
  if (inner) inner.innerHTML = html;
  /* Apply read-only mode after nav renders */
  applyAuthMode();
}

/* ============================================================
   SECTION 9 - LIST RENDERERS  (unchanged)
   ============================================================ */
function renderChecklist(opts) {
  var container=opts.container,masterList=opts.masterList,travId=opts.travId||null,
      category=opts.category||null,visitedIds=opts.visitedIds||[],labelFn=opts.labelFn,
      filterGroups=opts.filterGroups||null,groupFn=opts.groupFn||null,
      travClass=opts.travClass||'',onToggle=opts.onToggle||null;
  function _getSet(){var s={};if(travId&&category){var arr=Store.getVisitedArray(travId,category);for(var i=0;i<arr.length;i++)s[arr[i]]=true;}else{for(var j=0;j<visitedIds.length;j++)s[visitedIds[j]]=true;}return s;}
  var currentFilter='all',searchTerm='';
  function getFiltered(){var vs=_getSet(),result=[];for(var i=0;i<masterList.length;i++){var item=masterList[i],ms=!searchTerm||labelFn(item).toLowerCase().indexOf(searchTerm)!==-1,mf=true;if(currentFilter==='visited')mf=!!vs[item.id];else if(currentFilter==='unvisited')mf=!vs[item.id];else if(currentFilter!=='all'&&groupFn)mf=groupFn(item)===currentFilter;if(ms&&mf)result.push(item);}return result;}
  function renderList(){var vs=_getSet(),items=getFiltered(),tv=0;for(var k=0;k<masterList.length;k++){if(vs[masterList[k].id])tv++;}
    var fb='<button class="filter-btn'+(currentFilter==='all'?' active':'')+'" data-filter="all">All</button>'+'<button class="filter-btn'+(currentFilter==='visited'?' active':'')+'" data-filter="visited">Visited</button>'+'<button class="filter-btn'+(currentFilter==='unvisited'?' active':'')+'" data-filter="unvisited">Not Yet</button>';
    if(filterGroups){for(var fg=0;fg<filterGroups.length;fg++){var g=filterGroups[fg];fb+='<button class="filter-btn'+(currentFilter===g.key?' active':'')+'" data-filter="'+g.key+'">'+g.label+'</button>';}}
    var rows='';for(var r=0;r<items.length;r++){var it=items[r],isV=!!vs[it.id],cl=(travId&&category&&onToggle)?' data-item-id="'+it.id+'" style="cursor:pointer"':'';rows+='<li'+cl+'><span class="check'+(isV?' visited':'')+'>'+(isV?'&#10003;':'')+'</span><span class="item-name">'+labelFn(it)+'</span>'+(groupFn?'<span class="badge badge-info">'+groupFn(it)+'</span>':'')+'</li>';}
    if(!rows)rows='<li style="padding:1rem;color:var(--color-muted)">No items match.</li>';
    container.innerHTML='<div class="filter-bar"><input class="search-input" type="search" placeholder="Search..." value="'+searchTerm+'">'+fb+'</div>'+buildProgressBar(tv,masterList.length,travClass)+'<ul class="item-list" style="margin-top:1rem">'+rows+'</ul>';
    container.querySelector('.search-input').addEventListener('input',function(e){searchTerm=e.target.value.toLowerCase();renderList();});
    var btns=container.querySelectorAll('.filter-btn[data-filter]');for(var b=0;b<btns.length;b++){btns[b].addEventListener('click',function(){currentFilter=this.getAttribute('data-filter');renderList();});}
    if(travId&&category&&onToggle){var lis=container.querySelectorAll('li[data-item-id]');for(var li=0;li<lis.length;li++){lis[li].addEventListener('click',function(){var iid=this.getAttribute('data-item-id');if(iid){Store.toggle(travId,category,iid);onToggle(iid);renderList();}});}}
  }
  renderList();
}

function renderComparisonTable(opts) {
  var container=opts.container,masterList=opts.masterList,travellers=opts.travellers,
      category=opts.category,labelFn=opts.labelFn,groupFn=opts.groupFn||null,onToggle=opts.onToggle||null;
  var searchTerm='',currentFilter='all';
  function getFiltered(){var result=[];for(var i=0;i<masterList.length;i++){var item=masterList[i],ms=!searchTerm||labelFn(item).toLowerCase().indexOf(searchTerm)!==-1,mg=currentFilter==='all'||(groupFn&&groupFn(item)===currentFilter);if(ms&&mg)result.push(item);}return result;}
  function render(){
    var items=getFiltered(),groupSet={};if(groupFn){for(var gi=0;gi<masterList.length;gi++)groupSet[groupFn(masterList[gi])]=true;}
    var groups=Object.keys(groupSet).sort(),gBtns='';for(var gbi=0;gbi<groups.length;gbi++){var grp=groups[gbi];gBtns+='<button class="filter-btn'+(currentFilter===grp?' active':'')+'" data-filter="'+grp+'">'+grp+'</button>';}
    var thCols='';for(var thi=0;thi<travellers.length;thi++){thCols+='<th style="color:'+travellers[thi].color+'">'+travellers[thi].name+'</th>';}
    var rows='';for(var ri=0;ri<items.length;ri++){var item=items[ri],tdCols='';for(var tdi=0;tdi<travellers.length;tdi++){var tv=travellers[tdi],vis=Store.isVisited(tv.id,category,item.id),ca=onToggle?' data-trav="'+tv.id+'" data-iid="'+item.id+'" style="cursor:pointer"':'';tdCols+='<td><span class="dot '+(vis?'visited':'not-visited')+'"'+ca+'></span></td>';}rows+='<tr><td>'+labelFn(item)+'</td>'+(groupFn?'<td><span class="badge badge-info">'+groupFn(item)+'</span></td>':'')+tdCols+'</tr>';}
    if(!rows)rows='<tr><td colspan="'+(2+travellers.length)+'" style="text-align:center;color:var(--color-muted);padding:2rem">No items match.</td></tr>';
    container.innerHTML='<div class="filter-bar"><input class="search-input" type="search" placeholder="Search..." value="'+searchTerm+'"><button class="filter-btn'+(currentFilter==='all'?' active':'')+'" data-filter="all">All</button>'+gBtns+'</div><div style="overflow-x:auto"><table class="comparison-table"><thead><tr><th>'+category.charAt(0).toUpperCase()+category.slice(1)+'</th>'+(groupFn?'<th>Group</th>':'')+thCols+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
    container.querySelector('.search-input').addEventListener('input',function(e){searchTerm=e.target.value.toLowerCase();render();});
    var btns=container.querySelectorAll('.filter-btn[data-filter]');for(var bi=0;bi<btns.length;bi++){btns[bi].addEventListener('click',function(){currentFilter=this.getAttribute('data-filter');render();});}
    if(onToggle){var dots=container.querySelectorAll('.dot[data-trav]');for(var di=0;di<dots.length;di++){dots[di].addEventListener('click',function(){var tid=this.getAttribute('data-trav'),iid=this.getAttribute('data-iid');if(tid&&iid){Store.toggle(tid,category,iid);onToggle(tid,iid);render();}});}}
  }
  render();
}


/* ============================================================
   AUTH - Simple client-side password gate
   Password hash can be updated via GitHub secret or direct edit
   ============================================================ */
var _AUTH_HASH = '190ae5a26660093e48c27859b7ce9f92436bf1bfc4a0ab6dc175c842950c71f6';
var _AUTH_KEY  = 'utl_auth_v1';

function _sha256(str) {
  /* Simple SHA-256 using SubtleCrypto - returns Promise<hex string> */
  var buf = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', buf).then(function(hashBuf) {
    return Array.from(new Uint8Array(hashBuf))
      .map(function(b) { return b.toString(16).padStart(2,'0'); })
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
  /* Add or remove 'read-only' class on body */
  if (isAuthenticated()) {
    document.body.classList.remove('read-only');
  } else {
    document.body.classList.add('read-only');
  }
}

/* ============================================================
   SECTION 10 - LEGACY loadAllData
   ============================================================ */
function loadAllData(onRemote) {
  return Promise.all([
    fetchJSON('travellers.json'), fetchJSON('countries.json'), fetchJSON('animals.json'),
    fetchJSON('unesco.json'),     fetchJSON('travellist1.json'),
    fetchJSON('travellist2.json').catch(function(){ return []; })
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
    }

    /* Apply localStorage cache immediately for fast render */
    try {
      var raw = localStorage.getItem(_CACHE_KEY);
      if (raw) { _applyToTravellers(JSON.parse(raw)); }
    } catch(e) {}

    /* Then fetch from JSONBin and re-apply for accuracy */
    _fetchFullRecord().then(function(rec) {
      if (rec.visited) {
        _applyToTravellers(rec.visited);
        _cacheSave(rec.visited);
      }
      if (typeof onRemote === 'function') onRemote();
    }).catch(function() {
      if (typeof onRemote === 'function') onRemote();
    });

    return { travellers:travellers, countries:results[1], animals:results[2],
             unesco:results[3], tl1:results[4], tl2:results[5] };
  });
}


/* ============================================================
   AUTH - Simple client-side password gate
   Password hash can be updated via GitHub secret or direct edit
   ============================================================ */
var _AUTH_HASH = '190ae5a26660093e48c27859b7ce9f92436bf1bfc4a0ab6dc175c842950c71f6';
var _AUTH_KEY  = 'utl_auth_v1';

function _sha256(str) {
  /* Simple SHA-256 using SubtleCrypto - returns Promise<hex string> */
  var buf = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', buf).then(function(hashBuf) {
    return Array.from(new Uint8Array(hashBuf))
      .map(function(b) { return b.toString(16).padStart(2,'0'); })
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
  /* Add or remove 'read-only' class on body */
  if (isAuthenticated()) {
    document.body.classList.remove('read-only');
  } else {
    document.body.classList.add('read-only');
  }
}

/* ============================================================
   SECTION 11 - EXPORTS
   ============================================================ */
window.TravelApp = {
  Store:               Store,
  TripStore:           TripStore,
  fetchJSON:           fetchJSON,
  getRoot:             getRoot,
  loadAllData:         loadAllData,
  countVisited:        countVisited,
  pct:                 pct,
  buildProgressBar:    buildProgressBar,
  buildStatCard:       buildStatCard,
  renderNav:           renderNav,
  renderChecklist:     renderChecklist,
  renderComparisonTable: renderComparisonTable
};
