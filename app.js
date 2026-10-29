/* Task Board: a board view of Google Tasks.
   Tasks, lists, due dates, check-offs and order live in Google Tasks. Priority is a [P1]/[P2]/[P3] tag at the
   start of a task's notes. Board looks (list colors, card style, folded weeks) live in a small file in the
   app's private Google Drive folder, so they follow you between phone and computer. */
(function () {
  // The OAuth Client ID from Google Cloud (APIs & Services > Credentials). It is not a secret.
  var CLIENT_ID = '781490508547-lg8vamkljt03bjnho0up53u4ma08mo75.apps.googleusercontent.com';
  var APP_URL = 'https://rachelcol.github.io/Google-Task-App/';
  var SCOPES = 'https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/drive.appdata';
  var TASKS = 'https://tasks.googleapis.com/tasks/v1';
  var DRIVE = 'https://www.googleapis.com/drive/v3';
  var DRIVE_UP = 'https://www.googleapis.com/upload/drive/v3';
  var SETTINGS_FILE = 'board-settings.json';
  var DONE_DAYS = 30;
  // Google sends you back to exactly this address after sign-in, so it must match the one in Google Cloud
  var REDIRECT = location.hostname === 'rachelcol.github.io' ? APP_URL : location.origin + location.pathname.replace(/index\.html$/, '');

  var COLORS = ['slate', 'blue', 'green', 'amber', 'rose', 'violet'];
  var COLOR_NAMES = { slate: 'Slate', blue: 'Blue', green: 'Green', amber: 'Amber', rose: 'Rose', violet: 'Violet' };
  var PRI = { high: 'High', med: 'Medium', low: 'Low' };
  var PRI_RANK = { high: 0, med: 1, low: 2 };
  var PRI_TAG = { high: 1, med: 2, low: 3 };
  var PRI_COLS = [['none', 'No priority', 'slate'], ['high', 'High', 'rose'], ['med', 'Medium', 'yellow'], ['low', 'Low', 'green']];
  var NOTES = {
    lists: 'Each list is sorted by priority, High first, and then by due date, overdue first. Drag cards between lists (on a phone, press and hold a card first). Tap a card to edit it, or a list’s <strong>&middot;&middot;&middot;</strong> button to change how it looks.',
    priority: '<strong>Priority view.</strong> Each column is sorted by due date, overdue first. Drag a card to another column to change its priority, or drag it off the columns to clear it. “No priority” only appears when something needs sorting.',
    calendar: '<strong>Calendar view.</strong> Each day is sorted by priority, High first. Drag a card to another day to change its due date, or to “No due date” to clear it. Overdue tasks and tasks with no due date stay at the top in both Week and Month.'
  };
  var ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 6h14M5 12h14M5 18h9"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'
  };

  function isoOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today() { var d = new Date(); d.setHours(12, 0, 0, 0); return d; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function parseIso(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
  function fmt(d, o) { return d.toLocaleDateString(undefined, o); }
  var uid = function () { return Math.random().toString(36).slice(2, 9); };

  // Browser storage: only conveniences (last view, a copy of the board for a quick start, changes waiting to send)
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var state = { view: load('tb-view') || 'lists', sortByPriority: false, calMode: 'week', collapsedWeeks: {}, lists: [], tasks: [] };
  var phase = 'loading', gateMsg = '', defaultListId = null;
  var monthOffset = 0, monthsShown = 3, selectedDate = null, focusAdd = false, trayOpen = { over: false, nodate: false };
  var openDone = {};
  var addingIn = null;
  var weeks = 4;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Cards drawn before Google gave a new task its id still carry the stand-in id, so look both up
  function realId(id) { return idMap[id] || id; }
  function listById(id) { id = realId(id); return state.lists.find(function (l) { return l.id === id; }); }
  function taskById(id) { id = realId(id); return state.tasks.find(function (t) { return t.id === id; }); }
  function safeId(k) { return 'add-' + k.replace(/[^a-z0-9]/gi, '_'); }

  function save() {
    store('tb-view', state.view);
    if (phase === 'ready') store('tb-cache', { lists: state.lists, tasks: state.tasks, defaultListId: defaultListId });
    saveSettingsSoon();
  }

  /* ---------- Sign-in (Google OAuth, redirect flow so it also works from a home-screen app) ---------- */
  var auth = load('tb-auth');
  function tokenOk() { return !!(auth && auth.token && auth.exp > Date.now() + 60000); }
  function hasDrive() { return !!(auth && auth.scope && auth.scope.indexOf('drive.appdata') >= 0); }
  function signIn(silent) {
    if (!CLIENT_ID) return;
    flushSheet();
    var st = uid() + uid();
    store('tb-oauth', { state: st, silent: !!silent, at: Date.now() });
    var p = { client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: 'token', scope: SCOPES, include_granted_scopes: 'true', state: st };
    if (silent) p.prompt = 'none';
    location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(p).toString());
  }
  // Coming back from Google: the token (or an error) is in the address after the #
  function readRedirect() {
    var h = location.hash.slice(1);
    if (!/(^|&)(access_token|error)=/.test(h)) return;
    var p = new URLSearchParams(h), pending = load('tb-oauth') || {};
    history.replaceState(null, '', location.pathname + location.search);
    store('tb-oauth', null);
    if (!pending.state || p.get('state') !== pending.state) return;
    if (p.get('access_token')) {
      auth = { token: p.get('access_token'), exp: Date.now() + Number(p.get('expires_in') || 3600) * 1000, scope: p.get('scope') || '' };
      store('tb-auth', auth);
      store('tb-signed-in', true);
    } else if (!pending.silent || p.get('error') !== 'interaction_required') {
      gateMsg = p.get('error') === 'access_denied' ? 'Sign-in was cancelled. Try again whenever you’re ready.' : 'Google couldn’t sign you in (' + p.get('error') + ').';
    }
  }
  function signOut() {
    var tok = auth && auth.token;
    if (tok) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(tok), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(function () {});
    ['tb-auth', 'tb-signed-in', 'tb-cache', 'tb-queue', 'tb-idmap', 'tb-settings'].forEach(function (k) { store(k, null); });
    auth = null; queue = []; idMap = {};
    state.lists = []; state.tasks = [];
    phase = 'signin'; gateMsg = '';
    closeSheet(true); render();
  }
  // The token lasts an hour. When it runs out, Google can usually hand over a new one without asking anything.
  function needAuth() {
    paused = true; syncUi();
    var tried = load('tb-silent-at') || 0;
    if (document.visibilityState === 'visible' && !drag && !document.querySelector('.scrim') && Date.now() - tried > 120000) {
      store('tb-silent-at', Date.now());
      signIn(true);
    }
  }

  /* ---------- Talking to Google ---------- */
  function api(method, url, body, rawType) {
    if (!tokenOk()) return Promise.reject({ auth: true });
    var opt = { method: method, headers: { Authorization: 'Bearer ' + auth.token } };
    if (body !== undefined) {
      opt.headers['Content-Type'] = rawType || 'application/json';
      opt.body = rawType ? body : JSON.stringify(body);
    }
    return fetch(/^https:/.test(url) ? url : TASKS + url, opt).then(function (r) {
      if (r.status === 401) throw { auth: true };
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw { status: r.status, message: (j.error && j.error.message) || r.statusText }; });
      return r.status === 204 ? null : r.text().then(function (tx) { return tx ? JSON.parse(tx) : null; });
    }, function () { throw { offline: true }; });
  }
  async function getAll(url, key, maxPages) {
    var out = [], tok = '', n = 0;
    do {
      var r = await api('GET', url + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''));
      out = out.concat((r && r[key]) || []);
      tok = r && r.nextPageToken;
    } while (tok && ++n < (maxPages || 50));
    return out;
  }

  // Priority rides along in the notes as a tag, so it also shows (as text) in Google's own Tasks app
  var TAG_RE = /^\s*\[P([123])\][ \t]*\n?/;
  function splitNotes(raw) {
    raw = raw || '';
    var m = raw.match(TAG_RE);
    return m ? { priority: ['high', 'med', 'low'][m[1] - 1], notes: raw.slice(m[0].length) } : { priority: null, notes: raw };
  }
  function joinNotes(notes, priority) { return (priority ? '[P' + PRI_TAG[priority] + ']' + (notes ? '\n' : '') : '') + (notes || ''); }

  function fromGoogle(g, listId) {
    var n = splitNotes(g.notes), em = (g.links || []).find(function (l) { return l.type === 'email'; });
    return {
      id: g.id, listId: listId, title: g.title || '', priority: n.priority, notes: n.notes,
      due: g.due ? g.due.slice(0, 10) : '', done: g.status === 'completed',
      email: em ? { subject: em.description || 'Email', link: em.link } : null,
      parent: g.parent || null, pos: g.position || '', web: g.webViewLink || ''
    };
  }
  function toGoogle(t) {
    var g = { title: t.title, notes: joinNotes(t.notes, t.priority), status: t.done ? 'completed' : 'needsAction' };
    if (t.due) g.due = t.due + 'T00:00:00.000Z';
    return g;
  }

  async function fetchBoard() {
    var lists = await getAll('/users/@me/lists?maxResults=100', 'items');
    var def = await api('GET', '/users/@me/lists/@default').catch(function () { return lists[0]; });
    var since = new Date(Date.now() - DONE_DAYS * 86400000).toISOString();
    var per = await Promise.all(lists.map(function (l) {
      var base = '/lists/' + encodeURIComponent(l.id) + '/tasks?maxResults=100';
      return Promise.all([
        getAll(base + '&showCompleted=false', 'items'),
        getAll(base + '&showCompleted=true&showHidden=true&completedMin=' + encodeURIComponent(since), 'items', 3)
      ]).then(function (r) {
        var seen = {}, out = [];
        r[0].concat(r[1]).forEach(function (g) { if (!seen[g.id] && !g.deleted) { seen[g.id] = 1; out.push(g); } });
        // Google's own order: top-level tasks by position, each followed by its subtasks
        var tops = out.filter(function (g) { return !g.parent; }).sort(byPos);
        var kids = out.filter(function (g) { return g.parent; }).sort(byPos);
        var ordered = [];
        tops.forEach(function (g) { ordered.push(g); kids.forEach(function (k) { if (k.parent === g.id) ordered.push(k); }); });
        kids.forEach(function (k) { if (ordered.indexOf(k) < 0) ordered.push(k); });
        return ordered.map(function (g) { return fromGoogle(g, l.id); });
      });
    }));
    // My Tasks (the list Gmail adds to) always comes first
    var defId = def && def.id;
    var order = lists.slice().sort(function (a, b) { return (b.id === defId) - (a.id === defId); });
    return {
      defaultListId: defId,
      lists: order.map(function (l) { return { id: l.id, title: l.title }; }),
      tasks: [].concat.apply([], order.map(function (l) { return per[lists.indexOf(l)]; }))
    };
  }
  function byPos(a, b) { return (a.position || '') < (b.position || '') ? -1 : (a.position || '') > (b.position || '') ? 1 : 0; }

  // Put Google's lists and tasks on the board, with the colors and styles from the settings file
  function applyBoard(b, settings) {
    defaultListId = b.defaultListId;
    var looks = (settings && settings.lists) || {};
    state.lists = b.lists.map(function (l, i) {
      var old = state.lists.find(function (x) { return x.id === l.id; }) || {}, s = looks[l.id] || {};
      return { id: l.id, title: l.title, color: s.color || old.color || (l.id === defaultListId ? 'blue' : COLORS[(i + 1) % COLORS.length]), compact: s.compact != null ? !!s.compact : !!old.compact };
    });
    state.tasks = b.tasks;
    if (settings) {
      if (settings.sortByPriority != null) state.sortByPriority = !!settings.sortByPriority;
      if (settings.calMode) state.calMode = settings.calMode;
      if (settings.collapsedWeeks) state.collapsedWeeks = settings.collapsedWeeks;
    }
  }

  var lastLoad = 0, loading = false;
  async function refresh(quiet) {
    if (loading || phase === 'signin' || phase === 'setup') return;
    if (queue.length) { refreshAfterQueue = true; return; }
    loading = true; syncUi();
    try {
      var r = await Promise.all([fetchBoard(), loadSettings()]);
      if (queue.length) { refreshAfterQueue = true; return; }
      applyBoard(r[0], r[1]);
      phase = 'ready'; lastLoad = Date.now();
      save();
      if (drag || document.querySelector('.scrim')) needRender = true; else render();
    } catch (e) {
      if (e.auth) return needAuth();
      if (phase !== 'ready') { phase = 'error'; gateMsg = e.offline ? 'You seem to be offline. Your board will load when you’re back online.' : 'Google Tasks didn’t answer (' + (e.message || 'error') + ').'; render(); }
      else if (!quiet) toast(e.offline ? 'You’re offline. Showing your last saved board.' : 'Couldn’t refresh from Google: ' + (e.message || 'error'));
    } finally { loading = false; syncUi(); }
  }

  /* ---------- Changes waiting to go to Google, sent one at a time in order ---------- */
  // Saved in the browser, so nothing is lost if the page closes or sign-in needs renewing midway
  var queue = load('tb-queue') || [], idMap = load('tb-idmap') || {};
  var pumping = false, paused = false, refreshAfterQueue = false, needRender = false, retryTimer = null;
  function persistQueue() { store('tb-queue', queue); store('tb-idmap', idMap); }
  function enqueue(op) { queue.push(op); persistQueue(); syncUi(); pump(); }
  function swapIds(s) { return s.replace(/tmp_[a-z0-9]+/g, function (m) { return idMap[m] || m; }); }
  async function pump() {
    if (pumping || paused) return;
    pumping = true; syncUi();
    while (queue.length) {
      var op = queue[0];
      var url = swapIds(op.u), body = op.b === undefined ? undefined : JSON.parse(swapIds(JSON.stringify(op.b)));
      // Something this change depends on never reached Google, so skip it
      if (/tmp_[a-z0-9]+/.test(url) || (body && /tmp_[a-z0-9]+/.test(JSON.stringify(body)))) { queue.shift(); persistQueue(); continue; }
      try {
        var res = await api(op.m, url, body);
        if (op.tmp && res && res.id) gotId(op.tmp, res);
        queue.shift(); persistQueue();
      } catch (e) {
        if (e.auth) { pumping = false; return needAuth(); }
        if (e.offline) { pumping = false; syncUi(); clearTimeout(retryTimer); retryTimer = setTimeout(pump, 8000); return; }
        // If Google won't place it after the task above, send it again without a place (the board sorts it anyway)
        if (op.plain && op.u !== op.plain) { op.u = op.plain; persistQueue(); continue; }
        // A reorder Google won't do isn't worth a warning; the board's own order still stands
        if (op.skippable) { queue.shift(); persistQueue(); continue; }
        queue.shift(); persistQueue();
        toast((op.what ? 'Google didn’t accept that change (' + op.what + '): ' : 'Google didn’t accept that change: ') + (e.message || 'error'));
        refreshAfterQueue = true;
      }
    }
    pumping = false; syncUi();
    if (refreshAfterQueue) { refreshAfterQueue = false; refresh(true); }
  }
  // Google gave a new task or list its real id: swap it in everywhere
  function gotId(tmp, res) {
    idMap[tmp] = res.id;
    var t = state.tasks.find(function (x) { return x.id === tmp; });
    if (t) { t.id = res.id; t.pos = res.position || ''; t.web = res.webViewLink || ''; }
    var l = state.lists.find(function (x) { return x.id === tmp; });
    if (l) {
      l.id = res.id;
      state.tasks.forEach(function (x) { if (x.listId === tmp) x.listId = res.id; });
      if (openDone[tmp]) openDone[res.id] = true;
    }
    save();
  }

  function fields(t) { return { listId: t.listId, title: t.title, notes: t.notes, priority: t.priority, due: t.due, done: t.done, prev: prevSibling(t) }; }
  // The open task just above this one in its list (Google places tasks after a "previous" task, which can't be a checked-off one)
  function prevSibling(t) {
    var i = state.tasks.indexOf(t);
    for (var j = i - 1; j >= 0; j--) { var x = state.tasks[j]; if (x.listId === t.listId && !x.parent && !x.done) return x.id; }
    return null;
  }
  function moveQuery(t, toList, noPlace) {
    var q = [];
    if (toList) q.push('destinationTasklist=' + toList);
    var p = !noPlace && prevSibling(t);
    if (p) q.push('previous=' + p);
    return q.length ? '?' + q.join('&') : '';
  }
  // Send Google whatever changed on a task since "b" (a copy made with fields())
  function commit(t, b, reorder) {
    if (b.listId !== t.listId) {
      enqueue({ m: 'POST', u: '/lists/' + b.listId + '/tasks/' + t.id + '/move' + moveQuery(t, t.listId), plain: '/lists/' + b.listId + '/tasks/' + t.id + '/move' + moveQuery(t, t.listId, true), what: 'moving “' + t.title + '”' });
      t.parent = null;
    } else if (reorder && !t.parent && prevSibling(t) !== b.prev) {
      enqueue({ m: 'POST', u: '/lists/' + t.listId + '/tasks/' + t.id + '/move' + moveQuery(t), skippable: true, what: 'reordering' });
    }
    var patch = {}, any = false;
    if (t.title !== b.title) { patch.title = t.title; any = true; }
    if (t.notes !== b.notes || t.priority !== b.priority) { patch.notes = joinNotes(t.notes, t.priority); any = true; }
    if (t.due !== b.due) { patch.due = t.due ? t.due + 'T00:00:00.000Z' : null; any = true; }
    if (t.done !== b.done) { patch.status = t.done ? 'completed' : 'needsAction'; if (!t.done) patch.completed = null; any = true; }
    if (any) enqueue({ m: 'PATCH', u: '/lists/' + t.listId + '/tasks/' + t.id, b: patch, what: '“' + t.title + '”' });
  }
  function changed(a, b) { return ['listId', 'title', 'notes', 'priority', 'due', 'done'].some(function (k) { return a[k] !== b[k]; }); }
  function insertTask(t) {
    // No place is given: Google puts it at the top of the list, and the board sorts it by date anyway
    t.id = 'tmp_' + uid();
    enqueue({ m: 'POST', u: '/lists/' + t.listId + '/tasks', b: toGoogle(t), tmp: t.id, what: 'adding “' + t.title + '”' });
  }
  function deleteTask(t) {
    var i = state.tasks.indexOf(t), copy = Object.assign({}, t);
    state.tasks.splice(i, 1);
    enqueue({ m: 'DELETE', u: '/lists/' + t.listId + '/tasks/' + t.id, what: 'deleting “' + t.title + '”' });
    save(); render();
    // Undo adds it back as a new task (Google can't restore the Gmail link on a re-added task)
    toast('Task deleted', function () {
      var back = Object.assign(copy, { email: null, parent: null });
      state.tasks.splice(Math.min(i, state.tasks.length), 0, back);
      insertTask(back); save(); render();
    });
  }
  // Put a task back the way it was before a change
  function undoTo(t, b, index) {
    var now = fields(t);
    Object.assign(t, { listId: b.listId, title: b.title, notes: b.notes, priority: b.priority, due: b.due, done: b.done });
    if (index != null) { state.tasks.splice(state.tasks.indexOf(t), 1); state.tasks.splice(Math.min(index, state.tasks.length), 0, t); }
    commit(t, now, index != null);
    save(); render();
  }

  /* ---------- Board looks, kept in the app's private Google Drive folder ---------- */
  var settingsFileId = null, lastSettings = null, settingsTimer = null, driveOff = false;
  function settingsNow() {
    var looks = {};
    state.lists.forEach(function (l) { looks[l.id] = { color: l.color, compact: !!l.compact }; });
    return { v: 1, lists: looks, sortByPriority: !!state.sortByPriority, calMode: state.calMode, collapsedWeeks: state.collapsedWeeks || {} };
  }
  async function loadSettings() {
    var local = load('tb-settings');
    if (!hasDrive() || driveOff) return local;
    try {
      var r = await api('GET', DRIVE + '/files?spaces=appDataFolder&fields=files(id,name)&q=' + encodeURIComponent("name='" + SETTINGS_FILE + "'"));
      var f = r && r.files && r.files[0];
      if (!f) return local;
      settingsFileId = f.id;
      var s = await api('GET', DRIVE + '/files/' + f.id + '?alt=media');
      lastSettings = JSON.stringify(s);
      store('tb-settings', s);
      return s;
    } catch (e) {
      if (e.auth) throw e;
      // Drive turned off or not allowed: keep looks in this browser instead
      if (e.status === 403 || e.status === 404) driveOff = true;
      return local;
    }
  }
  function saveSettingsSoon() {
    if (phase !== 'ready') return;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(saveSettings, 1200);
  }
  async function saveSettings() {
    var s = settingsNow(), json = JSON.stringify(s);
    if (state.lists.some(function (l) { return /^tmp_/.test(l.id); })) return saveSettingsSoon();
    store('tb-settings', s);
    if (json === lastSettings || !hasDrive() || driveOff) return;
    try {
      if (settingsFileId) await api('PATCH', DRIVE_UP + '/files/' + settingsFileId + '?uploadType=media', json, 'application/json');
      else {
        var bd = 'tb' + uid();
        var body = '--' + bd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: SETTINGS_FILE, parents: ['appDataFolder'] }) +
          '\r\n--' + bd + '\r\nContent-Type: application/json\r\n\r\n' + json + '\r\n--' + bd + '--';
        var r = await api('POST', DRIVE_UP + '/files?uploadType=multipart&fields=id', body, 'multipart/related; boundary=' + bd);
        settingsFileId = r && r.id;
      }
      lastSettings = json;
    } catch (e) {
      if (e.status === 403) driveOff = true;
      else if (e.offline) saveSettingsSoon();
    }
  }

  /* ---------- Sorting and drawing the board ---------- */
  function dueInfo(d) {
    if (!d) return null;
    var due = parseIso(d), now = today();
    var diff = Math.round((due - now) / 86400000);
    var label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : fmt(due, { weekday: 'short', month: 'short', day: 'numeric' });
    return { label: label, cls: diff < 0 ? 'overdue' : diff === 0 ? 'today' : '' };
  }

  function byPriority(arr) {
    return arr.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) {
      var ra = a.t.priority ? PRI_RANK[a.t.priority] : 3, rb = b.t.priority ? PRI_RANK[b.t.priority] : 3;
      return ra - rb || a.i - b.i;
    }).map(function (x) { return x.t; });
  }
  // Earliest due date first (overdue first), undated last; same date goes by priority, then the order you dragged them into
  function byDue(arr) {
    return arr.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) {
      var da = a.t.due || '9999-99-99', db = b.t.due || '9999-99-99';
      if (da !== db) return da < db ? -1 : 1;
      var ra = a.t.priority ? PRI_RANK[a.t.priority] : 3, rb = b.t.priority ? PRI_RANK[b.t.priority] : 3;
      return ra - rb || a.i - b.i;
    }).map(function (x) { return x.t; });
  }
  // Lists view: High, Medium, Low, then no priority; within each, earliest due date first (overdue first), undated last
  function byPriorityThenDue(arr) {
    return arr.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) {
      var ra = a.t.priority ? PRI_RANK[a.t.priority] : 3, rb = b.t.priority ? PRI_RANK[b.t.priority] : 3;
      if (ra !== rb) return ra - rb;
      var da = a.t.due || '9999-99-99', db = b.t.due || '9999-99-99';
      return da < db ? -1 : da > db ? 1 : a.i - b.i;
    }).map(function (x) { return x.t; });
  }
  function openTasks(listId) {
    var arr = state.tasks.filter(function (t) { return t.listId === listId && !t.done; });
    return byPriorityThenDue(arr);
  }

  // mode: 'list' (priority chip), 'pri' (list name), 'cal' (priority + list, no date), 'over' (all)
  function cardHTML(t, mode) {
    mode = mode || 'list';
    var di = dueInfo(t.due), l = listById(t.listId), meta = '';
    if (mode !== 'pri') {
      if (t.priority) meta += '<button type="button" class="chip ' + t.priority + '" data-act="cycle" title="Change priority">' + PRI[t.priority] + '</button>';
      else if (!t.done && mode === 'list') meta += '<button type="button" class="chip none" data-act="cycle" title="Set priority">Priority</button>';
    }
    if (mode !== 'list' && l) meta += '<span class="list-tag" style="color:var(--' + l.color + ')">' + esc(l.title) + '</span>';
    if (di && mode !== 'cal') meta += '<span class="due ' + (t.done ? '' : di.cls) + '">' + ICON.cal + esc(di.label) + '</span>';
    if (t.notes && mode !== 'cal') meta += '<span class="notes-mark" title="Has notes">' + ICON.notes + '</span>';
    if (t.email) meta += '<a class="email" data-act="email" href="' + esc(t.email.link) + '" target="_blank" rel="noopener" title="Open email in Gmail">' + ICON.mail + (mode === 'cal' ? '' : '<span class="email-from">Open email</span>') + '</a>';
    return '<div class="card' + (t.done ? ' done' : '') + '" data-id="' + t.id + '" data-p="' + (t.priority || '') + '" tabindex="0" role="button" aria-label="' + esc(t.title) + '">' +
      '<button type="button" class="check" data-act="toggle" aria-label="' + (t.done ? 'Mark not done' : 'Mark done') + '">' + ICON.check + '</button>' +
      '<div class="title">' + esc(t.title || 'Untitled task') + '</div>' +
      (meta ? '<div class="meta">' + meta + '</div>' : '') + '</div>';
  }

  function addRow(key, label) {
    return '<div class="add-row"><button type="button" class="add-btn" data-act="add">' + ICON.plus + (label || 'Add a task') + '</button></div>';
  }

  function renderLists() {
    var html = '';
    state.lists.forEach(function (l) {
      var open = openTasks(l.id);
      var done = state.tasks.filter(function (t) { return t.listId === l.id && t.done; });
      html += '<section class="column' + (l.compact ? ' compact' : '') + '" data-zone="list:' + l.id + '" data-list="' + l.id + '" data-color="' + l.color + '">' +
        '<div class="col-head"><h2>' + esc(l.title) + '</h2><span class="count">' + open.length + '</span>' +
        '<button type="button" class="icon-btn" data-act="listmenu" aria-label="List settings for ' + esc(l.title) + '">' + ICON.dots + '</button></div>' +
        '<div class="cards">' + open.map(function (t) { return cardHTML(t, 'list'); }).join('') + '</div>' +
        addRow('list:' + l.id) +
        (done.length ? '<button type="button" class="done-toggle" data-act="toggle-done" aria-expanded="' + (!!openDone[l.id]) + '">' + ICON.chev + 'Completed (' + done.length + ')</button>' +
          (openDone[l.id] ? '<div class="cards done-cards">' + done.map(function (t) { return cardHTML(t, 'list'); }).join('') + '</div>' : '') : '') +
        '</section>';
    });
    return html + '<div class="new-col"><button type="button" class="add-btn" data-act="newlist">' + ICON.plus + 'Add another list</button></div>';
  }

  function renderPriority() {
    return PRI_COLS.map(function (p) {
      var tasks = byDue(state.tasks.filter(function (t) { return !t.done && (t.priority || 'none') === p[0]; }));
      if (p[0] === 'none' && !tasks.length) return '';
      return '<section class="column" data-zone="pri:' + p[0] + '" data-color="' + p[2] + '">' +
        '<div class="col-head"><h2>' + p[1] + '</h2><span class="count">' + tasks.length + '</span></div>' +
        '<div class="cards">' + tasks.map(function (t) { return cardHTML(t, 'pri'); }).join('') + '</div>' +
        addRow('pri:' + p[0]) + '</section>';
    }).join('');
  }

  function firstOfMonth() { var n = today(); return new Date(n.getFullYear(), n.getMonth() + monthOffset, 1, 12); }
  function renderCalendar() {
    var month = state.calMode === 'month', first = firstOfMonth();
    var bar = '<div class="cal-bar"><div class="views small" role="group" aria-label="Calendar range">' +
      '<button type="button" data-act="calmode" data-mode="week" aria-pressed="' + !month + '">Week</button>' +
      '<button type="button" data-act="calmode" data-mode="month" aria-pressed="' + month + '">Month</button></div>' +
      '</div>';
    return bar + (month ? renderMonth(first) : renderWeeks());
  }
  function miniHTML(t, showDate) {
    var date = showDate && t.due ? '<span class="mini-date">' + esc(fmt(parseIso(t.due), { month: 'short', day: 'numeric' })) + '</span> ' : '';
    return '<div class="card mini" data-id="' + t.id + '" data-p="' + (t.priority || '') + '" tabindex="0" role="button" aria-label="' + esc(t.title) + '"><div class="title">' + date + esc(t.title || 'Untitled task') + '</div></div>';
  }
  // On phones these two boxes fold up (closed to start); on computers they always stay open
  function trayHead(key, name, n) {
    return '<button type="button" class="col-head tray-toggle" data-act="tray" data-tray="' + key + '" aria-expanded="' + !!trayOpen[key] + '"><h2>' + name + '</h2><span class="count">' + n + '</span><span class="chev">' + ICON.chev + '</span></button>';
  }
  // Shared top of both calendar layouts: overdue tasks and undated tasks
  function calTop(open, todayIso) {
    var over = open.filter(function (t) { return t.due && t.due < todayIso; }).sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
    var undated = open.filter(function (t) { return !t.due; });
    return '<div class="cal-top">' +
      '<section class="zone tray' + (trayOpen.over ? '' : ' collapsed') + '" data-noph data-zone="nodrop" data-color="rose">' + trayHead('over', 'Overdue', over.length) +
      '<div class="cards">' + over.map(function (t) { return miniHTML(t, true); }).join('') + '</div>' + (over.length ? '' : '<p class="empty-note">Nothing overdue.</p>') + '</section>' +
      '<section class="zone tray' + (trayOpen.nodate ? '' : ' collapsed') + '" data-noph data-zone="date:" data-color="slate">' + trayHead('nodate', 'No due date', undated.length) +
      '<div class="cards">' + undated.map(function (t) { return miniHTML(t); }).join('') + '</div>' + (undated.length ? '' : '<p class="empty-note">Every task has a date.</p>') + '</section></div>';
  }
  function renderMonth(first) {
    var todayIso = isoOf(today()), m = first.getMonth();
    var open = state.tasks.filter(function (t) { return !t.done; });
    // A pop-up with the tapped day's tasks, full size, ready to drag onto other days
    var sel = selectedDate, selTasks = byPriority(open.filter(function (t) { return t.due === sel; }));
    var onDate = !sel ? '' : '<section class="zone on-date" data-noph data-zone="date:' + sel + '" data-color="blue" aria-label="Tasks on this date"><div class="col-head"><h2>' + fmt(parseIso(sel), { weekday: 'long', month: 'short', day: 'numeric' }) + '</h2><span class="count">' + selTasks.length + '</span>' +
      '<button type="button" class="icon-btn" data-act="close-pop" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="cards">' + selTasks.map(function (t) { return cardHTML(t, 'cal'); }).join('') + '</div>' +
      (selTasks.length ? '' : '<p class="empty-note">Nothing due this day.</p>') + '</section>';
    var html = calTop(open, todayIso) + onDate;
    // Months stack top to bottom; days outside each month are left blank so no day appears twice.
    // The first month starts at this week's Monday; earlier days are left out (overdue tasks are in the box above).
    var thisMon = mondayOf(today());
    for (var k = 0; k < monthsShown; k++) {
      var f = new Date(first.getFullYear(), m + k, 1, 12), mm = f.getMonth();
      var st = k === 0 && thisMon > f ? thisMon : mondayOf(f), endI = isoOf(addDays(mondayOf(new Date(f.getFullYear(), mm + 1, 0, 12)), 6));
      html += '<section class="month"><h2 class="month-name">' + fmt(f, { month: 'long', year: 'numeric' }) + '</h2><div class="month-grid">';
      for (var i = 0; i < 7; i++) html += '<div class="dow">' + fmt(addDays(st, i), { weekday: 'short' }) + '</div>';
      for (var d = st; isoOf(d) <= endI; d = addDays(d, 1)) {
        var di = isoOf(d);
        if (d.getMonth() !== mm) { html += '<div class="mcell-blank"></div>'; continue; }
        // Earlier days of this week: grayed out, nothing to add or drop there
        if (di < todayIso) { html += '<div class="day mcell gone" data-zone="nodrop" aria-hidden="true"><div class="day-head"><span class="num">' + d.getDate() + '</span></div></div>'; continue; }
        var tasks = byPriority(open.filter(function (t) { return t.due === di; }));
        html += '<div class="day mcell' + (di === todayIso ? ' today' : '') + (di === sel ? ' selected' : '') + '" data-noph data-act="selday" data-zone="date:' + di + '">' +
          '<div class="day-head"><span class="num">' + d.getDate() + '</span><button type="button" class="day-add" data-act="dayadd" aria-label="Add a task on ' + esc(fmt(d, { month: 'long', day: 'numeric' })) + '">' + ICON.plus + '</button></div>' +
          '<div class="cards">' + tasks.map(function (t) { return miniHTML(t); }).join('') + '</div></div>';
      }
      html += '</div></section>';
    }
    return html + '<button type="button" class="btn more-weeks" data-act="month-more">' + ICON.plus + 'Show another month</button>';
  }
  function renderWeeks() {
    var now = today(), todayIso = isoOf(now), mon = mondayOf(now);
    var open = state.tasks.filter(function (t) { return !t.done; });
    var html = calTop(open, todayIso);
    for (var w = 0; w < weeks; w++) {
      var start = addDays(mon, w * 7), end = addDays(start, 6);
      var name = w === 0 ? 'This week' : w === 1 ? 'Next week' : 'Week of ' + fmt(start, { month: 'short', day: 'numeric' });
      var wk = isoOf(start), endWk = isoOf(end), folded = !!(state.collapsedWeeks || {})[wk];
      var from = w === 0 ? todayIso : wk;
      var inWeek = open.filter(function (t) { return t.due && t.due >= from && t.due <= endWk; }).length;
      html += '<section class="week"><h2><button type="button" class="week-toggle" data-act="week" data-week="' + wk + '" aria-expanded="' + !folded + '">' + ICON.chev + name +
        '<span class="range">' + fmt(w === 0 ? now : start, { month: 'short', day: 'numeric' }) + ' – ' + fmt(end, { month: 'short', day: 'numeric' }) + '</span>' +
        (folded ? '<span class="range">&middot; ' + inWeek + ' task' + (inWeek === 1 ? '' : 's') + '</span>' : '') + '</button></h2><div class="days"' + (folded ? ' hidden' : '') + '>';
      // This week starts at today; on computers today still sits under its own weekday
      for (var i = w === 0 ? (now.getDay() + 6) % 7 : 0; i < 7; i++) {
        var d = addDays(start, i), di = isoOf(d);
        var tasks = byPriority(open.filter(function (t) { return t.due === di; }));
        html += '<div class="day' + (di === todayIso ? ' today' : '') + '" data-zone="date:' + di + '"' + (di === todayIso ? ' style="--col:' + (i + 1) + '"' : '') + '>' +
          '<div class="day-head">' + fmt(d, { weekday: 'short' }) + ' <span class="num">' + d.getDate() + '</span>' + (di === todayIso ? '<span class="today-tag">Today</span>' : '') + '</div>' +
          '<div class="cards">' + tasks.map(function (t) { return cardHTML(t, 'cal'); }).join('') + '</div>' + addRow('date:' + di, 'Add') + '</div>';
      }
      html += '</div></section>';
    }
    var lastIso = isoOf(addDays(mon, weeks * 7 - 1));
    var later = open.filter(function (t) { return t.due && t.due > lastIso; }).length;
    html += '<button type="button" class="btn more-weeks" data-act="more-weeks">' + ICON.plus + 'Show another week' + (later ? ' (' + later + ' task' + (later > 1 ? 's' : '') + ' due later)' : '') + '</button>';
    return html;
  }

  // Before the board is ready: the sign-in screen, a loading note, or a problem
  function renderGate() {
    if (phase === 'setup') return '<section class="welcome"><h2>Almost ready</h2><p>This board still needs its Google sign-in key. Put the OAuth Client ID into <code>CLIENT_ID</code> at the top of <code>app.js</code>.</p></section>';
    if (phase === 'loading') return '<section class="welcome"><h2>Loading your tasks…</h2><p>Getting your lists from Google Tasks.</p></section>';
    if (phase === 'error') return '<section class="welcome"><h2>Couldn’t load your board</h2><p class="gate-msg">' + esc(gateMsg) + '</p><button type="button" class="btn primary big" data-act="retry">Try again</button></section>';
    return '<section class="welcome"><h2>Your Google Tasks, as a board</h2>' +
      '<p>Sign in with the Google account whose tasks you want to see. Your tasks stay in Google Tasks; this board shows them and saves your changes back there.</p>' +
      (gateMsg ? '<p class="gate-msg">' + esc(gateMsg) + '</p>' : '') +
      '<button type="button" class="btn primary big" data-act="signin">Sign in with Google</button></section>';
  }

  var board = document.getElementById('board');
  function render() {
    hideTip();
    needRender = false;
    var ready = phase === 'ready';
    document.getElementById('tools').hidden = !ready;
    document.getElementById('note').hidden = !ready;
    if (!ready) { board.className = 'board gate'; board.innerHTML = renderGate(); syncUi(); return; }
    var sl = board.scrollLeft, v = state.view;
    board.className = v === 'calendar' ? 'cal' + (state.calMode === 'month' && selectedDate ? ' has-pop' : '') : 'board';
    board.innerHTML = v === 'priority' ? renderPriority() : v === 'calendar' ? renderCalendar() : renderLists();
    board.scrollLeft = sl;
    document.getElementById('note').innerHTML = NOTES[v];
    document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === v)); });
    focusAdd = false;
    syncUi();
  }

  // The little label next to the title: saving, offline, or sign-in needed
  function syncUi() {
    var pill = document.getElementById('syncPill');
    if (phase !== 'ready') { pill.hidden = true; return; }
    var st = '', label = '';
    if (paused) { st = 'warn'; label = 'Tap to reconnect'; }
    else if (queue.length && !navigator.onLine) { st = 'warn'; label = 'Offline, will save'; }
    else if (queue.length || pumping) { st = 'busy'; label = 'Saving…'; }
    else if (loading) { st = 'busy'; label = 'Refreshing…'; }
    else label = 'Saved';
    pill.hidden = false; pill.dataset.state = st; pill.textContent = label;
  }
  document.getElementById('syncPill').onclick = function () { if (paused) { store('tb-silent-at', Date.now()); signIn(true); } };

  var toastTimer;
  function toast(msg, undo) {
    var layer = document.getElementById('layer');
    var old = layer.querySelector('.toast'); if (old) old.remove();
    clearTimeout(toastTimer);
    var el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button">Undo</button>' : '');
    if (undo) el.querySelector('button').onclick = function () { undo(); el.remove(); };
    layer.appendChild(el);
    toastTimer = setTimeout(function () { el.remove(); }, 4500);
  }

  function toggleTask(t) {
    var before = fields(t);
    t.done = !t.done;
    commit(t, before);
    save(); render();
    toast(t.done ? 'Checked off “' + t.title + '”' : 'Moved back to the list', function () { undoTo(t, before); });
  }
  function cycle(t) {
    var before = fields(t), order = [null, 'high', 'med', 'low'];
    t.priority = order[(order.indexOf(t.priority) + 1) % order.length];
    commit(t, before);
    save(); render();
  }

  document.querySelectorAll('[data-view]').forEach(function (b) {
    b.onclick = function () { state.view = b.dataset.view; addingIn = null; save(); board.scrollLeft = 0; render(); };
  });

  board.addEventListener('click', function (e) {
    if (suppressClick) { e.preventDefault(); return; }
    var actEl = e.target.closest('[data-act]');
    var zone = e.target.closest('[data-zone]');
    var zkey = zone && zone.dataset.zone;
    var listId = zone && zone.dataset.list && realId(zone.dataset.list);
    var card = e.target.closest('.card');
    var t = card && taskById(card.dataset.id);
    var act = actEl && actEl.dataset.act;
    if (act === 'signin') { store('tb-silent-at', null); return signIn(false); }
    if (act === 'retry') { phase = 'loading'; render(); return refresh(); }
    if (act === 'toggle' && t) return toggleTask(t);
    if (act === 'cycle' && t) return cycle(t);
    if (act === 'email') return;
    if (act === 'add') return openNewTaskSheet(zkey);
    if (act === 'toggle-done') { openDone[listId] = !openDone[listId]; return render(); }
    if (act === 'listmenu') return openListSheet(listById(listId));
    if (act === 'more-weeks') { weeks++; return render(); }
    if (act === 'calmode') { state.calMode = actEl.dataset.mode; addingIn = null; save(); return render(); }
    if (act === 'month-more') { monthsShown++; return render(); }
    if (act === 'week') {
      state.collapsedWeeks = state.collapsedWeeks || {};
      var wkKey = actEl.dataset.week;
      if (state.collapsedWeeks[wkKey]) delete state.collapsedWeeks[wkKey]; else state.collapsedWeeks[wkKey] = true;
      save(); return render();
    }
    if (act === 'dayadd') return openNewTaskSheet(zkey);
    if (act === 'close-pop') { selectedDate = null; return render(); }
    if (act === 'tray') {
      if (window.innerWidth > 600) return;
      trayOpen[actEl.dataset.tray] = !trayOpen[actEl.dataset.tray]; return render();
    }
    if (act === 'selday') {
      if (t && window.innerWidth > 600) return openTaskSheet(t);
      var picked = zkey.slice(5);
      selectedDate = selectedDate === picked ? null : picked; addingIn = null; return render();
    }
    if (act === 'newlist') {
      var nl = { id: 'tmp_' + uid(), title: 'New list', color: COLORS[state.lists.length % COLORS.length], compact: false };
      state.lists.push(nl); save(); render();
      board.scrollLeft = board.scrollWidth;
      return openListSheet(nl, true);
    }
    if (card && t) openTaskSheet(t);
  });
  board.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) { e.preventDefault(); var t = taskById(e.target.dataset.id); if (t) openTaskSheet(t); }
  });

  document.getElementById('menuBtn').onclick = openMenu;

  /* ---------- Pop-up sheets ---------- */
  // Each sheet can have a "flush" that sends its edits to Google; it runs when the sheet closes or the app goes to the background
  var sheetFlush = null;
  function flushSheet() { if (sheetFlush) sheetFlush(); }
  function closeSheet(skipFlush) {
    if (!skipFlush) flushSheet();
    sheetFlush = null;
    var s = document.querySelector('.scrim'); if (s) s.remove();
    render();
  }
  function sheet(inner, flush) {
    var old = document.querySelector('.scrim');
    if (old) { flushSheet(); old.remove(); }
    sheetFlush = flush || null;
    var scrim = document.createElement('div'); scrim.className = 'scrim';
    scrim.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + inner + '</div>';
    scrim.addEventListener('click', function (e) { if (e.target === scrim) closeSheet(); });
    scrim.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    document.getElementById('layer').appendChild(scrim);
    return scrim.querySelector('.sheet');
  }

  // iPhone: Gmail's web link only reaches the inbox there, so offer the Gmail app and the mobile site straight to the thread.
  // Trial buttons for now, to find which one opens the email on Rachel's phone.
  var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function threadId(link) {
    var m = String(link || '').match(/[?&]th=([^&#]+)/) || String(link || '').match(/#[^?]*\/([^/?]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function iosEmailTry(t) {
    var id = threadId(t.email.link);
    if (!IOS && !/[?&]trial=1/.test(location.search)) return '';
    return '<div class="email-try"><span class="menu-note">Trying out ways to open this on iPhone:</span>' +
      (id ? '<a class="btn" href="googlegmail:///cv=' + encodeURIComponent(id) + '/accountId=1&create-new-tab">1. Gmail app</a>' +
        '<a class="btn" href="https://mail.google.com/mail/mu/mp/#cv/priority/%5Esmartlabel_personal/' + encodeURIComponent(id) + '" target="_blank" rel="noopener">2. Gmail website</a>' +
        '<a class="btn" href="googlegmail://">3. Just open Gmail</a>' : '') +
      '<span class="menu-note link-text">' + esc(t.email.link) + '</span></div>';
  }
  function openTaskSheet(t) {
    var base = fields(t);
    var lists = state.lists.map(function (l) { return '<option value="' + l.id + '"' + (l.id === t.listId ? ' selected' : '') + '>' + esc(l.title) + '</option>'; }).join('');
    var pri = [['', 'None'], ['high', 'High'], ['med', 'Medium'], ['low', 'Low']].map(function (p) {
      return '<button type="button" class="' + p[0] + '" data-pri="' + p[0] + '" aria-pressed="' + ((t.priority || '') === p[0]) + '">' + p[1] + '</button>';
    }).join('');
    var s = sheet(
      '<div class="field"><label for="t-title">Task</label><input id="t-title" class="title-input" value="' + esc(t.title) + '"></div>' +
      (t.email ? '<div class="email-box"><div class="who"><div class="subj">' + esc(t.email.subject) + '</div><div class="from">Added from Gmail</div></div><a class="btn" data-act="email" href="' + esc(t.email.link) + '" target="_blank" rel="noopener">' + ICON.mail + 'Open email</a>' + iosEmailTry(t) + '</div>' : '') +
      '<div class="field"><span class="lbl">Priority</span><div class="seg">' + pri + '</div></div>' +
      '<div class="two"><div class="field"><label for="t-due">Due date</label><input id="t-due" type="date" value="' + esc(t.due) + '"></div>' +
      '<div class="field"><label for="t-list">List</label><select id="t-list">' + lists + '</select></div></div>' +
      '<div class="field"><label for="t-notes">Notes</label><textarea id="t-notes" placeholder="Add details">' + esc(t.notes) + '</textarea></div>' +
      (t.web ? '<a class="gt-link" href="' + esc(t.web) + '" target="_blank" rel="noopener">Open in Google Tasks</a>' : '') +
      '<div class="confirm-slot"></div>' +
      '<div class="sheet-actions"><button type="button" class="btn danger" data-act="delete">Delete</button>' +
      '<div class="right"><button type="button" class="btn" data-act="toggle">' + (t.done ? 'Mark not done' : 'Mark done') + '</button><button type="button" class="btn primary" data-act="close">Done</button></div></div>',
      function () {
        if (!state.tasks.includes(t)) return;
        if (changed(t, base)) { commit(t, base); save(); }
        base = fields(t);
      });
    s.querySelector('#t-title').addEventListener('input', function (e) { t.title = e.target.value || 'Untitled task'; });
    s.querySelector('#t-due').addEventListener('change', function (e) { t.due = e.target.value; });
    s.querySelector('#t-notes').addEventListener('input', function (e) { t.notes = e.target.value; });
    s.querySelector('#t-list').addEventListener('change', function (e) {
      state.tasks.splice(state.tasks.indexOf(t), 1);
      t.listId = e.target.value; state.tasks.push(t);
    });
    s.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pri !== undefined) {
        t.priority = b.dataset.pri || null;
        s.querySelectorAll('[data-pri]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      } else if (b.dataset.act === 'close') closeSheet();
      else if (b.dataset.act === 'toggle') { closeSheet(); toggleTask(t); }
      else if (b.dataset.act === 'delete') {
        s.querySelector('.confirm-slot').innerHTML = '<div class="confirm">Delete this task?<span style="flex:1"></span><button type="button" class="btn danger" data-act="really-delete">Delete</button><button type="button" class="btn" data-act="keep">Keep it</button></div>';
      } else if (b.dataset.act === 'keep') s.querySelector('.confirm-slot').innerHTML = '';
      else if (b.dataset.act === 'really-delete') {
        // Put back any unsaved edits first, so Undo brings back the task as it was
        Object.assign(t, { title: base.title, notes: base.notes, priority: base.priority, due: base.due, done: base.done });
        if (t.listId !== base.listId) { state.tasks.splice(state.tasks.indexOf(t), 1); t.listId = base.listId; state.tasks.push(t); }
        closeSheet(true);
        deleteTask(t);
      }
    });
    if (window.matchMedia('(hover: hover)').matches) s.querySelector('#t-title').focus();
  }

  // Every add button opens the full task form, with that button's list, priority or day already filled in
  function openNewTaskSheet(key) {
    var kind = key.split(':')[0], val = key.slice(kind.length + 1);
    var t = { id: '', listId: defaultListId || (state.lists[0] ? state.lists[0].id : ''), title: '', priority: null, due: '', notes: '', done: false, email: null, parent: null, pos: '', web: '' };
    if (kind === 'list') t.listId = realId(val);
    if (kind === 'pri') t.priority = val === 'none' ? null : val;
    if (kind === 'date') t.due = val;
    var lists = state.lists.map(function (l) { return '<option value="' + l.id + '"' + (l.id === t.listId ? ' selected' : '') + '>' + esc(l.title) + '</option>'; }).join('');
    var pri = [['', 'None'], ['high', 'High'], ['med', 'Medium'], ['low', 'Low']].map(function (p) {
      return '<button type="button" class="' + p[0] + '" data-pri="' + p[0] + '" aria-pressed="' + ((t.priority || '') === p[0]) + '">' + p[1] + '</button>';
    }).join('');
    var s = sheet('<form class="new-task" autocomplete="off" novalidate><h3>New task</h3>' +
      '<div class="field"><label for="n-title">Task</label><input id="n-title" class="title-input" placeholder="What needs doing?" enterkeyhint="done"></div>' +
      '<div class="field"><span class="lbl">Priority</span><div class="seg">' + pri + '</div></div>' +
      '<div class="two"><div class="field"><label for="n-due">Due date</label><input id="n-due" type="date" value="' + esc(t.due) + '"></div>' +
      '<div class="field"><label for="n-list">List</label><select id="n-list">' + lists + '</select></div></div>' +
      '<div class="field"><label for="n-notes">Notes</label><textarea id="n-notes" placeholder="Add details"></textarea></div>' +
      '<div class="sheet-actions"><div class="right"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary" type="submit">Add task</button></div></div></form>');
    s.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pri !== undefined) {
        t.priority = b.dataset.pri || null;
        s.querySelectorAll('[data-pri]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      } else if (b.dataset.act === 'close') closeSheet();
    });
    s.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = s.querySelector('#n-title'), title = input.value.trim();
      if (!title) { input.placeholder = 'Give the task a name first'; input.focus(); return; }
      t.title = title; t.due = s.querySelector('#n-due').value; t.listId = s.querySelector('#n-list').value; t.notes = s.querySelector('#n-notes').value;
      var lastIdx = -1;
      state.tasks.forEach(function (x, i) { if (x.listId === t.listId) lastIdx = i; });
      state.tasks.splice(lastIdx < 0 ? state.tasks.length : lastIdx + 1, 0, t);
      insertTask(t);
      save(); closeSheet();
      var l = listById(t.listId);
      toast('Added to ' + (l ? l.title : 'your list') + (t.due ? ' for ' + fmt(parseIso(t.due), { weekday: 'short', month: 'short', day: 'numeric' }) : ''));
    });
    s.querySelector('#n-title').focus();
  }

  function openListSheet(l, isNew) {
    var baseTitle = isNew ? null : l.title;
    var sw = COLORS.map(function (c) {
      return '<button type="button" class="swatch" data-color="' + c + '" aria-pressed="' + (l.color === c) + '" aria-label="' + COLOR_NAMES[c] + '" title="' + COLOR_NAMES[c] + '"><span style="background:var(--' + c + ')"></span></button>';
    }).join('');
    var canDelete = !isNew && l.id !== defaultListId && state.lists.length > 1;
    var s = sheet(
      '<h3>' + (isNew ? 'New list' : 'List settings') + '</h3>' +
      '<div class="field"><label for="l-title">Name</label><input id="l-title" value="' + esc(l.title) + '"></div>' +
      '<div class="field"><span class="lbl">Color</span><div class="swatches">' + sw + '</div></div>' +
      '<div class="field"><span class="lbl">Card style</span><div class="seg">' +
        '<button type="button" data-compact="0" aria-pressed="' + !l.compact + '">Detailed</button>' +
        '<button type="button" data-compact="1" aria-pressed="' + !!l.compact + '">Compact</button></div></div>' +
      (l.id === defaultListId ? '<p class="menu-note">This is your main Google Tasks list, where tasks from Gmail usually land, so it stays first.</p>' : '') +
      '<div class="confirm-slot"></div>' +
      '<div class="sheet-actions">' + (canDelete ? '<button type="button" class="btn danger" data-act="delete">Delete list</button>' : '') +
      '<div class="right"><button type="button" class="btn primary" data-act="close">Done</button></div></div>',
      function () {
        if (!state.lists.includes(l)) return;
        // A new list goes to Google once it has its name
        if (baseTitle === null) {
          enqueue({ m: 'POST', u: '/users/@me/lists', b: { title: l.title }, tmp: l.id, what: 'adding the list “' + l.title + '”' });
        } else if (l.title !== baseTitle) {
          enqueue({ m: 'PATCH', u: '/users/@me/lists/' + l.id, b: { title: l.title }, what: 'renaming the list' });
        }
        baseTitle = l.title;
      });
    var title = s.querySelector('#l-title');
    title.addEventListener('input', function (e) { l.title = e.target.value || 'Untitled list'; save(); render(); });
    s.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('swatch')) {
        l.color = b.dataset.color; save(); render();
        s.querySelectorAll('.swatch').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      } else if (b.dataset.compact !== undefined) {
        l.compact = b.dataset.compact === '1'; save(); render();
        s.querySelectorAll('[data-compact]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      } else if (b.dataset.act === 'close') closeSheet();
      else if (b.dataset.act === 'delete') {
        var n = state.tasks.filter(function (t) { return t.listId === l.id; }).length;
        s.querySelector('.confirm-slot').innerHTML = '<div class="confirm">Delete this list' + (n ? ' and its ' + n + ' task' + (n > 1 ? 's' : '') : '') + ' from Google Tasks? This can’t be undone.<span style="flex:1"></span><button type="button" class="btn danger" data-act="really-delete">Delete</button><button type="button" class="btn" data-act="keep">Keep it</button></div>';
      } else if (b.dataset.act === 'keep') s.querySelector('.confirm-slot').innerHTML = '';
      else if (b.dataset.act === 'really-delete') {
        l.title = baseTitle;
        state.lists = state.lists.filter(function (x) { return x !== l; });
        state.tasks = state.tasks.filter(function (t) { return t.listId !== l.id; });
        enqueue({ m: 'DELETE', u: '/users/@me/lists/' + l.id, what: 'deleting the list' });
        save(); closeSheet(true);
        toast('List deleted');
      }
    });
    if (isNew) { title.focus(); title.select(); }
  }

  function openMenu() {
    var s = sheet('<h3>Task Board</h3><div class="menu-list">' +
      '<button type="button" class="btn" data-act="refresh">' + ICON.refresh + 'Refresh from Google Tasks</button>' +
      '<a class="btn" href="https://tasks.google.com/" target="_blank" rel="noopener">' + ICON.ext + 'Open Google Tasks</a>' +
      '<button type="button" class="btn" data-act="signout">' + ICON.out + 'Sign out</button></div>' +
      '<p class="menu-note">Tasks you add from Gmail go to the list that’s open in Gmail’s Tasks panel. Keep “' + esc((listById(defaultListId) || {}).title || 'My Tasks') + '” open there and they’ll land at the top of your first list, with no date or priority.</p>' +
      (hasDrive() && !driveOff ? '' : '<p class="menu-note">List colors and card styles are saved in this browser only, so they won’t show up on your other devices.</p>') +
      '<div class="sheet-actions"><div class="right"><button type="button" class="btn primary" data-act="close">Done</button></div></div>');
    s.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'close') closeSheet();
      else if (b.dataset.act === 'refresh') { closeSheet(); refresh(); }
      else if (b.dataset.act === 'signout') signOut();
    });
  }

  // Drag and drop (mouse: drag after a small move; touch: press and hold first).
  // Each drop target carries data-zone: "list:<id>", "pri:<level>", "date:<yyyy-mm-dd>" or "date:" for no date.
  var press = null, drag = null, suppressClick = false, lastX = 0, lastY = 0;
  board.addEventListener('pointerdown', function (e) {
    var card = e.target.closest('.card');
    if (!card || card.classList.contains('done') || e.button > 0) return;
    if (e.target.closest('button, input, a, textarea, select')) return;
    press = { id: card.dataset.id, card: card, x: e.clientX, y: e.clientY, type: e.pointerType, timer: null };
    if (e.pointerType !== 'mouse') press.timer = setTimeout(function () { if (press) startDrag(press.x, press.y); }, 300);
  });
  window.addEventListener('pointermove', function (e) {
    lastX = e.clientX; lastY = e.clientY;
    if (drag) { e.preventDefault(); moveDrag(); return; }
    if (!press) return;
    var dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (press.type === 'mouse') { if (dist > 5) startDrag(e.clientX, e.clientY); }
    else if (dist > 10) { clearTimeout(press.timer); press = null; }
  }, { passive: false });
  window.addEventListener('pointerup', function () {
    if (press) { clearTimeout(press.timer); press = null; }
    if (drag) endDrag(true);
  });
  window.addEventListener('pointercancel', function () {
    if (press) { clearTimeout(press.timer); press = null; }
    if (drag) endDrag(false);
  });
  document.addEventListener('touchmove', function (e) { if (drag) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { if (drag || (press && press.type !== 'mouse')) e.preventDefault(); });

  function startDrag(x, y) {
    var card = press.card, r = card.getBoundingClientRect();
    clearTimeout(press.timer);
    hideTip();
    var zone = card.closest('[data-zone]');
    var ghost = card.cloneNode(true);
    ghost.classList.add('ghost');
    ghost.style.width = r.width + 'px';
    ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px';
    var ph = document.createElement('div'); ph.className = 'placeholder'; ph.style.height = r.height + 'px';
    ph.style.setProperty('--lc', getComputedStyle(zone).getPropertyValue('--lc'));
    if (!zone.hasAttribute('data-noph')) card.parentNode.insertBefore(ph, card);
    card.classList.add('src-hidden');
    document.body.appendChild(ghost);
    document.body.classList.add('is-dragging');
    drag = { id: press.id, ghost: ghost, ph: ph, offX: x - r.left, offY: y - r.top, from: zone.dataset.zone, zone: zone, srcZone: zone };
    lastX = x; lastY = y;
    press = null;
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    requestAnimationFrame(autoScroll);
  }
  function moveDrag() {
    drag.ghost.style.left = (lastX - drag.offX) + 'px';
    drag.ghost.style.top = (lastY - drag.offY) + 'px';
    var el = document.elementFromPoint(lastX, lastY);
    var zone = el && el.closest('[data-zone]');
    // Lists view: below a short list still counts as that list
    if (!zone && state.view === 'lists') zone = Array.prototype.find.call(board.querySelectorAll('.column'), function (c) { var r = c.getBoundingClientRect(); return lastX >= r.left && lastX <= r.right && lastY >= r.top; }) || null;
    // In Priority view, a card held outside every column will lose its priority
    var out = !zone && state.view === 'priority';
    drag.ghost.style.opacity = out ? '.55' : '';
    if (out) { if (drag.ph.parentNode) drag.ph.remove(); setTarget(null); }
    if (!zone || zone.dataset.zone === 'nodrop') return;
    setTarget(zone);
    // Small calendar boxes light up instead of making room, so nothing shifts under your finger
    if (zone.hasAttribute('data-noph')) { if (drag.ph.parentNode) drag.ph.remove(); return; }
    var list = zone.querySelector('.cards');
    if (!list) return;
    var cards = Array.prototype.filter.call(list.children, function (c) { return c.classList.contains('card') && !c.classList.contains('src-hidden'); });
    var before = null;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (lastY < r.top + r.height / 2) { before = cards[i]; break; }
    }
    if (drag.ph.parentNode !== list || drag.ph.nextSibling !== before) {
      list.insertBefore(drag.ph, before);
      drag.ph.style.setProperty('--lc', getComputedStyle(zone).getPropertyValue('--lc'));
    }
  }
  function setTarget(z) {
    if (drag.zone === z) return;
    if (drag.zone) drag.zone.classList.remove('drop-target');
    drag.zone = z;
    if (z && z !== drag.srcZone) z.classList.add('drop-target');
  }
  function autoScroll() {
    if (!drag) return;
    if (state.view !== 'calendar') {
      var r = board.getBoundingClientRect();
      if (board.clientWidth < 700) {
        // Phones: bring one whole list over each time the card reaches a screen edge
        var dir = lastX < r.left + 36 ? -1 : lastX > r.right - 36 ? 1 : 0, nowT = Date.now();
        if (!dir) drag.pageAt = 0;
        else if (nowT >= (drag.pageAt || 0)) { pageBoard(dir); drag.pageAt = nowT + 900; }
      } else {
        var edge = 60, speed = 0;
        if (lastX < r.left + edge) speed = -Math.ceil((r.left + edge - lastX) / 4);
        else if (lastX > r.right - edge) speed = Math.ceil((lastX - (r.right - edge)) / 4);
        if (speed) { board.scrollLeft += speed; moveDrag(); }
      }
    }
    var vy = 0;
    // The phone day pop-up covers the bottom of the screen, so scroll down only just above it
    var bottom = window.innerHeight, pop = document.querySelector('.on-date');
    if (pop) { var pr = pop.getBoundingClientRect(); if (lastX >= pr.left && lastX <= pr.right) bottom = pr.top; }
    if (lastY < 60) vy = -Math.ceil((60 - lastY) / 4);
    // Don't scroll down while a card is still on its way up out of the pop-up
    if (lastY < bottom - 80) drag.downOk = true;
    else if (drag.downOk && lastY > bottom - 60 && lastY < bottom) vy = Math.ceil((lastY - bottom + 60) / 4);
    if (vy) { window.scrollBy(0, vy); moveDrag(); }
    requestAnimationFrame(autoScroll);
  }
  function nearestCol() {
    var mid = board.scrollLeft + board.clientWidth / 2, cur = 0, best = Infinity;
    Array.prototype.forEach.call(board.children, function (c, i) { var dd = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (dd < best) { best = dd; cur = i; } });
    return cur;
  }
  function goCol(i) {
    var cols = board.children; if (!cols.length) return;
    var target = cols[Math.max(0, Math.min(cols.length - 1, i))];
    board.scrollTo({ left: target.offsetLeft + target.offsetWidth / 2 - board.clientWidth / 2, behavior: 'smooth' });
  }
  function pageBoard(dir) { goCol(nearestCol() + dir); }

  // Phones: the list follows your finger sideways, then settles one whole list over (or back) when you let go
  var swipe = null;
  function phoneBoard() { return phase === 'ready' && state.view !== 'calendar' && window.matchMedia('(max-width: 600px)').matches; }
  board.addEventListener('touchstart', function (e) {
    if (!phoneBoard() || e.touches.length !== 1) { swipe = null; return; }
    swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, left: board.scrollLeft, idx: nearestCol(), dir: 0, t: Date.now() };
  }, { passive: true });
  board.addEventListener('touchmove', function (e) {
    if (!swipe || drag) return;
    var dx = e.touches[0].clientX - swipe.x, dy = e.touches[0].clientY - swipe.y;
    if (!swipe.dir) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) swipe.dir = 1;
      else if (Math.abs(dy) > 8) { swipe = null; return; }
    }
    if (swipe.dir) board.scrollLeft = swipe.left - dx;
  }, { passive: true });
  board.addEventListener('touchend', function (e) {
    var s = swipe; swipe = null;
    if (!s || drag || !s.dir) return;
    var dx = e.changedTouches[0].clientX - s.x, fast = Math.abs(dx) / Math.max(1, Date.now() - s.t) > 0.3;
    goCol(s.idx + ((Math.abs(dx) > 50 || (fast && Math.abs(dx) > 20)) ? (dx < 0 ? 1 : -1) : 0));
  });
  board.addEventListener('touchcancel', function () { if (swipe && swipe.dir && !drag) goCol(nearestCol()); swipe = null; });
  board.addEventListener('scroll', function () { if (drag) moveDrag(); });

  // Hover pop-up with the full task name on the small month-view cards (computers only)
  var tipEl = null;
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  board.addEventListener('mouseover', function (e) {
    var m = e.target.closest('.card.mini');
    if (!m || drag || !window.matchMedia('(hover: hover)').matches) return;
    var t = taskById(m.dataset.id); if (!t) return;
    var l = listById(t.listId);
    hideTip();
    tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip');
    tipEl.innerHTML = esc(t.title) + '<span class="sub">' + [t.due ? 'Due ' + dueInfo(t.due).label : '', t.priority ? PRI[t.priority] + ' priority' : '', l ? l.title : ''].filter(Boolean).map(esc).join(' &middot; ') + '</span>';
    document.getElementById('layer').appendChild(tipEl);
    // Place it beside the day (right side first, then left, then above), never on the day or the day pop-up
    var r = m.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
    var box = (m.closest('.mcell') || m).getBoundingClientRect();
    var pop = document.querySelector('.on-date'), pr = pop && pop.getBoundingClientRect();
    var top = Math.max(8, Math.min(window.innerHeight - tr.height - 8, r.top + r.height / 2 - tr.height / 2));
    function fits(left, tp) {
      if (left < 8 || left + tr.width > window.innerWidth - 8) return false;
      return !pr || left + tr.width < pr.left || left > pr.right || tp + tr.height < pr.top || tp > pr.bottom;
    }
    var spots = [[box.right + 8, top], [box.left - tr.width - 8, top], [Math.max(8, Math.min(window.innerWidth - tr.width - 8, box.left + box.width / 2 - tr.width / 2)), box.top - tr.height - 8]];
    var spot = spots.find(function (s) { return fits(s[0], s[1]); }) || spots[2];
    tipEl.style.left = spot[0] + 'px';
    tipEl.style.top = Math.max(8, spot[1]) + 'px';
  });
  board.addEventListener('mouseout', function (e) {
    var m = e.target.closest('.card.mini');
    if (m && !m.contains(e.relatedTarget)) hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });
  function endDrag(commitIt) {
    var d = drag; drag = null;
    document.body.classList.remove('is-dragging');
    d.ghost.remove();
    suppressClick = true; setTimeout(function () { suppressClick = false; }, 60);
    var zone = d.ph.parentNode ? d.ph.closest('[data-zone]') : d.zone;
    var key = zone ? zone.dataset.zone : state.view === 'priority' ? 'pri:none' : null;
    var t = taskById(d.id);
    if (!commitIt || !key || !t) { render(); return; }
    var kind = key.split(':')[0], val = key.slice(kind.length + 1);
    if (kind === 'list') val = realId(val);
    var next = d.ph.nextElementSibling;
    while (next && (!next.classList.contains('card') || next.classList.contains('src-hidden'))) next = next.nextElementSibling;
    var before = fields(t), index = state.tasks.indexOf(t), msg = '';
    // Keep the drop position in the shared task order, so it carries across views
    state.tasks.splice(index, 1);
    if (kind === 'list') {
      if (t.listId !== val) msg = 'Moved to ' + listById(val).title;
      t.listId = val;
    } else if (kind === 'pri') {
      var p = val === 'none' ? null : val;
      if (t.priority !== p) msg = p ? 'Priority set to ' + PRI[p] : 'Priority cleared';
      t.priority = p;
    } else if (kind === 'date') {
      if (t.due !== val) msg = val ? 'Due date moved to ' + fmt(parseIso(val), { weekday: 'short', month: 'short', day: 'numeric' }) : 'Due date cleared';
      t.due = val;
    }
    var nt = next && taskById(next.dataset.id);
    if (nt && nt !== t) state.tasks.splice(state.tasks.indexOf(nt), 0, t);
    else {
      var lastIdx = -1;
      if (kind === 'list') state.tasks.forEach(function (x, i) { if (x.listId === val && !x.done) lastIdx = i; });
      state.tasks.splice(lastIdx < 0 ? state.tasks.length : lastIdx + 1, 0, t);
    }
    // Only a drop in the Lists view changes the task's place in Google's own order
    commit(t, before, kind === 'list');
    save(); render();
    if (msg) toast(msg, function () { undoTo(t, before, kind === 'list' ? index : null); });
  }

  /* ---------- Starting up, and keeping up to date ---------- */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { flushSheet(); return; }
    if (phase !== 'ready') return;
    if (!tokenOk()) return needAuth();
    if (Date.now() - lastLoad > 30000) refresh(true);
  });
  window.addEventListener('online', function () { syncUi(); pump(); });
  window.addEventListener('offline', syncUi);

  function start() {
    readRedirect();
    if (!CLIENT_ID) { phase = 'setup'; return render(); }
    if (!tokenOk()) {
      // Signed in before: quietly get a fresh token from Google (once; if that fails, show the button)
      var tried = load('tb-silent-at') || 0;
      if (load('tb-signed-in') && !gateMsg && Date.now() - tried > 120000) {
        store('tb-silent-at', Date.now());
        phase = 'loading'; render();
        return signIn(true);
      }
      phase = 'signin'; return render();
    }
    var cache = load('tb-cache');
    if (cache && cache.lists && cache.lists.length) {
      defaultListId = cache.defaultListId;
      state.lists = cache.lists; state.tasks = cache.tasks;
      var s = load('tb-settings');
      if (s) applyBoard({ defaultListId: cache.defaultListId, lists: cache.lists, tasks: cache.tasks }, s);
      phase = 'ready';
    } else phase = 'loading';
    render();
    // Send anything left over from last time first, then load the latest from Google
    refreshAfterQueue = true;
    if (queue.length) pump(); else { refreshAfterQueue = false; refresh(); }
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  start();
})();
