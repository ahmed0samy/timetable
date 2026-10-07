/* Timetable renderer — reproduces the approved design exactly.
   Pure functions: data in, HTML string out (inline styles only, so the same
   markup works on screen, in print/PDF and inside the PNG exporter). */
(function (global) {
  'use strict';

  const DAYS = [
    { k: 'sat', en: 'SATURDAY', ar: 'السبت', short: 'Sat' },
    { k: 'sun', en: 'SUNDAY', ar: 'الأحد', short: 'Sun' },
    { k: 'mon', en: 'MONDAY', ar: 'الإثنين', short: 'Mon' },
    { k: 'tue', en: 'TUESDAY', ar: 'الثلاثاء', short: 'Tue' },
    { k: 'wed', en: 'WEDNESDAY', ar: 'الأربعاء', short: 'Wed' },
    { k: 'thu', en: 'THURSDAY', ar: 'الخميس', short: 'Thu' },
    { k: 'fri', en: 'FRIDAY', ar: 'الجمعة', short: 'Fri' }
  ];
  const DAY = Object.fromEntries(DAYS.map(d => [d.k, d]));

  // Subject colour presets. The first nine are the exact colours of the approved design.
  const PRESETS = [
    { name: 'Blue', strong: '#2952CC', tint: '#E9EEFC', ink: '#1D3A94' },
    { name: 'Violet', strong: '#6B43C9', tint: '#F0EBFB', ink: '#4A2B96', stripe: '#DDD2F6' },
    { name: 'Green', strong: '#2E7D32', tint: '#E7F3E8', ink: '#1F5A23', stripe: '#CDE6D0' },
    { name: 'Red', strong: '#C0392B', tint: '#FBE9E7', ink: '#8C251B' },
    { name: 'Teal', strong: '#00798A', tint: '#E0F2F4', ink: '#005663' },
    { name: 'Brown', strong: '#7A5C3E', tint: '#F3EDE6', ink: '#57412B' },
    { name: 'Magenta', strong: '#A8336F', tint: '#FAE8F1', ink: '#7A2350' },
    { name: 'Slate', strong: '#4F5D73', tint: '#EBEEF2', ink: '#374152' },
    { name: 'Orange', strong: '#B4530F', tint: '#FCEEE2', ink: '#84390A' },
    { name: 'Gold', strong: '#9A6B00' },
    { name: 'Navy', strong: '#1E3A8A' },
    { name: 'Rose', strong: '#BE185D' },
    { name: 'Pine', strong: '#0F766E' },
    { name: 'Olive', strong: '#5F6B1F' },
    { name: 'Sky', strong: '#0369A1' },
    { name: 'Rust', strong: '#9A3412' },
    { name: 'Indigo', strong: '#4338CA' },
    { name: 'Plum', strong: '#86198F' },
    { name: 'Graphite', strong: '#374151' }
  ];

  const ROOM_FONTS = {
    rubik: "'Rubik', sans-serif",
    sans: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif",
    arabic: "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif"
  };
  const FONT_LABELS = { rubik: 'Rubik', sans: 'Plex Sans', arabic: 'Plex Arabic' };

  const LIMITS = { subject: 27, room: 20, note: 40, title: 22, titleAr: 24, label: 16, group: 20, name: 24, tag: 14 };

  // ---------- colour helpers ----------
  function hexToRgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r) {
    return '#' + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function mix(a, b, t) { // t = share of b
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x.map((v, i) => v + (y[i] - v) * t));
  }
  function luminance(hex) {
    const c = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrastWithWhite(hex) { return 1.05 / (luminance(hex) + 0.05); }
  function palette(hex) {
    hex = (hex || '#4F5D73').toUpperCase();
    const p = PRESETS.find(x => x.strong.toUpperCase() === hex) || { strong: hex };
    return {
      strong: p.strong,
      tint: p.tint || mix(p.strong, '#FFFFFF', 0.9),
      stripe: p.stripe || mix(p.strong, '#FFFFFF', 0.78),
      ink: p.ink || mix(p.strong, '#000000', 0.3)
    };
  }

  // ---------- text helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function to12(t) { // "13:50" -> "01:50", always two digits, no am/pm
    if (!t) return '';
    let [h, m] = String(t).split(':').map(Number);
    if (isNaN(h)) return t;
    h = h % 12; if (h === 0) h = 12;
    return String(h).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0');
  }
  function initials(name) {
    const w = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((w[0] || '')[0] || '').toUpperCase() + ((w[1] || '')[0] || '').toUpperCase();
  }

  // ---------- icons (exact paths from the design) ----------
  const SVG = (w, sw, inner, extra) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${extra || ''}>${inner}</svg>`;
  const I_LEC = '<rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M12 16v4M8 20h8"></path>';
  const I_TUT = '<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path>';
  const I_LAB = '<path d="M9 3h6"></path><path d="M10 3v6l-5.6 9.4A1.7 1.7 0 0 0 5.9 21h12.2a1.7 1.7 0 0 0 1.5-2.6L14 9V3"></path><path d="M7 15h10"></path>';
  const I_PIN = '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"></path><circle cx="12" cy="10" r="2.3"></circle>';
  const I_DOC = '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path>';
  const I_QUIZ = '<circle cx="12" cy="12" r="9"></circle><path d="M12 7.5v5.5"></path><path d="M12 16.5v.5"></path>';
  const I_CHECK = '<path d="M9 11l3 3 8-8"></path><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"></path>';
  const TYPE_ICON = { lec: I_LEC, tut: I_TUT, lab: I_LAB };
  const TYPE_LABEL = { lec: 'LECTURE', tut: 'TUTORIAL', lab: 'LAB' };

  // ---------- data helpers ----------
  function subjectOf(tt, id) { return (tt.subjects || []).find(s => s.id === id) || null; }
  function cellOf(tt, day, p) { return ((tt.slots || {})[day] || {})[p] || null; }
  function entryValid(tt, e) { return !!(e && e.subject && subjectOf(tt, e.subject)); }
  function cellHasContent(tt, c) {
    if (!c) return false;
    if (c.split) return entryValid(tt, c.s1) || entryValid(tt, c.s2);
    return entryValid(tt, c.both);
  }
  function periodsOfDay(tt, day, nPeriods) {
    const out = [];
    for (let p = 1; p <= nPeriods; p++) if (cellHasContent(tt, cellOf(tt, day, p))) out.push(p);
    return out;
  }
  function tagLabel(e, kind) {
    const v = kind === 'asg' ? (e.asgLabel || 'Assignment') : (e.quizLabel || 'Quiz');
    return v.trim() || (kind === 'asg' ? 'Assignment' : 'Quiz');
  }
  // Notes for a day: automatic ones (assignment / quiz flags, in period order) then manual ones.
  function notesOfDay(tt, day, nPeriods) {
    const auto = [];
    for (let p = 1; p <= nPeriods; p++) {
      const c = cellOf(tt, day, p);
      if (!cellHasContent(tt, c)) continue;
      const parts = c.split ? [['s1', c.s1], ['s2', c.s2]] : [['both', c.both]];
      for (const [sec, e] of parts) {
        if (!entryValid(tt, e)) continue;
        const s = subjectOf(tt, e.subject);
        if (e.asg) auto.push({ auto: true, sec, text: s.name + ' ' + tagLabel(e, 'asg').toLowerCase(), font: 'sans', p });
        if (e.quiz) auto.push({ auto: true, sec, text: s.name + ' ' + tagLabel(e, 'quiz').toLowerCase(), font: 'sans', p });
      }
    }
    const manual = ((tt.notes || {})[day] || []).filter(n => n && String(n.text || '').trim());
    return auto.concat(manual);
  }

  // ---------- pieces ----------
  function rail(start, end) {
    return `<div style="width: 56px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-start; padding: 2px 0"><span style="font-family: 'Rubik', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums">${esc(to12(start))}</span><span style="flex: 1; min-height: 12px; width: 2px; margin: 6px 0 6px 8px; border-radius: 2px; background: #C5C9D2"></span><span style="font-family: 'Rubik', sans-serif; font-size: 15px; font-weight: 500; line-height: 1.2; color: #5A5F6E; font-variant-numeric: tabular-nums">${esc(to12(end))}</span></div>`;
  }
  function tagChips(e) {
    let h = '';
    if (e.asg) h += `<span style="display: inline-flex; align-items: center; gap: 4px; background: #FFD84A; color: #2B2300; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; padding: 3px 7px; border-radius: 6px">${SVG(12, 2.4, I_DOC)}${esc(tagLabel(e, 'asg'))}</span>`;
    if (e.quiz) h += `<span style="display: inline-flex; align-items: center; gap: 4px; background: #FFD84A; color: #2B2300; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; padding: 3px 7px; border-radius: 6px">${SVG(12, 2.4, I_QUIZ)}${esc(tagLabel(e, 'quiz'))}</span>`;
    return h;
  }
  function roomFont(e) { return ROOM_FONTS[e.roomFont] || ROOM_FONTS.rubik; }
  function isLong(room) { return String(room || '').trim().length > 8; }

  function fullCard(tt, e) {
    const s = subjectOf(tt, e.subject), P = palette(s.color), t = e.type || 'lec';
    let box;
    if (t === 'lec') box = `background: ${P.strong}; color: #FFFFFF;`;
    else if (t === 'lab') box = `background: repeating-linear-gradient(135deg, ${P.tint} 0px, ${P.tint} 10px, ${P.stripe} 10px, ${P.stripe} 20px); border: 2px dashed ${P.strong}; color: ${P.ink};`;
    else box = `background: ${P.tint}; border: 2px solid ${P.strong}; color: ${P.ink};`;
    let pill;
    if (t === 'lec') pill = `<span style="display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 7px; background: rgba(255, 255, 255, 0.22)">${SVG(14, 2.2, I_LEC)}LECTURE</span>`;
    else if (t === 'lab') pill = `<span style="display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 7px; background: ${P.strong}; color: #FFFFFF">${SVG(14, 2.2, I_LAB)}LAB</span>`;
    else pill = `<span style="display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 7px; background: #FFFFFF; border: 1.5px solid ${P.strong}">${SVG(13, 2.2, I_TUT)}TUTORIAL</span>`;
    const tags = tagChips(e);
    const pillBlock = tags ? `<div style="display: flex; flex-wrap: wrap; gap: 6px">${pill}${tags}</div>` : pill;
    let room = '';
    const r = String(e.room || '').trim();
    if (r) {
      const bg = t === 'lec' ? 'rgba(255, 255, 255, 0.2)' : '#FFFFFF';
      const fs = isLong(r) ? 20 : 23;
      room = `<span style="display: inline-flex; align-items: center; gap: 6px; font-family: ${roomFont(e)}; font-size: ${fs}px; font-weight: 600; padding: 7px 11px; border-radius: 11px; background: ${bg}; max-width: 100%; box-sizing: border-box">${SVG(16, 2.2, I_PIN, ' style="flex-shrink: 0"')}<span dir="auto" style="overflow-wrap: anywhere">${esc(r)}</span></span>`;
    }
    return `<div style="flex: 1; min-width: 0; box-sizing: border-box; min-height: 100px; border-radius: 16px; ${box} padding: 14px 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px">
<div style="flex: 1 1 120px; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 8px"><span dir="auto" style="font-size: 24px; font-weight: 700; line-height: 1.1; letter-spacing: -0.01em; overflow-wrap: break-word; hyphens: auto" lang="en">${esc(s.name)}</span>${pillBlock}</div>${room}
</div>`;
  }

  function half(tt, e, sec) {
    const barBase = "height: 32px; display: flex; align-items: center; justify-content: center; font-family: 'Rubik', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.08em";
    const label = sec === 's1' ? 'S1' : 'S2';
    if (!entryValid(tt, e)) {
      return `<div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; box-sizing: border-box; border-radius: 14px; overflow: hidden; border: 2px dashed #D3D6DE; color: #8A8F9C">
<div style="${barBase.replace('display: flex;', 'display: flex; color: #6B7080; border-bottom: 2px dashed #D3D6DE;')}">${label}</div>
<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 14px 8px; font-size: 16px; font-weight: 600">No class</div>
</div>`;
    }
    const s = subjectOf(tt, e.subject), P = palette(s.color), t = e.type || 'tut';
    let box;
    if (t === 'lec') box = `border: 2px solid ${P.strong}; background: ${P.strong}; color: #FFFFFF`;
    else if (t === 'lab') box = `border: 2px dashed ${P.strong}; background: repeating-linear-gradient(135deg, ${P.tint} 0px, ${P.tint} 10px, ${P.stripe} 10px, ${P.stripe} 20px); color: ${P.ink}`;
    else box = `border: 2px solid ${P.strong}; background: ${P.tint}; color: ${P.ink}`;
    const bar = sec === 's1'
      ? `<div style="${barBase.replace('display: flex;', 'display: flex; background: #15171C; color: #FFFFFF; border-bottom: 2px solid #15171C;')}">S1</div>`
      : `<div style="${barBase.replace('display: flex;', `display: flex; background: #FFFFFF; color: #15171C; border-bottom: 2px solid ${P.strong};`)}">S2</div>`;
    let pill;
    if (t === 'lec') pill = `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.22)">${SVG(12, 2.4, I_LEC)}LECTURE</span>`;
    else if (t === 'lab') pill = `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 6px; background: ${P.strong}; color: #FFFFFF">${SVG(12, 2.4, I_LAB)}LAB</span>`;
    else pill = `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 6px; background: #FFFFFF; border: 1.5px solid ${P.strong}">${SVG(12, 2.4, I_TUT)}TUTORIAL</span>`;
    let room = '';
    const r = String(e.room || '').trim();
    if (r) {
      const bg = t === 'lec' ? 'rgba(255, 255, 255, 0.2)' : '#FFFFFF';
      const fs = isLong(r) ? 17 : 20;
      room = `<span style="margin-top: auto; display: inline-flex; align-items: center; gap: 4px; font-family: ${roomFont(e)}; font-size: ${fs}px; font-weight: 600; padding: 4px 8px; border-radius: 9px; background: ${bg}; max-width: 100%; box-sizing: border-box">${SVG(14, 2.2, I_PIN, ' style="flex-shrink: 0"')}<span dir="auto" style="overflow-wrap: anywhere">${esc(r)}</span></span>`;
    }
    return `<div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; box-sizing: border-box; border-radius: 14px; overflow: hidden; ${box}">
${bar}
<div style="flex: 1; padding: 14px 7px; display: flex; flex-direction: column; align-items: flex-start; gap: 9px">
<span dir="auto" style="font-size: 19px; font-weight: 700; line-height: 1.15; letter-spacing: -0.01em; overflow-wrap: break-word; hyphens: auto" lang="en">${esc(s.name)}</span>
<div style="display: flex; flex-wrap: wrap; gap: 5px">${pill}${tagChips(e)}</div>
${room}
</div>
</div>`;
  }

  function row(tt, settings, day, p) {
    const c = cellOf(tt, day, p);
    if (!cellHasContent(tt, c)) return '';
    const per = (settings.periods || [])[p - 1] || {};
    const body = c.split
      ? `<div style="flex: 1; min-width: 0; display: flex; gap: 6px">${half(tt, c.s1, 's1')}${half(tt, c.s2, 's2')}</div>`
      : fullCard(tt, c.both);
    return `<div style="display: flex; gap: 6px; align-items: stretch">
${rail(per.start, per.end)}
${body}
</div>`;
  }

  function secChip(sec) {
    if (sec === 's1') return `<span style="font-family: 'Rubik', sans-serif; font-size: 13px; font-weight: 700; line-height: 1; padding: 4px 6px; border-radius: 5px; background: #15171C; color: #FFFFFF; border: 1.5px solid #15171C; flex-shrink: 0">S1</span>`;
    if (sec === 's2') return `<span style="font-family: 'Rubik', sans-serif; font-size: 13px; font-weight: 700; line-height: 1; padding: 4px 6px; border-radius: 5px; background: #FFFFFF; color: #15171C; border: 1.5px solid #15171C; flex-shrink: 0">S2</span>`;
    return '';
  }

  function forgetBox(notes) {
    if (!notes.length) return '';
    const items = notes.map(n => {
      const f = n.font && n.font !== 'sans' ? ROOM_FONTS[n.font] : null;
      const text = f ? `<span dir="auto" style="font-family: ${f}">${esc(n.text)}</span>` : `<span dir="auto">${esc(n.text)}</span>`;
      return `<div style="display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600; color: #2B2300"><span style="width: 16px; height: 16px; box-sizing: border-box; border: 2px solid #B89A2E; border-radius: 4px; background: #FFFFFF; flex-shrink: 0"></span>${secChip(n.sec)}${text}</div>`;
    }).join('\n');
    return `<div style="margin-top: auto; display: flex; gap: 10px; align-items: flex-start; background: #FFF3C4; border: 1.5px solid #E8C547; border-radius: 14px; padding: 12px 14px; color: #4D3B00">
${SVG(22, 2.2, I_CHECK, ' style="flex-shrink: 0; margin-top: 1px"')}
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px"><span style="font-size: 14px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase">Don't forget</span><span lang="ar" dir="rtl" style="font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 16px; font-weight: 700">متنساش</span></div>
<div style="display: flex; flex-direction: column; gap: 7px">
${items}
</div>
</div>
</div>`;
  }

  function dayPanel(tt, settings, day) {
    const d = DAY[day];
    const n = (settings.periods || []).length;
    const ps = periodsOfDay(tt, day, n);
    const rows = ps.map(p => row(tt, settings, day, p)).join('\n\n');
    const notes = notesOfDay(tt, day, n);
    const list = ps.length
      ? `<div style="display: flex; flex-direction: column; gap: 10px">\n\n${rows}\n\n</div>`
      : `<div style="flex: 1; min-height: 120px; display: flex; align-items: center; justify-content: center; color: #9AA0AE; font-size: 16px; font-weight: 600">No classes</div>`;
    return `<section style="box-sizing: border-box; background: #FFFFFF; border-radius: 22px; padding: 16px 14px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; padding: 0 4px 10px; border-bottom: 2px solid #15171C">
<span style="font-size: 13px; font-weight: 600; letter-spacing: 0.14em; color: #6B7080">${d.en}</span>
<span lang="ar" dir="rtl" style="font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 30px; font-weight: 700; line-height: 1">${d.ar}</span>
</div>

${list}

${forgetBox(notes)}
</section>`;
  }

  function header(tt, settings, single) {
    const C = (tt.titleColor || '#15171C').toUpperCase();
    const black = C === '#15171C';
    const ar = String(tt.titleAr || '').trim();
    let badge;
    if (tt.titleStyle === 'outline') {
      badge = `<span style="display: inline-flex; align-items: center; gap: 12px; padding: 6px 16px; border-radius: 14px; background: #FFFFFF; color: ${black ? '#15171C' : C}; border: 2px solid ${C}"><span style="font-size: 30px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1">${esc(tt.title)}</span>${ar ? `<span lang="ar" dir="rtl" style="font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 24px; font-weight: 600; color: #5A5F6E">${esc(ar)}</span>` : ''}</span>`;
    } else {
      badge = `<span style="display: inline-flex; align-items: center; gap: 12px; padding: 8px 18px; border-radius: 14px; background: ${C}; color: #FFFFFF"><span style="font-size: 30px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1">${esc(tt.title)}</span>${ar ? `<span lang="ar" dir="rtl" style="font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 24px; font-weight: 600; color: ${black ? '#C5C9D2' : 'rgba(255, 255, 255, 0.78)'}">${esc(ar)}</span>` : ''}</span>`;
    }
    const label = String(tt.label == null ? 'TIMETABLE' : tt.label).trim();
    const name = String(settings.name || '').trim();
    const group = String(tt.group || '').trim();
    const chip = (name || group) ? `<div style="display: inline-flex; align-items: center; gap: 10px; padding: 5px 16px 5px 5px; border-radius: 999px; background: #FFFFFF">
${name ? `<span style="width: 32px; height: 32px; border-radius: 50%; background: #15171C; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; letter-spacing: 0.04em">${esc(initials(name))}</span>
<span dir="auto" style="font-size: 15px; font-weight: 600; color: #2A2D35">${esc(name)}</span>` : ''}
${name && group ? '<span style="width: 1px; height: 16px; background: #D3D6DE"></span>' : ''}
${group ? `<span dir="auto" style="font-size: 14px; font-weight: 500; color: #6B7080${name ? '' : '; padding-left: 11px'}">${esc(group)}</span>` : ''}
</div>` : '';
    return `<header style="display: flex; align-items: center; justify-content: space-between; gap: 24px${single ? '; flex-wrap: wrap; row-gap: 14px' : ''}">
<div style="display: flex; align-items: center; gap: 16px${single ? '; flex-wrap: wrap; row-gap: 10px' : ''}">
${badge}
${label ? `<span style="font-size: 14px; font-weight: 600; letter-spacing: 0.14em; color: #6B7080">${esc(label.toUpperCase())}</span>` : ''}
</div>
${chip}
</header>`;
  }

  const COL = 392, GAP = 16, PADX = 32;
  function widthFor(n) { return PADX * 2 + n * COL + Math.max(0, n - 1) * GAP; }
  function daysOf(tt) { return DAYS.map(d => d.k).filter(k => (tt.days || []).includes(k)); }

  // opts.day -> single-day image layout
  function renderTimetable(tt, settings, opts) {
    opts = opts || {};
    const days = opts.day ? [opts.day] : daysOf(tt);
    const n = Math.max(1, days.length);
    const W = widthFor(n);
    const single = !!opts.day;
    const panels = days.map(k => dayPanel(tt, settings, k)).join('\n\n');
    return `<div class="tt-root" style="width: ${W}px; ${single ? '' : 'min-height: 950px; '}box-sizing: border-box; padding: 30px 32px 32px; background: #E8EAEF; color: #15171C; font-family: 'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif; display: flex; flex-direction: column; gap: 20px">
${header(tt, settings, single)}
<div style="flex: 1; display: grid; grid-template-columns: repeat(${n}, minmax(0, 1fr)); gap: 16px; align-items: stretch">

${panels}

</div>
</div>`;
  }

  global.TT = {
    DAYS, DAY, PRESETS, ROOM_FONTS, FONT_LABELS, LIMITS,
    palette, mix, contrastWithWhite, esc, to12, initials,
    subjectOf, cellOf, entryValid, cellHasContent, periodsOfDay, notesOfDay, tagLabel,
    renderTimetable, renderRow: row, renderDayPanel: dayPanel, renderForget: forgetBox,
    widthFor, daysOf, COL,
    icons: { I_LEC, I_TUT, I_LAB, I_PIN, I_DOC, I_QUIZ, I_CHECK, SVG }
  };
})(typeof window !== 'undefined' ? window : globalThis);
