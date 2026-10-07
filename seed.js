/* First-run data: the two approved timetables (odd / even week). */
(function (global) {
  'use strict';
  const PERIODS = [
    { start: '08:30', end: '10:10' },
    { start: '10:20', end: '12:00' },
    { start: '12:10', end: '13:50' },
    { start: '14:00', end: '15:40' },
    { start: '15:50', end: '17:30' },
    { start: '17:40', end: '19:20' }
  ];

  function E(subject, type, room, extra) {
    return Object.assign({ subject, type, room: room || '', roomFont: 'rubik', asg: false, asgLabel: 'Assignment', quiz: false, quizLabel: 'Quiz' }, extra || {});
  }
  const both = e => ({ split: false, both: e, s1: null, s2: null });
  const split = (a, b) => ({ split: true, both: null, s1: a, s2: b });

  function subjects() {
    return [
      { id: 'math', name: 'Math', color: '#2952CC' },
      { id: 'chem', name: 'Chemistry', color: '#2E7D32' },
      { id: 'phys', name: 'Physics', color: '#6B43C9' },
      { id: 'stat', name: 'Statics', color: '#C0392B' },
      { id: 'hist', name: 'History', color: '#7A5C3E' },
      { id: 'tech', name: 'Tech Writing', color: '#A8336F' },
      { id: 'manu', name: 'Manufacturing', color: '#00798A' },
      { id: 'cont', name: 'Contemporary Issues', color: '#4F5D73' }
    ];
  }
  const satNotes = () => ['Lab coat & gloves', 'Chemistry kit', 'Chemistry lab note', 'Physics booklet', 'Pencil & ruler']
    .map((text, i) => ({ id: 'n' + i, text, sec: 'both', font: 'sans' }));

  function week(odd) {
    const now = Date.now();
    return {
      id: odd ? 'tt-odd' : 'tt-even',
      createdAt: now, updatedAt: now,
      title: odd ? 'Odd week' : 'Even week',
      titleAr: odd ? 'الأسبوع الفردي' : 'الأسبوع الزوجي',
      titleStyle: odd ? 'filled' : 'outline',
      titleColor: '#15171C',
      label: 'TIMETABLE',
      group: 'Group 11',
      days: ['sat', 'sun', 'mon', 'thu'],
      subjects: subjects(),
      slots: {
        sat: {
          2: both(E('math', 'lec', 'C101')),
          3: both(E('chem', 'lab', '')),
          4: both(E('chem', 'lec', 'C201')),
          5: both(E('phys', 'lab', ''))
        },
        sun: {
          1: split(E('math', 'tut', 'C409'), E('stat', 'tut', 'C407', { asg: true })),
          2: both(E('stat', 'lec', 'C202')),
          3: both(E('hist', 'lec', 'H401'))
        },
        mon: {
          2: split(E('stat', 'tut', 'C409', { asg: true }), E('math', 'tut', 'C410')),
          3: both(E('phys', 'lec', 'H301')),
          4: odd ? split(E('chem', 'tut', 'C409'), null) : split(null, E('chem', 'tut', 'C409')),
          5: both(E('tech', 'lec', 'C202'))
        },
        thu: odd ? {
          1: split(E('manu', 'tut', 'C501', { asg: true, asgLabel: 'Sheet' }), E('phys', 'tut', 'C502')),
          2: both(E('manu', 'lec', 'H501')),
          3: both(E('cont', 'lec', 'C203'))
        } : {
          1: split(E('phys', 'tut', 'C501'), E('manu', 'tut', 'C502', { asg: true, asgLabel: 'Sheet' })),
          2: both(E('manu', 'lec', 'H501'))
        }
      },
      notes: { sat: satNotes() }
    };
  }

  function defaultState() {
    return {
      v: 1,
      settings: { name: 'Ahmed Samy', theme: 'system', periods: PERIODS.map(p => Object.assign({}, p)) },
      timetables: [week(true), week(false)]
    };
  }

  global.TTSeed = { defaultState, PERIODS, newEntry: E };
})(typeof window !== 'undefined' ? window : globalThis);
