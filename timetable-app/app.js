/* Timetable Maker — offline-first editor. All data lives in this device's storage. */
(function () {
  'use strict';
  const T = window.TT;
  const KEY = 'tt.state.v1';
  const APP_VERSION = '1.0.0';
  const FONT_CSS_URL = window.TT_FONT_CSS_URL || 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Rubik:wght@500;600;700&display=swap';
  const BLACK = '#15171C';
  const L = T.LIMITS;

  // ---------------------------------------------------------------- state
  let S;
  const ui = { screen: 'home', ttId: null, tab: 'schedule', day: null, notesDay: null, selecting: false, selected: [], fit: true };
  let sheet = null;          // current bottom sheet {type, ...}
  let undoSnap = null;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = T.esc;
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const clone = o => JSON.parse(JSON.stringify(o));
  const dayInfo = k => T.DAY[k];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { S = migrate(JSON.parse(raw)); return; }
    } catch (e) { console.warn(e); }
    S = TTSeed.defaultState();
    persist();
  }
  function migrate(s) {
    if (!s || !Array.isArray(s.timetables)) return TTSeed.defaultState();
    s.settings = Object.assign({ name: 'Ahmed Samy', theme: 'system' }, s.settings || {});
    if (!Array.isArray(s.settings.periods) || !s.settings.periods.length) s.settings.periods = clone(TTSeed.PERIODS);
    while (s.settings.periods.length < 6) s.settings.periods.push(clone(TTSeed.PERIODS[s.settings.periods.length]));
    s.timetables.forEach(fixTT);
    return s;
  }
  function fixTT(t) {
    t.id = t.id || uid();
    t.title = t.title == null ? 'Timetable' : t.title;
    t.titleAr = t.titleAr || '';
    t.titleStyle = t.titleStyle === 'outline' ? 'outline' : 'filled';
    t.titleColor = t.titleColor || BLACK;
    t.label = t.label == null ? 'TIMETABLE' : t.label;
    t.group = t.group == null ? '' : t.group;
    t.days = Array.isArray(t.days) ? t.days : ['sat', 'sun', 'mon', 'thu'];
    t.subjects = Array.isArray(t.subjects) ? t.subjects : [];
    t.slots = t.slots || {};
    t.notes = t.notes || {};
    t.createdAt = t.createdAt || Date.now();
    t.updatedAt = t.updatedAt || Date.now();
    return t;
  }
  let saveTimer = null;
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
      const el = $('#saved'); if (el) { el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1200); }
    } catch (e) { toast('Could not save — device storage is full'); }
  }
  function save(now) { clearTimeout(saveTimer); if (now) persist(); else saveTimer = setTimeout(persist, 200); }
  function touch() { const t = cur(); if (t) t.updatedAt = Date.now(); save(); }
  window.addEventListener('pagehide', () => persist());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });

  const cur = () => S.timetables.find(t => t.id === ui.ttId) || null;
  const nPeriods = () => S.settings.periods.length;

  function snapshot() { undoSnap = JSON.stringify(S); }
  function undo() { if (!undoSnap) return; S = migrate(JSON.parse(undoSnap)); undoSnap = null; save(true); if (!cur() && ui.screen === 'editor') ui.screen = 'home'; render(); renderSheet(); toast('Restored'); }

  // ---------------------------------------------------------------- theme
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const m = S.settings.theme || 'system';
    const dark = m === 'dark' || (m === 'system' && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = dark ? '#0E1014' : '#E8EAEF';
  }
  mq.addEventListener && mq.addEventListener('change', applyTheme);

  // ---------------------------------------------------------------- zoom vars for the real-design previews
  function setZoom() {
    const w = Math.min(document.documentElement.clientWidth, 560);
    const paperInner = w - 32 - 28;                    // page padding + paper padding
    document.documentElement.style.setProperty('--zr', (paperInner / 364).toFixed(4));
    document.documentElement.style.setProperty('--zh', ((w - 32 - 28) / 456).toFixed(4));
    document.documentElement.style.setProperty('--zs', ((w - 32 - 20) / 364).toFixed(4));
  }
  window.addEventListener('resize', () => { setZoom(); if (ui.screen === 'editor' && ui.tab === 'preview') fitPreview(); });

  // ---------------------------------------------------------------- icons
  const P = {
    back: '<path d="M15 18l-6-6 6-6"></path>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
    more: '<circle cx="12" cy="5" r="1.4" fill="currentColor"></circle><circle cx="12" cy="12" r="1.4" fill="currentColor"></circle><circle cx="12" cy="19" r="1.4" fill="currentColor"></circle>',
    gear: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>',
    palette: '<circle cx="13.5" cy="6.5" r="1.4"></circle><circle cx="17.5" cy="10.5" r="1.4"></circle><circle cx="8.5" cy="7.5" r="1.4"></circle><circle cx="6.5" cy="12.5" r="1.4"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"></path>',
    list: T.icons.I_CHECK,
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"></path>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path>',
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h5"></path>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M16 6l-4-4-4 4M12 2v13"></path>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5M12 15V3"></path>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M17 8l-5-5-5 5M12 3v12"></path>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
    right: '<path d="M9 18l6-6-6-6"></path>',
    up: '<path d="M18 15l-6-6-6 6"></path>',
    down: '<path d="M6 9l6 6 6-6"></path>',
    x: '<path d="M18 6L6 18M6 6l12 12"></path>',
    check: '<path d="M20 6L9 17l-5-5"></path>',
    edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>',
    zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>'
  };
  const ic = (n, s) => `<svg width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

  // ---------------------------------------------------------------- helpers
  function counter(v, max) { const n = String(v || '').length; return `<span class="count${n >= max ? ' max' : ''}" data-count>${n}/${max}</span>`; }
  function timeRange(p) { const x = S.settings.periods[p - 1] || {}; return `${T.to12(x.start)} – ${T.to12(x.end)}`; }
  function relTime(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + ' min ago';
    if (d < 86400) return Math.floor(d / 3600) + ' h ago';
    const x = new Date(ts); return x.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  function classCount(t) { let n = 0; for (const d of t.days) n += T.periodsOfDay(t, d, nPeriods()).length; return n; }
  function badgeHTML(t) {
    const C = t.titleColor || BLACK;
    const style = t.titleStyle === 'outline'
      ? `background:#FFFFFF;color:${C};box-shadow:inset 0 0 0 2px ${C}`
      : `background:${C};color:#FFFFFF`;
    return `<span class="badge" style="${style}"><span>${esc(t.title || 'Untitled')}</span>${t.titleAr ? `<span class="ar" dir="rtl">${esc(t.titleAr)}</span>` : ''}</span>`;
  }
  function newEntry(subject, type) { return TTSeed.newEntry(subject, type || 'lec', ''); }
  function ensureCell(t, day, p) {
    t.slots[day] = t.slots[day] || {};
    t.slots[day][p] = t.slots[day][p] || { split: false, both: null, s1: null, s2: null };
    return t.slots[day][p];
  }
  function cleanupCell(t, day, p) {
    const c = (t.slots[day] || {})[p];
    if (c && !T.cellHasContent(t, c)) {
      if (!c.split || (!c.s1 && !c.s2)) { delete t.slots[day][p]; if (!Object.keys(t.slots[day]).length) delete t.slots[day]; }
    }
  }
  function subjectUsage(t, sid) {
    let n = 0;
    for (const d in t.slots) for (const p in t.slots[d]) {
      const c = t.slots[d][p];
      for (const e of [c.both, c.s1, c.s2]) if (e && e.subject === sid) n++;
    }
    return n;
  }
  function selectedDays(t) { return T.daysOf(t); }
  function clampDay(t, key) {
    const ds = selectedDays(t);
    if (!ds.length) return null;
    return ds.includes(ui[key]) ? ui[key] : ds[0];
  }

  // ---------------------------------------------------------------- navigation (Android back button friendly)
  function navState() { return { screen: ui.screen, ttId: ui.ttId, tab: ui.tab, selecting: ui.selecting }; }
  function go(patch) {
    Object.assign(ui, patch);
    history.pushState(navState(), '');
    render(); window.scrollTo(0, 0);
  }
  function setTab(tab) {
    ui.tab = tab;
    history.replaceState(navState(), '');
    render(); window.scrollTo(0, 0);
  }
  let afterClose = null;
  window.addEventListener('popstate', e => {
    if (sheet || afterClose) {
      if (sheet && sheet.type === 'cell') { const t = cur(); if (t) { cleanupCell(t, sheet.day, sheet.p); save(true); } }
      if (sheet && sheet.url) URL.revokeObjectURL(sheet.url);
      sheet = null; renderSheet();
      if (e.state && !e.state.sheet) Object.assign(ui, e.state);
      if (ui.screen === 'editor' && !cur()) ui.screen = 'home';
      render();
      const f = afterClose; afterClose = null; if (f) f();
      return;
    }
    const st = e.state || { screen: 'home' };
    if (st.sheet) { history.back(); return; }
    Object.assign(ui, { screen: 'home', ttId: null, tab: 'schedule', selecting: false }, st);
    if (ui.screen === 'editor' && !cur()) ui.screen = 'home';
    render();
  });
  function openSheet(s) {
    const had = !!sheet;
    sheet = s;
    if (!had) history.pushState(Object.assign(navState(), { sheet: true }), '');
    renderSheet(true);
  }
  function closeSheet(after) { if (!sheet) { if (after) after(); return; } afterClose = after || null; history.back(); }
  function replaceSheet(s) { sheet = s; renderSheet(true); }

  // ---------------------------------------------------------------- toast
  function toast(msg, action) {
    const root = $('#toast-root');
    root.innerHTML = `<div class="toast${action ? '' : ' plain'}" role="status"><span>${esc(msg)}</span>${action ? `<button data-act="toast-action">${esc(action.label)}</button>` : ''}</div>`;
    root._action = action ? action.fn : null;
    clearTimeout(root._t);
    root._t = setTimeout(() => { root.innerHTML = ''; root._action = null; }, action ? 6000 : 2600);
  }

  // ================================================================= SCREENS
  function render() {
    applyTheme(); setZoom();
    const app = $('#app');
    if (ui.screen === 'editor' && cur()) app.innerHTML = editorHTML();
    else if (ui.screen === 'settings') app.innerHTML = settingsHTML();
    else { ui.screen = 'home'; app.innerHTML = homeHTML(); }
    if (ui.screen === 'editor' && ui.tab === 'preview') fitPreview();
  }

  // ---------- HOME
  function homeHTML() {
    const sel = ui.selecting;
    const items = S.timetables.map(t => {
      const on = ui.selected.includes(t.id);
      const days = selectedDays(t).map(d => dayInfo(d).short).join(' · ') || 'No days';
      return `<button class="tcard" data-act="${sel ? 'toggle-select' : 'open'}" data-id="${t.id}">
        ${sel ? `<span class="check${on ? ' on' : ''}">${on ? ic('check', 18) : ''}</span>` : ''}
        <span class="main">${badgeHTML(t)}
          <span class="meta"><span>${esc(t.group || 'No group')}</span><span>${days}</span><span>${classCount(t)} classes</span></span>
          <span class="meta"><span>Edited ${relTime(t.updatedAt)}</span></span>
        </span>
        ${sel ? '' : `<span class="iconbtn" data-act="tmenu" data-id="${t.id}" role="button" aria-label="More options">${ic('more')}</span>`}
      </button>`;
    }).join('');
    const top = sel
      ? `<div class="topbar"><button class="iconbtn" data-act="cancel-select" aria-label="Cancel">${ic('x')}</button><h1>Choose for PDF</h1><button class="btn soft" style="min-height:40px;padding:0 14px;font-size:14px" data-act="select-all">All</button></div>`
      : `<div class="topbar"><h1>Timetables</h1><span id="saved" class="saved">Saved</span><button class="iconbtn" data-act="settings" aria-label="Settings">${ic('gear')}</button></div>`;
    const body = S.timetables.length ? items : `<div class="empty">${ic('cal', 40)}<div style="font-weight:600;color:var(--text)">No timetables yet</div><div>Tap “New timetable” to make your first one.</div></div>`;
    const tools = sel ? '' : `<div class="grid2">
        <button class="btn" data-act="pdf-select">${ic('pdf', 20)}PDF</button>
        <button class="btn" data-act="backup">${ic('cloud', 20)}Backup</button>
      </div>
      <button class="btn block" data-act="restore">${ic('upload', 20)}Restore from backup</button>`;
    const bar = sel
      ? `<div class="fabbar"><div class="inner"><button class="btn primary block" data-act="pdf-go" ${ui.selected.length ? '' : 'disabled'}>${ic('pdf', 20)}Save as PDF${ui.selected.length ? ` (${ui.selected.length})` : ''}</button></div></div>`
      : `<div class="fabbar"><div class="inner"><button class="btn primary block" data-act="new">${ic('plus', 20)}New timetable</button></div></div>`;
    return `${top}<div class="page">${sel ? '<p class="hint">Each timetable goes on its own page.</p>' : ''}${body}${tools}</div>${bar}`;
  }

  // ---------- EDITOR
  function editorHTML() {
    const t = cur();
    const tabs = [['schedule', 'cal', 'Schedule'], ['subjects', 'palette', 'Subjects'], ['notes', 'list', 'Notes'], ['setup', 'sliders', 'Setup'], ['preview', 'eye', 'Preview']];
    let body = '';
    if (ui.tab === 'subjects') body = subjectsTab(t);
    else if (ui.tab === 'notes') body = notesTab(t);
    else if (ui.tab === 'setup') body = setupTab(t);
    else if (ui.tab === 'preview') body = previewTab(t);
    else body = scheduleTab(t);
    return `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${ic('back')}</button><h1>${esc(t.title || 'Untitled')}</h1><span id="saved" class="saved">Saved</span><button class="iconbtn" data-act="export-image" aria-label="Export image">${ic('image')}</button></div>
      <div class="page">${body}</div>
      <nav class="bottomnav"><div class="inner">${tabs.map(([k, i, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}"><span class="ic">${ic(i)}</span>${l}</button>`).join('')}</div></nav>`;
  }

  function dayChips(t, key, act) {
    const ds = selectedDays(t);
    const curDay = clampDay(t, key);
    return `<div class="chips daychips">${ds.map(d => `<button class="chip${d === curDay ? ' on' : ''}" data-act="${act}" data-day="${d}"><span class="ar" dir="rtl">${dayInfo(d).ar}</span><span class="en">${dayInfo(d).short.toUpperCase()}</span></button>`).join('')}</div>`;
  }
  function noDays() {
    return `<div class="card"><div class="empty" style="padding:12px 4px">${ic('cal', 36)}<div style="font-weight:600;color:var(--text)">No days selected</div><div>Pick the days you have classes in Setup.</div><button class="btn primary" data-act="tab" data-tab="setup">Go to Setup</button></div></div>`;
  }

  function scheduleTab(t) {
    if (!selectedDays(t).length) return noDays();
    const day = ui.day = clampDay(t, 'day');
    const d = dayInfo(day);
    const blocks = [];
    for (let p = 1; p <= nPeriods(); p++) {
      const c = T.cellOf(t, day, p);
      const has = T.cellHasContent(t, c);
      blocks.push(`<div class="pblock">
        <div class="plabel"><span>Period ${p}</span><span class="num">${timeRange(p)}</span>${has ? `<span class="edit">${ic('edit', 15)}</span>` : ''}</div>
        ${has ? `<button class="prow" data-act="cell" data-p="${p}" aria-label="Edit period ${p}"><div class="zr">${T.renderRow(t, S.settings, day, p)}</div></button>`
              : `<button class="pempty" data-act="cell" data-p="${p}">${ic('plus', 18)}Add class</button>`}
      </div>`);
    }
    const notes = T.notesOfDay(t, day, nPeriods());
    const noSubjects = !t.subjects.length ? `<div class="warn">${ic('palette', 18)}<span>Add your subjects first so you can pick them here. <button class="btn soft" style="min-height:34px;margin-top:6px;font-size:14px" data-act="tab" data-tab="subjects">Add subjects</button></span></div>` : '';
    return `${dayChips(t, 'day', 'pick-day')}${noSubjects}
      <div class="paper daypaper">
        <div class="dayhead"><span class="en">${d.en}</span><span class="ar" dir="rtl">${d.ar}</span></div>
        ${blocks.join('')}
        ${notes.length ? `<button class="prow" data-act="goto-notes" data-day="${day}" aria-label="Edit Don't forget"><div class="zr" style="display:flex">${T.renderForget(notes).replace('margin-top: auto; ', 'flex: 1; ')}</div></button>` : `<button class="pempty" data-act="goto-notes" data-day="${day}">${ic('list', 18)}Add “Don't forget” items</button>`}
      </div>`;
  }

  function subjectsTab(t) {
    const rows = t.subjects.map(s => {
      const n = subjectUsage(t, s.id);
      return `<button class="li" data-act="subject" data-id="${s.id}"><span class="swatch" style="background:${s.color}"></span><span class="main"><div class="t" dir="auto">${esc(s.name)}</div><div class="s">${n ? `Used in ${n} class${n > 1 ? 'es' : ''}` : 'Not used yet'}</div></span>${ic('right', 20)}</button>`;
    }).join('');
    const others = S.timetables.filter(x => x.id !== t.id && x.subjects.length);
    return `${t.subjects.length ? `<div class="list">${rows}</div>` : `<div class="card"><div class="empty" style="padding:8px">${ic('palette', 36)}<div style="font-weight:600;color:var(--text)">No subjects yet</div><div>Add the subjects you have this term and pick a colour for each.</div></div></div>`}
      <button class="btn primary block" data-act="subject-new">${ic('plus', 20)}Add subject</button>
      ${others.length ? `<button class="btn block" data-act="subjects-copy">${ic('copy', 20)}Copy subjects from another timetable</button>` : ''}`;
  }

  function notesTab(t) {
    if (!selectedDays(t).length) return noDays();
    const day = ui.notesDay = clampDay(t, 'notesDay');
    const all = T.notesOfDay(t, day, nPeriods());
    const auto = all.filter(n => n.auto);
    const manual = (t.notes[day] || []);
    const secTag = s => s === 's1' ? '<span class="sec s1">S1</span>' : s === 's2' ? '<span class="sec">S2</span>' : '';
    return `${dayChips(t, 'notesDay', 'pick-notes-day')}
      <div class="paper flat" style="padding:10px"><div class="zr" style="display:flex;zoom:var(--zs)">${all.length ? T.renderForget(all).replace('margin-top: auto; ', 'flex: 1; ') : '<div style="flex:1;padding:18px;text-align:center;color:#6B7080;font-weight:600">Nothing for this day yet</div>'}</div></div>
      ${auto.length ? `<div class="card"><h3>From your schedule</h3>${auto.map(n => `<div class="auto-row">${secTag(n.sec)}<span dir="auto">${esc(n.text)}</span><span class="tag">${ic('zap', 13)} auto</span></div>`).join('')}<p class="hint">These come from the Assignment / Quiz switches on your classes. Turn the switch off to remove one.</p></div>` : ''}
      <div class="card"><h3>Your items</h3>
        ${manual.map((n, i) => `<div class="note-row">${secTag(n.sec)}<button class="txt" data-act="note" data-i="${i}" dir="auto" style="font-family:${T.ROOM_FONTS[n.font] || 'inherit'}">${esc(n.text)}</button>
          <button class="iconbtn sm" data-act="note-move" data-i="${i}" data-d="-1" aria-label="Move up" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>${ic('up', 18)}</button>
          <button class="iconbtn sm" data-act="note-move" data-i="${i}" data-d="1" aria-label="Move down" ${i === manual.length - 1 ? 'disabled style="opacity:.3"' : ''}>${ic('down', 18)}</button>
          <button class="iconbtn sm" data-act="note" data-i="${i}" aria-label="Edit">${ic('edit', 18)}</button></div>`).join('') || '<p class="hint">Things to bring on this day — lab coat, booklet, calculator…</p>'}
        <div class="row"><input class="input grow" id="note-new" maxlength="${L.note}" placeholder="Add an item…" dir="auto" enterkeyhint="done"><button class="btn primary" data-act="note-add" aria-label="Add">${ic('plus', 20)}</button></div>
      </div>`;
  }

  function colorSwatches(current, act, used) {
    const cur = String(current || '').toUpperCase();
    const isPreset = T.PRESETS.some(p => p.strong.toUpperCase() === cur) || cur === BLACK;
    return `<div class="swatches">${T.PRESETS.map(p => `<button class="sw${p.strong.toUpperCase() === cur ? ' on' : ''}" style="background:${p.strong}" data-act="${act}" data-color="${p.strong}" aria-label="${p.name}">${used && used.includes(p.strong.toUpperCase()) ? '<span class="used"></span>' : ''}</button>`).join('')}
      <label class="sw custom${!isPreset ? ' on' : ''}" aria-label="Custom colour" style="${!isPreset ? `background:${cur}` : ''}"><input type="color" data-in="${act}" value="${/^#[0-9A-F]{6}$/.test(cur) ? cur : '#4F5D73'}"></label></div>`;
  }

  function setupTab(t) {
    const days = T.DAYS.map(d => `<button class="chip${t.days.includes(d.k) ? ' on' : ''}" data-act="toggle-day" data-day="${d.k}"><span class="ar" dir="rtl">${d.ar}</span><span class="en">${d.short.toUpperCase()}</span></button>`).join('');
    const titleColors = [BLACK].concat(T.PRESETS.map(p => p.strong));
    const tc = (t.titleColor || BLACK).toUpperCase();
    const isPreset = titleColors.map(c => c.toUpperCase()).includes(tc);
    return `<div class="paper flat" style="padding:14px"><div class="zh" id="live-header">${headerPreview(t)}</div></div>
      <div class="card">
        <h3>Title</h3>
        <div class="field"><label>Title ${counter(t.title, L.title)}</label><input class="input" data-in="tt.title" maxlength="${L.title}" value="${esc(t.title)}" placeholder="Odd week"></div>
        <div class="field"><label>Arabic title (optional) ${counter(t.titleAr, L.titleAr)}</label><input class="input" data-in="tt.titleAr" maxlength="${L.titleAr}" value="${esc(t.titleAr)}" dir="rtl" placeholder="الأسبوع الفردي" style="font-family:'IBM Plex Sans Arabic',sans-serif"></div>
        <div class="field"><span class="lbl">Style</span><div class="seg"><button class="${t.titleStyle !== 'outline' ? 'on' : ''}" data-act="title-style" data-v="filled">Filled</button><button class="${t.titleStyle === 'outline' ? 'on' : ''}" data-act="title-style" data-v="outline">Outline</button></div></div>
        <div class="field"><span class="lbl">Title colour</span>
          <div class="swatches">${titleColors.map(c => `<button class="sw${c.toUpperCase() === tc ? ' on' : ''}" style="background:${c}" data-act="title-color" data-color="${c}" aria-label="Colour"></button>`).join('')}
          <label class="sw custom${!isPreset ? ' on' : ''}" style="${!isPreset ? `background:${tc}` : ''}" aria-label="Custom colour"><input type="color" data-in="title-color" value="${/^#[0-9A-F]{6}$/.test(tc) ? tc : BLACK}"></label></div>
          ${T.contrastWithWhite(tc) < 3 ? `<div class="warn">This colour is light — text on it may be hard to read. Pick a darker one or use Outline.</div>` : ''}
        </div>
      </div>
      <div class="card">
        <h3>Top line</h3>
        <div class="field"><label>Small label next to the title ${counter(t.label, L.label)}</label><input class="input" data-in="tt.label" maxlength="${L.label}" value="${esc(t.label)}" placeholder="TIMETABLE"></div>
        <div class="field"><label>Group (top right) ${counter(t.group, L.group)}</label><input class="input" data-in="tt.group" maxlength="${L.group}" value="${esc(t.group)}" placeholder="Group 11" dir="auto"></div>
        <p class="hint">Your name comes from Settings: <b>${esc(S.settings.name || '—')}</b></p>
      </div>
      <div class="card">
        <h3>Days</h3>
        <div class="chips wrap daychips">${days}</div>
        <p class="hint">${selectedDays(t).length} day${selectedDays(t).length === 1 ? '' : 's'} selected. 4 days is the standard size — more days just make the image wider.</p>
      </div>
      <div class="grid2"><button class="btn" data-act="dup" data-id="${t.id}">${ic('copy', 20)}Duplicate</button><button class="btn danger" data-act="delete" data-id="${t.id}">${ic('trash', 20)}Delete</button></div>`;
  }
  function headerPreview(t) {
    const html = T.renderTimetable(Object.assign({}, t, { days: [] }), S.settings, { day: 'sat' });
    // only keep the header part of the single-day render
    const m = html.match(/<header[\s\S]*?<\/header>/);
    return m ? m[0] : '';
  }

  function previewTab(t) {
    const n = Math.max(1, selectedDays(t).length);
    return `<div class="seg"><button class="${ui.fit ? 'on' : ''}" data-act="fit" data-v="1">Fit to screen</button><button class="${!ui.fit ? 'on' : ''}" data-act="fit" data-v="0">Actual size</button></div>
      <div class="preview-wrap${ui.fit ? ' fit' : ''}" id="pv-wrap"><div class="pv" id="pv">${T.renderTimetable(t, S.settings)}</div></div>
      <p class="hint num" style="text-align:center">${T.widthFor(n)} px wide · ${n} day${n > 1 ? 's' : ''}</p>
      <div class="grid2"><button class="btn primary" data-act="export-image">${ic('image', 20)}Image</button><button class="btn" data-act="pdf-one">${ic('pdf', 20)}PDF</button></div>`;
  }
  function fitPreview() {
    const wrap = $('#pv-wrap'), pv = $('#pv');
    if (!wrap || !pv) return;
    const root = pv.firstElementChild;
    if (!ui.fit) { pv.style.transform = ''; wrap.style.height = ''; return; }
    const s = wrap.clientWidth / root.offsetWidth;
    pv.style.transform = `scale(${s})`;
    wrap.style.height = Math.ceil(root.offsetHeight * s) + 'px';
  }

  // ---------- SETTINGS
  function settingsHTML() {
    const st = S.settings;
    const per = st.periods.map((p, i) => `<span class="pn">P${i + 1}</span><input class="input" type="time" data-period="${i}" data-k="start" value="${esc(p.start)}"><input class="input" type="time" data-period="${i}" data-k="end" value="${esc(p.end)}">`).join('');
    return `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${ic('back')}</button><h1>Settings</h1><span id="saved" class="saved">Saved</span></div>
      <div class="page">
        <div class="card"><h3>You</h3>
          <div class="field"><label>Your name (top right of every timetable) ${counter(st.name, L.name)}</label><input class="input" data-in="set.name" maxlength="${L.name}" value="${esc(st.name)}" dir="auto"></div>
        </div>
        <div class="card"><h3>Appearance</h3>
          <div class="seg">${['system', 'light', 'dark'].map(m => `<button class="${(st.theme || 'system') === m ? 'on' : ''}" data-act="theme" data-v="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
        </div>
        <div class="card"><h3>Period times</h3>
          <div class="ptimes"><span></span><span class="lbl">Starts</span><span class="lbl">Ends</span>${per}</div>
          <p class="hint">Shown on the timetable as 12-hour times without am/pm (14:00 → 02:00).</p>
        </div>
        <div class="card"><h3>Offline &amp; backup</h3>
          <div id="offline-status" class="statusline"><span class="spinner" style="width:14px;height:14px;border-width:2px"></span>Checking…</div>
          <div class="grid2"><button class="btn soft" data-act="backup">${ic('cloud', 20)}Backup</button><button class="btn soft" data-act="restore">${ic('upload', 20)}Restore</button></div>
          <button class="btn soft block" data-act="backup-download">${ic('download', 20)}Download backup file</button>
          <p class="hint">Backup sends a small file with all your timetables — choose Google Drive. Restore brings it back on this or a new phone.</p>
        </div>
        <p class="hint num" style="text-align:center">Timetable v${APP_VERSION}</p>
      </div>`;
  }
  async function offlineStatus() {
    const el = $('#offline-status'); if (!el) return;
    let app = false, fonts = false;
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          const c = await caches.open(k); const n = (await c.keys()).length;
          if (k.startsWith('tt-app') && n) app = true;
          if (k.startsWith('tt-fonts') && n > 3) fonts = true;
        }
      }
    } catch (e) { }
    let persisted = false;
    try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (e) { }
    if (app && fonts) el.innerHTML = `<span class="dotok"></span><span>Ready to work offline${persisted ? ' · storage protected' : ''}</span>`;
    else el.innerHTML = `<span class="dotwarn"></span><span>Open the app once with internet so it can save itself and its fonts for offline use.</span>`;
  }

  // ================================================================= SHEETS
  function renderSheet(fresh) {
    const root = $('#sheet-root');
    if (!sheet) { root.innerHTML = ''; return; }
    const old = $('.sheet', root);
    const scroll = old && !fresh ? old.scrollTop : 0;
    let inner = '';
    switch (sheet.type) {
      case 'cell': inner = cellSheet(); break;
      case 'subject': inner = subjectSheet(); break;
      case 'note': inner = noteSheet(); break;
      case 'tmenu': inner = tmenuSheet(); break;
      case 'new': inner = newSheet(); break;
      case 'export': inner = exportSheet(); break;
      case 'confirm': inner = confirmSheet(); break;
      case 'copy-subjects': inner = copySubjectsSheet(); break;
      case 'restore': inner = restoreSheet(); break;
    }
    const anim = fresh && !old ? ' anim' : '';
    root.innerHTML = `<div class="backdrop${anim}" data-act="close"></div><div class="sheet${anim}" role="dialog" aria-modal="true"><div class="grab"></div>${inner}</div>`;
    const sh = $('.sheet', root);
    if (scroll) sh.scrollTop = scroll;
  }
  const sheetHead = (title, sub) => `<div class="shead"><div class="grow"><h2 dir="auto">${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>`;

  // ---------- cell editor
  function cellTarget() {
    const t = cur(); const c = T.cellOf(t, sheet.day, sheet.p);
    if (!c) return null;
    return c.split ? c[sheet.sec] : c.both;
  }
  function cellSheet() {
    const t = cur(), day = sheet.day, p = sheet.p;
    const c = T.cellOf(t, day, p) || { split: false };
    const split = !!c.split;
    const e = split ? c[sheet.sec] : c.both;
    const has = T.cellHasContent(t, c);
    const preview = has
      ? `<div class="paper" style="padding:10px"><div class="zr" style="zoom:var(--zs)">${T.renderRow(t, S.settings, day, p)}</div></div>`
      : `<div class="paper" style="padding:10px"><div class="pempty" style="min-height:56px">Empty — pick a subject below</div></div>`;
    const secName = s => { const x = c[s]; return T.entryValid(t, x) ? esc(T.subjectOf(t, x.subject).name) : 'No class'; };
    const subj = t.subjects.map(s => `<button class="chip${e && e.subject === s.id ? ' on' : ''}" data-act="pick-subject" data-id="${s.id}"><span class="dot" style="background:${s.color}"></span><span dir="auto">${esc(s.name)}</span></button>`).join('');
    const quick = sheet.adding ? `<div class="card" style="background:var(--surface2);padding:12px;gap:10px">
        <div class="field"><label>New subject ${counter(sheet.newName, L.subject)}</label><input class="input" id="quick-name" data-in="quick-name" maxlength="${L.subject}" value="${esc(sheet.newName || '')}" placeholder="e.g. Statics" dir="auto"></div>
        ${colorSwatches(sheet.newColor, 'quick-color', t.subjects.map(s => s.color.toUpperCase()))}
        <div class="row"><button class="btn soft grow" data-act="quick-cancel">Cancel</button><button class="btn primary grow" data-act="quick-add">Add &amp; use</button></div></div>` : '';
    let form = '';
    if (e && T.entryValid(t, e)) {
      const types = [['lec', 'Lecture'], ['tut', 'Tutorial'], ['lab', 'Lab']];
      form = `<div class="field"><span class="lbl">Type</span><div class="seg">${types.map(([k, l]) => `<button class="${e.type === k ? 'on' : ''}" data-act="pick-type" data-v="${k}">${T.icons.SVG(16, 2.2, { lec: T.icons.I_LEC, tut: T.icons.I_TUT, lab: T.icons.I_LAB }[k])}${l}</button>`).join('')}</div></div>
        <div class="field"><label>Room / hall ${counter(e.room, L.room)}</label><input class="input" data-in="room" maxlength="${L.room}" value="${esc(e.room)}" placeholder="C101" dir="auto" style="font-family:${T.ROOM_FONTS[e.roomFont] || T.ROOM_FONTS.rubik}"></div>
        <div class="field"><span class="lbl">Room font</span><div class="seg">${Object.keys(T.ROOM_FONTS).map(k => `<button class="${(e.roomFont || 'rubik') === k ? 'on' : ''}" data-act="room-font" data-v="${k}" style="font-family:${T.ROOM_FONTS[k]}">${k === 'arabic' ? 'عربي' : T.FONT_LABELS[k]}</button>`).join('')}</div>
          ${String(e.room || '').length > 8 ? '<p class="hint">Long names get a slightly smaller font and their own line so the card stays tidy.</p>' : ''}</div>
        <div class="switch"><span class="grow">${T.icons.SVG(18, 2.2, T.icons.I_DOC, ' style="vertical-align:-3px;margin-right:6px"')}Assignment / sheet</span><button class="tog${e.asg ? ' on' : ''}" data-act="toggle-asg" aria-label="Assignment"></button></div>
        ${e.asg ? `<div class="field" style="margin-top:-8px"><label>Tag text ${counter(e.asgLabel, L.tag)}</label><input class="input" data-in="asgLabel" maxlength="${L.tag}" value="${esc(e.asgLabel || 'Assignment')}" placeholder="Assignment"></div>` : ''}
        <div class="switch"><span class="grow">${T.icons.SVG(18, 2.2, T.icons.I_QUIZ, ' style="vertical-align:-3px;margin-right:6px"')}Quiz</span><button class="tog${e.quiz ? ' on' : ''}" data-act="toggle-quiz" aria-label="Quiz"></button></div>
        ${e.quiz ? `<div class="field" style="margin-top:-8px"><label>Tag text ${counter(e.quizLabel, L.tag)}</label><input class="input" data-in="quizLabel" maxlength="${L.tag}" value="${esc(e.quizLabel || 'Quiz')}" placeholder="Quiz"></div>` : ''}
        ${e.asg || e.quiz ? `<p class="hint" style="margin-top:-6px">${ic('zap', 13)} Also added to this day's “Don't forget”.</p>` : ''}`;
    }
    const copyBtn = split && !T.entryValid(t, c[sheet.sec]) && T.entryValid(t, c[sheet.sec === 's1' ? 's2' : 's1'])
      ? `<button class="btn soft block" data-act="copy-other">${ic('copy', 18)}Same as ${sheet.sec === 's1' ? 'S2' : 'S1'}</button>` : '';
    return `${sheetHead(`${dayInfo(day).en[0] + dayInfo(day).en.slice(1).toLowerCase()} · Period ${p}`, `<span class="num">${timeRange(p)}</span>`)}
      ${preview}
      <div class="seg"><button class="${!split ? 'on' : ''}" data-act="cell-mode" data-v="both">Same for S1 &amp; S2</button><button class="${split ? 'on' : ''}" data-act="cell-mode" data-v="split">S1 ≠ S2</button></div>
      ${split ? `<div class="seg">${['s1', 's2'].map(s => `<button class="${sheet.sec === s ? 'on' : ''}" data-act="pick-sec" data-v="${s}"><span class="sec${s === 's1' ? ' s1' : ''}">${s.toUpperCase()}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" dir="auto">${secName(s)}</span></button>`).join('')}</div>` : ''}
      ${sheet.hint ? `<div class="warn">${esc(sheet.hint)}</div>` : ''}
      <div class="field"><span class="lbl">${split ? `Subject for ${sheet.sec.toUpperCase()}` : 'Subject'}</span>
        <div class="chips wrap">${subj}<button class="chip${!e || !T.entryValid(t, e) ? ' on' : ''}" data-act="pick-subject" data-id="">No class</button><button class="chip dashed" data-act="quick-open">${ic('plus', 16)}New</button></div></div>
      ${quick}
      ${copyBtn}
      ${form}
      <div class="sactions"><button class="btn danger" data-act="cell-clear">${ic('trash', 20)}Clear</button><button class="btn primary" data-act="close">Done</button></div>`;
  }
  function refreshCellPreview() {
    if (!sheet || sheet.type !== 'cell') return;
    const sh = $('.sheet'); if (!sh) return;
    const t = cur();
    const box = sh.querySelector('.paper .zr');
    if (box && T.cellHasContent(t, T.cellOf(t, sheet.day, sheet.p))) box.innerHTML = T.renderRow(t, S.settings, sheet.day, sheet.p);
  }

  // ---------- subject editor
  function subjectSheet() {
    const t = cur();
    const s = sheet.draft;
    const fake = { subjects: [Object.assign({}, s, { id: 'x' })], slots: { sat: { 1: { split: false, both: TTSeed.newEntry('x', 'lec', 'C101') }, 2: { split: true, s1: TTSeed.newEntry('x', 'tut', 'C409'), s2: TTSeed.newEntry('x', 'lab', 'B2') } } } };
    if (!s.name) fake.subjects[0].name = 'Subject';
    const used = t.subjects.filter(x => x.id !== sheet.id).map(x => x.color.toUpperCase());
    const others = sheet.id ? S.timetables.filter(x => x.id !== t.id && x.subjects.some(y => y.name.trim().toLowerCase() === sheet.origName.trim().toLowerCase())) : [];
    const n = sheet.id ? subjectUsage(t, sheet.id) : 0;
    return `${sheetHead(sheet.id ? 'Edit subject' : 'New subject')}
      <div class="paper" style="padding:10px;display:flex;flex-direction:column;gap:10px"><div class="zr" style="zoom:var(--zs)" id="subj-preview">${T.renderRow(fake, S.settings, 'sat', 1)}${'<div style="height:10px"></div>'}${T.renderRow(fake, S.settings, 'sat', 2)}</div></div>
      <div class="field"><label>Name ${counter(s.name, L.subject)}</label><input class="input" data-in="subj-name" maxlength="${L.subject}" value="${esc(s.name)}" placeholder="e.g. Statics" dir="auto"></div>
      <div class="field"><span class="lbl">Colour</span>${colorSwatches(s.color, 'subj-color', used)}
        <p class="hint">A white dot = already used by another subject.</p>
        ${T.contrastWithWhite(s.color) < 3 ? '<div class="warn">This colour is light — white text on lectures may be hard to read. Pick a darker shade.</div>' : ''}</div>
      ${others.length ? `<div class="switch"><span class="grow" style="font-weight:500">Also update “${esc(sheet.origName)}” in ${others.length} other timetable${others.length > 1 ? 's' : ''}</span><button class="tog${sheet.sync ? ' on' : ''}" data-act="subj-sync"></button></div>` : ''}
      <div class="sactions">${sheet.id ? `<button class="btn danger" data-act="subj-delete">${ic('trash', 20)}</button>` : ''}<button class="btn primary" data-act="subj-save" ${s.name.trim() ? '' : 'disabled'}>${sheet.id ? 'Save' : 'Add subject'}</button></div>
      ${sheet.id && n ? `<p class="hint" style="margin-top:-8px">Used in ${n} class${n > 1 ? 'es' : ''}.</p>` : ''}`;
  }

  // ---------- note editor
  function noteSheet() {
    const n = sheet.draft;
    return `${sheetHead('Don\'t forget item', esc(dayInfo(sheet.day).en))}
      <div class="field"><label>Text ${counter(n.text, L.note)}</label><input class="input" data-in="note-text" maxlength="${L.note}" value="${esc(n.text)}" dir="auto" style="font-family:${T.ROOM_FONTS[n.font] || 'inherit'}"></div>
      <div class="field"><span class="lbl">For</span><div class="seg">${[['both', 'Everyone'], ['s1', 'S1 only'], ['s2', 'S2 only']].map(([k, l]) => `<button class="${n.sec === k ? 'on' : ''}" data-act="note-sec" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Font</span><div class="seg">${['sans', 'rubik', 'arabic'].map(k => `<button class="${(n.font || 'sans') === k ? 'on' : ''}" data-act="note-font" data-v="${k}" style="font-family:${T.ROOM_FONTS[k]}">${k === 'arabic' ? 'عربي' : T.FONT_LABELS[k]}</button>`).join('')}</div></div>
      <div class="sactions"><button class="btn danger" data-act="note-delete">${ic('trash', 20)}</button><button class="btn primary" data-act="note-save" ${n.text.trim() ? '' : 'disabled'}>Save</button></div>`;
  }

  function tmenuSheet() {
    const t = S.timetables.find(x => x.id === sheet.id);
    if (!t) return sheetHead('Not found');
    return `${sheetHead(esc(t.title || 'Untitled'), esc(t.group || ''))}
      <div class="list" style="background:var(--surface2)">
        <button class="li" data-act="open" data-id="${t.id}">${ic('edit')}<span class="main t">Edit</span></button>
        <button class="li" data-act="export-image" data-id="${t.id}">${ic('image')}<span class="main t">Export image</span></button>
        <button class="li" data-act="pdf-one" data-id="${t.id}">${ic('pdf')}<span class="main t">Save as PDF</span></button>
        <button class="li" data-act="dup" data-id="${t.id}">${ic('copy')}<span class="main t">Duplicate</span></button>
        <button class="li" data-act="delete" data-id="${t.id}" style="color:var(--danger)">${ic('trash')}<span class="main t">Delete</span></button>
      </div><div style="height:calc(12px + env(safe-area-inset-bottom))"></div>`;
  }

  function newSheet() {
    const opts = [['blank', 'Blank']].concat(S.timetables.map(t => [t.id, 'Copy of “' + (t.title || 'Untitled') + '”']));
    const recent = S.timetables.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return `${sheetHead('New timetable')}
      <div class="field"><label>Title ${counter(sheet.title, L.title)}</label><input class="input" data-in="new-title" maxlength="${L.title}" value="${esc(sheet.title)}" placeholder="e.g. Odd week"></div>
      <div class="field"><span class="lbl">Start from</span><div class="list" style="background:var(--surface2)">${opts.map(([k, l]) => `<button class="li" data-act="new-from" data-v="${k}"><span class="check${sheet.from === k ? ' on' : ''}" style="border-radius:50%">${sheet.from === k ? ic('check', 16) : ''}</span><span class="main t" dir="auto">${esc(l)}</span></button>`).join('')}</div></div>
      ${sheet.from === 'blank' && recent && recent.subjects.length ? `<div class="switch"><span class="grow" style="font-weight:500">Bring my subjects from “${esc(recent.title)}”</span><button class="tog${sheet.copySubjects ? ' on' : ''}" data-act="new-copysubj"></button></div>` : ''}
      <div class="sactions"><button class="btn primary" data-act="new-create">Create</button></div>`;
  }

  function exportSheet() {
    const t = S.timetables.find(x => x.id === sheet.id);
    const ds = selectedDays(t);
    if (sheet.busy) return `${sheetHead('Export image')}<div class="empty"><span class="spinner"></span><div>Creating your image…</div></div><div style="height:24px"></div>`;
    if (sheet.url) {
      return `${sheetHead('Your image is ready', esc(sheet.fname))}
        <img class="result-img" src="${sheet.url}" alt="Exported timetable">
        ${sheet.fontWarn ? `<div class="warn">Fonts weren't downloaded yet, so a fallback font was used. Open the app once with internet, then export again.</div>` : ''}
        <div class="sactions"><button class="btn soft" data-act="img-share">${ic('share', 20)}Share</button><button class="btn primary" data-act="img-save">${ic('download', 20)}Save</button></div>`;
    }
    return `${sheetHead('Export image', esc(t.title || ''))}
      <div class="field"><span class="lbl">What to export</span>
        <div class="chips wrap"><button class="chip${!sheet.day ? ' on' : ''}" data-act="exp-day" data-day="">Whole week</button>${ds.map(d => `<button class="chip${sheet.day === d ? ' on' : ''}" data-act="exp-day" data-day="${d}">${dayInfo(d).short} only</button>`).join('')}</div></div>
      <p class="hint">PNG at 2× resolution — sharp when you zoom in.</p>
      <div class="sactions"><button class="btn primary" data-act="img-make">${ic('image', 20)}Create image</button></div>`;
  }

  function confirmSheet() {
    return `${sheetHead(esc(sheet.title))}<p class="hint" style="font-size:15px">${sheet.body}</p>
      <div class="sactions"><button class="btn soft" data-act="close">Cancel</button><button class="btn primary" data-act="confirm-yes" style="${sheet.danger ? 'background:var(--danger);color:#fff' : ''}">${esc(sheet.yes)}</button></div>`;
  }

  function copySubjectsSheet() {
    const t = cur();
    const others = S.timetables.filter(x => x.id !== t.id && x.subjects.length);
    return `${sheetHead('Copy subjects from')}
      <div class="list" style="background:var(--surface2)">${others.map(o => `<button class="li" data-act="copy-subjects-from" data-id="${o.id}"><span class="main"><div class="t">${esc(o.title)}</div><div class="s">${o.subjects.map(s => esc(s.name)).join(', ')}</div></span>${ic('right', 20)}</button>`).join('')}</div>
      <p class="hint">Subjects you already have (same name) are skipped.</p><div style="height:calc(12px + env(safe-area-inset-bottom))"></div>`;
  }

  function restoreSheet() {
    const d = sheet.data;
    return `${sheetHead('Restore backup', `${d.timetables.length} timetable${d.timetables.length === 1 ? '' : 's'} in this file`)}
      <div class="list" style="background:var(--surface2)">${d.timetables.map(t => `<div class="li">${badgeHTML(t)}</div>`).join('')}</div>
      <div class="sactions" style="flex-direction:column"><button class="btn primary block" data-act="restore-add">Add to my timetables</button><button class="btn danger block" data-act="restore-replace">Replace everything with this backup</button></div>`;
  }

  // ================================================================= ACTIONS
  const A = {};
  A.close = () => closeSheet();
  A['toast-action'] = () => { const r = $('#toast-root'); const f = r._action; r.innerHTML = ''; r._action = null; f && f(); };
  A.settings = () => go({ screen: 'settings' });
  A.back = () => history.back();
  A.open = el => { const id = el.dataset.id; closeSheet(() => go({ screen: 'editor', ttId: id, tab: 'schedule', day: null, notesDay: null })); };
  A.tab = el => setTab(el.dataset.tab);
  A.tmenu = (el, ev) => { ev.stopPropagation(); openSheet({ type: 'tmenu', id: el.dataset.id }); };
  A['pick-day'] = el => { ui.day = el.dataset.day; render(); };
  A['pick-notes-day'] = el => { ui.notesDay = el.dataset.day; render(); };
  A['goto-notes'] = el => { ui.notesDay = el.dataset.day; setTab('notes'); };

  // new / duplicate / delete
  A.new = () => openSheet({ type: 'new', title: '', from: 'blank', copySubjects: true });
  A['new-from'] = el => { sheet.from = el.dataset.v; if (sheet.from !== 'blank' && !sheet.title) { const src = S.timetables.find(t => t.id === sheet.from); sheet.title = src ? (src.title + ' copy').slice(0, L.title) : ''; } renderSheet(); };
  A['new-copysubj'] = () => { sheet.copySubjects = !sheet.copySubjects; renderSheet(); };
  A['new-create'] = () => {
    let t;
    if (sheet.from === 'blank') {
      const recent = S.timetables.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0];
      t = fixTT({ id: uid(), title: sheet.title.trim() || 'New timetable', titleAr: '', titleStyle: 'filled', titleColor: BLACK, label: 'TIMETABLE', group: recent ? recent.group : '', days: recent ? recent.days.slice() : ['sat', 'sun', 'mon', 'thu'], subjects: sheet.copySubjects && recent ? clone(recent.subjects) : [], slots: {}, notes: {} });
    } else {
      const src = S.timetables.find(x => x.id === sheet.from);
      t = fixTT(Object.assign(clone(src), { id: uid(), title: sheet.title.trim() || (src.title + ' copy'), createdAt: Date.now() }));
    }
    t.updatedAt = Date.now();
    S.timetables.push(t); save(true);
    closeSheet(() => go({ screen: 'editor', ttId: t.id, tab: t.subjects.length ? 'schedule' : 'subjects', day: null, notesDay: null }));
  };
  A.dup = el => {
    const src = S.timetables.find(x => x.id === el.dataset.id);
    const t = fixTT(Object.assign(clone(src), { id: uid(), title: ((src.title || 'Untitled') + ' copy').slice(0, L.title), createdAt: Date.now(), updatedAt: Date.now() }));
    S.timetables.splice(S.timetables.indexOf(src) + 1, 0, t); save(true);
    closeSheet(() => {
      if (ui.screen === 'editor') { ui.ttId = t.id; history.replaceState(navState(), ''); }
      render(); toast('Duplicated “' + src.title + '” — you are now editing the copy');
    });
  };
  A.delete = el => {
    const t = S.timetables.find(x => x.id === el.dataset.id);
    replaceOrOpen({ type: 'confirm', title: 'Delete “' + (t.title || 'Untitled') + '”?', body: 'This removes the timetable from this phone. You can undo right after.', yes: 'Delete', danger: true, fn: () => {
      snapshot(); S.timetables = S.timetables.filter(x => x.id !== t.id); save(true);
      if (ui.screen === 'editor') history.back(); else render();
      toast('Timetable deleted', { label: 'Undo', fn: undo });
    } });
  };
  function replaceOrOpen(s) { if (sheet) replaceSheet(s); else openSheet(s); }
  A['confirm-yes'] = () => { const f = sheet.fn; closeSheet(f); };

  // home selection / pdf
  A['pdf-select'] = () => go({ screen: 'home', selecting: true, selected: S.timetables.map(t => t.id) });
  A['cancel-select'] = () => history.back();
  A['select-all'] = () => { ui.selected = ui.selected.length === S.timetables.length ? [] : S.timetables.map(t => t.id); render(); };
  A['toggle-select'] = el => { const id = el.dataset.id; ui.selected = ui.selected.includes(id) ? ui.selected.filter(x => x !== id) : ui.selected.concat(id); render(); };
  A['pdf-go'] = () => printTimetables(S.timetables.filter(t => ui.selected.includes(t.id)));
  A['pdf-one'] = el => { const t = el.dataset.id ? S.timetables.find(x => x.id === el.dataset.id) : cur(); closeSheet(() => printTimetables([t])); };

  // schedule cells
  A.cell = el => openSheet({ type: 'cell', day: ui.day, p: +el.dataset.p, sec: 's1' });
  A['cell-mode'] = el => {
    const t = cur(); const c = ensureCell(t, sheet.day, sheet.p);
    const want = el.dataset.v === 'split';
    if (want === !!c.split) return;
    if (want) { c.split = true; c.s1 = c.both ? clone(c.both) : null; c.s2 = null; c.both = null; sheet.sec = c.s1 ? 's2' : 's1'; }
    else { const keep = T.entryValid(t, c.s1) ? c.s1 : (T.entryValid(t, c.s2) ? c.s2 : null); c.split = false; c.both = keep ? clone(keep) : null; c.s1 = c.s2 = null; }
    sheet.hint = null; touch(); renderSheet();
  };
  A['pick-sec'] = el => { sheet.sec = el.dataset.v; sheet.hint = null; renderSheet(); };
  A['pick-subject'] = el => {
    const t = cur(); const id = el.dataset.id || null;
    const c = ensureCell(t, sheet.day, sheet.p);
    const key = c.split ? sheet.sec : 'both';
    if (!id) c[key] = null;
    else if (c[key] && T.entryValid(t, c[key])) c[key].subject = id;
    else c[key] = newEntry(id, c.split ? 'tut' : 'lec');
    sheet.hint = null;
    touch(); renderSheet();
  };
  A['pick-type'] = el => {
    const t = cur(); const c = ensureCell(t, sheet.day, sheet.p); const v = el.dataset.v;
    if (!c.split && v === 'tut' && c.both) {
      // Tutorials are by section: split, keep this class for S1 and let the user fill S2.
      const e = clone(c.both); e.type = 'tut';
      c.split = true; c.s1 = e; c.s2 = null; c.both = null; sheet.sec = 's2';
      sheet.hint = 'Tutorials differ per section, so this slot is now split. Pick the S2 class (or keep “No class”). Tap “Same for S1 & S2” to undo.';
    } else {
      const e = c.split ? c[sheet.sec] : c.both; if (e) e.type = v;
      sheet.hint = null;
    }
    touch(); renderSheet();
  };
  A['room-font'] = el => { const e = cellTarget(); if (e) { e.roomFont = el.dataset.v; touch(); renderSheet(); } };
  A['toggle-asg'] = () => { const e = cellTarget(); if (e) { e.asg = !e.asg; touch(); renderSheet(); } };
  A['toggle-quiz'] = () => { const e = cellTarget(); if (e) { e.quiz = !e.quiz; touch(); renderSheet(); } };
  A['copy-other'] = () => { const t = cur(); const c = T.cellOf(t, sheet.day, sheet.p); const o = sheet.sec === 's1' ? 's2' : 's1'; c[sheet.sec] = clone(c[o]); touch(); renderSheet(); };
  A['cell-clear'] = () => {
    const t = cur(); snapshot();
    if (t.slots[sheet.day]) { delete t.slots[sheet.day][sheet.p]; if (!Object.keys(t.slots[sheet.day]).length) delete t.slots[sheet.day]; }
    touch(); closeSheet(() => toast('Period cleared', { label: 'Undo', fn: undo }));
  };
  A['quick-open'] = () => { sheet.adding = true; sheet.newName = ''; sheet.newColor = nextColor(cur()); renderSheet(); setTimeout(() => { const i = $('#quick-name'); i && i.focus(); }, 50); };
  A['quick-cancel'] = () => { sheet.adding = false; renderSheet(); };
  A['quick-color'] = el => { sheet.newColor = el.dataset.color; renderSheet(); };
  A['quick-add'] = () => {
    const name = String(sheet.newName || '').trim(); if (!name) { toast('Type a name first'); return; }
    const t = cur(); const s = { id: uid(), name, color: sheet.newColor };
    t.subjects.push(s); sheet.adding = false;
    A['pick-subject']({ dataset: { id: s.id } });
  };
  function nextColor(t) {
    const used = t.subjects.map(s => s.color.toUpperCase());
    const p = T.PRESETS.find(x => !used.includes(x.strong.toUpperCase()));
    return p ? p.strong : T.PRESETS[t.subjects.length % T.PRESETS.length].strong;
  }

  // subjects
  A['subject-new'] = () => openSheet({ type: 'subject', id: null, origName: '', draft: { name: '', color: nextColor(cur()) }, sync: false });
  A.subject = el => { const s = cur().subjects.find(x => x.id === el.dataset.id); openSheet({ type: 'subject', id: s.id, origName: s.name, draft: { name: s.name, color: s.color }, sync: true }); };
  A['subj-color'] = el => { sheet.draft.color = el.dataset.color; renderSheet(); };
  A['subj-sync'] = () => { sheet.sync = !sheet.sync; renderSheet(); };
  A['subj-save'] = () => {
    const t = cur(); const d = sheet.draft; const name = d.name.trim(); if (!name) return;
    if (sheet.id) {
      const s = t.subjects.find(x => x.id === sheet.id); s.name = name; s.color = d.color;
      if (sheet.sync) for (const o of S.timetables) if (o.id !== t.id) for (const y of o.subjects) if (y.name.trim().toLowerCase() === sheet.origName.trim().toLowerCase()) { y.name = name; y.color = d.color; o.updatedAt = Date.now(); }
    } else t.subjects.push({ id: uid(), name, color: d.color });
    touch(); closeSheet();
  };
  A['subj-delete'] = () => {
    const t = cur(); const s = t.subjects.find(x => x.id === sheet.id); const n = subjectUsage(t, s.id);
    replaceSheet({ type: 'confirm', title: 'Delete “' + s.name + '”?', body: n ? `It's used in ${n} class${n > 1 ? 'es' : ''} — they will be removed from the timetable. You can undo right after.` : 'You can undo right after.', yes: 'Delete', danger: true, fn: () => {
      snapshot();
      t.subjects = t.subjects.filter(x => x.id !== s.id);
      for (const d in t.slots) for (const p in t.slots[d]) { const c = t.slots[d][p]; for (const k of ['both', 's1', 's2']) if (c[k] && c[k].subject === s.id) c[k] = null; cleanupCell(t, d, p); }
      touch(); render(); toast('Subject deleted', { label: 'Undo', fn: undo });
    } });
  };
  A['subjects-copy'] = () => openSheet({ type: 'copy-subjects' });
  A['copy-subjects-from'] = el => {
    const t = cur(); const o = S.timetables.find(x => x.id === el.dataset.id);
    const have = t.subjects.map(s => s.name.trim().toLowerCase());
    let n = 0;
    for (const s of o.subjects) if (!have.includes(s.name.trim().toLowerCase())) { t.subjects.push({ id: uid(), name: s.name, color: s.color }); n++; }
    touch(); closeSheet(() => toast(n ? `Added ${n} subject${n > 1 ? 's' : ''}` : 'You already have all of them'));
  };

  // notes
  A['note-add'] = () => {
    const inp = $('#note-new'); const v = (inp.value || '').trim(); if (!v) { inp.focus(); return; }
    const t = cur(); const day = ui.notesDay;
    (t.notes[day] = t.notes[day] || []).push({ id: uid(), text: v.slice(0, L.note), sec: 'both', font: 'sans' });
    touch(); render(); const ni = $('#note-new'); ni && ni.focus();
  };
  A.note = el => { const t = cur(); const i = +el.dataset.i; const n = t.notes[ui.notesDay][i]; openSheet({ type: 'note', day: ui.notesDay, i, draft: clone(n) }); };
  A['note-sec'] = el => { sheet.draft.sec = el.dataset.v; renderSheet(); };
  A['note-font'] = el => { sheet.draft.font = el.dataset.v; renderSheet(); };
  A['note-save'] = () => { const t = cur(); const d = sheet.draft; d.text = d.text.trim(); t.notes[sheet.day][sheet.i] = d; touch(); closeSheet(); };
  A['note-delete'] = () => { const t = cur(); snapshot(); t.notes[sheet.day].splice(sheet.i, 1); touch(); closeSheet(() => toast('Item removed', { label: 'Undo', fn: undo })); };
  A['note-move'] = el => { const t = cur(); const arr = t.notes[ui.notesDay]; const i = +el.dataset.i, j = i + (+el.dataset.d); if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; touch(); render(); };

  // setup
  A['title-style'] = el => { cur().titleStyle = el.dataset.v; touch(); render(); };
  A['title-color'] = el => { cur().titleColor = el.dataset.color; touch(); render(); };
  A['toggle-day'] = el => { const t = cur(); const d = el.dataset.day; t.days = t.days.includes(d) ? t.days.filter(x => x !== d) : t.days.concat(d); t.days = T.DAYS.map(x => x.k).filter(k => t.days.includes(k)); touch(); render(); };

  // preview
  A.fit = el => { ui.fit = el.dataset.v === '1'; render(); };

  // settings
  A.theme = el => { S.settings.theme = el.dataset.v; save(true); render(); offlineStatus(); };

  // export image
  A['export-image'] = el => { const id = (el && el.dataset.id) || ui.ttId; replaceOrOpen({ type: 'export', id, day: '' }); };
  A['exp-day'] = el => { sheet.day = el.dataset.day; renderSheet(); };
  A['img-make'] = async () => {
    const t = S.timetables.find(x => x.id === sheet.id); const day = sheet.day || null;
    sheet.busy = true; renderSheet();
    try {
      const { blob, fontWarn } = await exportPNG(t, day);
      const fname = fileName(t.title + (day ? '-' + dayInfo(day).short : '')) + '.png';
      if (!sheet || sheet.type !== 'export') return;
      sheet.busy = false; sheet.blob = blob; sheet.fname = fname; sheet.fontWarn = fontWarn; sheet.url = URL.createObjectURL(blob);
      renderSheet();
    } catch (e) { console.error(e); if (sheet) { sheet.busy = false; renderSheet(); } toast('Could not create the image: ' + (e.message || e)); }
  };
  A['img-save'] = () => downloadBlob(sheet.blob, sheet.fname);
  A['img-share'] = async () => {
    const file = new File([sheet.blob], sheet.fname, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: sheet.fname }); } catch (e) { } }
    else { downloadBlob(sheet.blob, sheet.fname); toast('Sharing isn’t available here — saved instead'); }
  };

  // backup / restore
  A.backup = async () => {
    const data = backupData();
    const fname = 'timetables-backup-' + new Date().toISOString().slice(0, 10);
    // Android only shares a fixed set of file types; .txt is one of them, so the backup travels as text.
    const file = new File([data], fname + '.txt', { type: 'text/plain' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Timetables backup' }); toast('Backup ready — keep it in Drive'); } catch (e) { if (e && e.name !== 'AbortError') downloadBlob(new Blob([data], { type: 'application/json' }), fname + '.json'); }
    } else { downloadBlob(new Blob([data], { type: 'application/json' }), fname + '.json'); toast('Backup file saved to Downloads'); }
  };
  A['backup-download'] = () => { const fname = 'timetables-backup-' + new Date().toISOString().slice(0, 10) + '.json'; downloadBlob(new Blob([backupData()], { type: 'application/json' }), fname); toast('Backup file saved'); };
  A.restore = () => { const i = $('#restore-input'); i.value = ''; i.click(); };
  A['restore-add'] = () => {
    const d = sheet.data; const ids = new Set(S.timetables.map(t => t.id));
    for (const t of d.timetables) { const x = fixTT(clone(t)); if (ids.has(x.id)) x.id = uid(); S.timetables.push(x); }
    save(true); closeSheet(() => toast(`Added ${d.timetables.length} timetable${d.timetables.length > 1 ? 's' : ''}`));
  };
  A['restore-replace'] = () => {
    const d = sheet.data;
    replaceSheet({ type: 'confirm', title: 'Replace everything?', body: 'All timetables on this phone will be replaced by the backup. You can undo right after.', yes: 'Replace', danger: true, fn: () => {
      snapshot(); S = migrate(clone(d)); save(true); if (ui.screen !== 'home') history.back(); else render(); toast('Backup restored', { label: 'Undo', fn: undo });
    } });
  };
  function backupData() { return JSON.stringify({ app: 'timetable-maker', v: 1, exportedAt: new Date().toISOString(), state: S }); }
  $('#restore-input').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const st = j && j.state ? j.state : j;
      if (!st || !Array.isArray(st.timetables)) throw new Error('bad');
      openSheet({ type: 'restore', data: migrate(st) });
    } catch (err) { toast('That file isn’t a timetable backup'); }
  });

  // ---------------------------------------------------------------- events
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const f = A[el.dataset.act];
    if (f) { ev.preventDefault(); f(el, ev); }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.id === 'note-new') { ev.preventDefault(); A['note-add'](); }
  });
  document.addEventListener('input', ev => {
    const el = ev.target; const k = el.dataset.in;
    if (el.dataset.period != null) return; // handled on change
    if (!k) return;
    const v = el.value;
    const updCount = () => { const c = el.parentElement.querySelector('[data-count]') || (el.closest('.field') && el.closest('.field').querySelector('[data-count]')); if (c) { const max = +el.maxLength; c.textContent = v.length + '/' + max; c.classList.toggle('max', v.length >= max); } };
    updCount();
    const t = cur();
    if (k.startsWith('tt.')) { t[k.slice(3)] = v; touch(); const h = $('#live-header'); if (h) h.innerHTML = headerPreview(t); if (k === 'tt.title') { const h1 = $('.topbar h1'); if (h1) h1.textContent = v || 'Untitled'; } return; }
    if (k === 'set.name') { S.settings.name = v; save(); return; }
    if (k === 'title-color') { t.titleColor = v.toUpperCase(); touch(); const h = $('#live-header'); if (h) h.innerHTML = headerPreview(t); return; }
    if (!sheet) return;
    if (k === 'room' || k === 'asgLabel' || k === 'quizLabel') { const e = cellTarget(); if (e) { e[k] = v; touch(); refreshCellPreview(); } return; }
    if (k === 'quick-name') { sheet.newName = v; return; }
    if (k === 'quick-color') { sheet.newColor = v.toUpperCase(); return; }
    if (k === 'subj-name') { sheet.draft.name = v; const b = $('[data-act=subj-save]'); if (b) b.disabled = !v.trim(); refreshSubjPreview(); return; }
    if (k === 'subj-color') { sheet.draft.color = v.toUpperCase(); refreshSubjPreview(); return; }
    if (k === 'note-text') { sheet.draft.text = v; const b = $('[data-act=note-save]'); if (b) b.disabled = !v.trim(); return; }
    if (k === 'new-title') { sheet.title = v; return; }
  });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.period != null) { const p = S.settings.periods[+el.dataset.period]; if (el.value) p[el.dataset.k] = el.value; save(true); return; }
    const k = el.dataset.in;
    if (k === 'subj-color' || k === 'quick-color') renderSheet();
    if (k === 'title-color') render();
  });
  function refreshSubjPreview() {
    if (!sheet || sheet.type !== 'subject') return;
    const s = sheet.draft;
    const fake = { subjects: [{ id: 'x', name: s.name || 'Subject', color: s.color }], slots: { sat: { 1: { split: false, both: TTSeed.newEntry('x', 'lec', 'C101') }, 2: { split: true, s1: TTSeed.newEntry('x', 'tut', 'C409'), s2: TTSeed.newEntry('x', 'lab', 'B2') } } } };
    const box = $('#subj-preview'); if (box) box.innerHTML = T.renderRow(fake, S.settings, 'sat', 1) + '<div style="height:10px"></div>' + T.renderRow(fake, S.settings, 'sat', 2);
  }

  // ================================================================= EXPORT: PNG
  let fontCSSPromise = null;
  function blobToDataURL(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }
  async function embeddedFontCSS() {
    if (!fontCSSPromise) fontCSSPromise = (async () => {
      const css = await (await fetch(FONT_CSS_URL)).text();
      const blocks = css.match(/(\/\*\s*[\w-]+\s*\*\/\s*)?@font-face\s*{[^}]*}/g) || [];
      const keep = blocks.filter(b => { const m = b.match(/\/\*\s*([\w-]+)\s*\*\//); return !m || m[1] === 'latin' || m[1] === 'arabic'; });
      const out = [];
      for (const b of keep) {
        const m = b.match(/url\(([^)]+)\)/);
        if (!m) continue;
        const u = m[1].replace(/["']/g, '');
        const data = await blobToDataURL(await (await fetch(u)).blob());
        out.push(b.replace(m[0], `url(${data})`));
      }
      if (!out.length) throw new Error('no fonts');
      return out.join('\n');
    })().catch(e => { fontCSSPromise = null; throw e; });
    return fontCSSPromise;
  }
  function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('render failed')); i.src = src; }); }
  async function exportPNG(t, day) {
    const host = $('#render-host');
    host.innerHTML = T.renderTimetable(t, S.settings, { day });
    const root = host.firstElementChild;
    try { await document.fonts.ready; } catch (e) { }
    const w = root.offsetWidth, h = Math.ceil(root.getBoundingClientRect().height);
    let css = '', fontWarn = false;
    try { css = await embeddedFontCSS(); } catch (e) { fontWarn = true; }
    const xhtml = new XMLSerializer().serializeToString(root);
    const SC = 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * SC}" height="${h * SC}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px"><style>${css}</style>${xhtml}</div></foreignObject></svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    // first load lets the embedded fonts decode, the second draw uses them
    await loadImage(url);
    await new Promise(r => setTimeout(r, 250));
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = w * SC; canvas.height = h * SC;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#E8EAEF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    host.innerHTML = '';
    const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('image too large')), 'image/png'));
    return { blob, fontWarn, width: w * SC, height: h * SC };
  }
  function fileName(s) { return (String(s || 'timetable').trim().replace(/[^\w؀-ۿ -]+/g, '').replace(/\s+/g, '-') || 'timetable').slice(0, 60); }
  function downloadBlob(blob, name) {
    const a = document.createElement('a'); const u = URL.createObjectURL(blob);
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 4000);
  }

  // ================================================================= EXPORT: PDF (vector, via the system "Save as PDF")
  async function printTimetables(list) {
    if (!list.length) return;
    const host = $('#render-host');
    const pages = [];
    for (const t of list) {
      host.innerHTML = T.renderTimetable(t, S.settings);
      const r = host.firstElementChild;
      pages.push({ html: host.innerHTML, w: r.offsetWidth, h: Math.ceil(r.getBoundingClientRect().height) });
    }
    host.innerHTML = '';
    $('#print-style').textContent = pages.map((p, i) => `@page tt${i}{size:${p.w}px ${p.h}px;margin:0}\n.pp[data-i="${i}"]{page:tt${i};width:${p.w}px;height:${p.h}px}`).join('\n');
    $('#print-root').innerHTML = pages.map((p, i) => `<div class="pp" data-i="${i}">${p.html}</div>`).join('');
    const titleBefore = document.title;
    document.title = list.length === 1 ? fileName(list[0].title) : 'timetables';
    try { await document.fonts.ready; } catch (e) { }
    await new Promise(r => setTimeout(r, 120));
    const cleanup = () => { document.title = titleBefore; $('#print-root').innerHTML = ''; $('#print-style').textContent = ''; window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    try { window.print(); } catch (e) { toast('Printing isn’t available here — open the app in Chrome'); cleanup(); }
  }

  // ================================================================= boot
  load();
  history.replaceState(navState(), '');
  render();
  // keep "Settings" status fresh
  const obs = new MutationObserver(() => { if ($('#offline-status') && !$('#offline-status')._done) { $('#offline-status')._done = true; offlineStatus(); } });
  obs.observe($('#app'), { childList: true });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => { if (nw.state === 'activated' && hadController) toast('App updated — reopen to use the new version'); });
      });
    }).catch(() => { });
  }
  // expose for tests
  window.__tt = { get state() { return S; }, exportPNG, printTimetables, embeddedFontCSS, render };
})();
