/*
  travel.js - Shared utilities for Ultimate Travel List
  Pure ES5 - no template literals, no destructuring.
*/

/* ---- DATA LOADING ---- */

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

function loadAllData() {
  var STORE_KEY = "utl_travellers";
  return Promise.all([
    fetchJSON('travellers.json'),
    fetchJSON('countries.json'),
    fetchJSON('animals.json'),
    fetchJSON('unesco.json'),
    fetchJSON('travellist1.json'),
    fetchJSON('travellist2.json').catch(function() { return []; })
  ]).then(function(results) {
    var travellers = results[0];
    // Merge any locally-saved visited data on top of the base JSON
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var local = JSON.parse(raw);
        var localMap = {};
        for (var i = 0; i < local.length; i++) localMap[local[i].id] = local[i];
        for (var j = 0; j < travellers.length; j++) {
          var t = travellers[j];
          var l = localMap[t.id];
          if (l) {
            t.countries   = l.countries   || [];
            t.capitals    = l.capitals    || [];
            t.animals     = l.animals     || [];
            t.unesco      = l.unesco      || [];
            t.travellist1 = l.travellist1 || [];
            t.travellist2 = l.travellist2 || [];
          }
        }
      }
    } catch (e) { /* localStorage unavailable or corrupt -- use JSON data as-is */ }
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


/* ---- PROGRESS HELPERS ---- */

function countVisited(traveller, category) {
     var visited = traveller[category] || [];
     return visited.length;
}

function pct(visited, total) {
     if (!total) return 0;
     return Math.round((visited / total) * 100);
}

/* ---- DOM BUILDERS ---- */

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

  var html = '<a class="nav-brand" href="' + root + 'index.html">&#9992; Travel Tracker</a>' +
    '<ul class="nav-menu">' +
      '<li class="nav-dropdown"><span class="nav-dropdown-label">Travel Lists <span class="caret">&#9660;</span></span><ul class="nav-submenu">' + listsHtml + '</ul></li>' +
      '<li class="nav-dropdown"><span class="nav-dropdown-label">Travellers <span class="caret">&#9660;</span></span><ul class="nav-submenu">' + travHtml + '</ul></li>' +
      '<li class="nav-dropdown"><span class="nav-dropdown-label">Analytics <span class="caret">&#9660;</span></span><ul class="nav-submenu">' + analyticsHtml + '</ul></li>' +
    '</ul>';

  var inner = document.querySelector('.site-nav .nav-inner');
  if (inner) { inner.innerHTML = html; }
}

/* ---- LIST RENDERERS ---- */

function renderChecklist(opts) {
     var container    = opts.container;
     var masterList   = opts.masterList;
     var visitedIds   = opts.visitedIds;
     var labelFn      = opts.labelFn;
     var filterGroups = opts.filterGroups || null;
     var groupFn      = opts.groupFn || null;
     var travClass    = opts.travClass || '';

  var visitedSet = {};
     for (var v = 0; v < visitedIds.length; v++) { visitedSet[visitedIds[v]] = true; }

  var currentFilter = 'all';
     var searchTerm = '';

  function getFiltered() {
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
         var items = getFiltered();
         var totalVisited = 0;
         for (var k = 0; k < masterList.length; k++) { if (visitedSet[masterList[k].id]) totalVisited++; }

       var fbtns = '<button class="filter-btn' + (currentFilter==='all'?' active':'') + '" data-filter="all">All</button>' +
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
                  rows += '<li>' +
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
                searchTerm = e.target.value.toLowerCase(); renderList();
       });
         var btns = container.querySelectorAll('.filter-btn[data-filter]');
         for (var b = 0; b < btns.length; b++) {
                  btns[b].addEventListener('click', function() { currentFilter = this.getAttribute('data-filter'); renderList(); });
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

  var sets = {};
     for (var ti = 0; ti < travellers.length; ti++) {
            var t = travellers[ti];
            sets[t.id] = {};
            var arr = t[category] || [];
            for (var ci = 0; ci < arr.length; ci++) { sets[t.id][arr[ci]] = true; }
     }

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
         if (groupFn) { for (var gi = 0; gi < masterList.length; gi++) groupSet[groupFn(masterList[gi])] = true; }
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
                             var vis = !!sets[tv.id][item.id];
                             tdCols += '<td><span class="dot ' + (vis?'visited':'not-visited') + '"></span></td>';
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
                searchTerm = e.target.value.toLowerCase(); render();
       });
         var btns = container.querySelectorAll('.filter-btn[data-filter]');
         for (var bi = 0; bi < btns.length; bi++) {
                  btns[bi].addEventListener('click', function() { currentFilter = this.getAttribute('data-filter'); render(); });
         }
  }

  render();
}

/* ---- EXPORTS ---- */

window.TravelApp = {
     loadAllData:           loadAllData,
     fetchJSON:             fetchJSON,
     getRoot:               getRoot,
     countVisited:          countVisited,
     pct:                   pct,
     buildProgressBar:      buildProgressBar,
     buildStatCard:         buildStatCard,
     renderNav:             renderNav,
     renderChecklist:       renderChecklist,
     renderComparisonTable: renderComparisonTable
};
