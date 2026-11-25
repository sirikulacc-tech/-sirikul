/* ===== ธีมเทศกาล (Sirikul Accounting) =====
   16 เทศกาล แต่ละแบบมีภาษาภาพของตัวเอง: แบนเนอร์ดูเดิลที่เล่นกับคำว่า "Sirikul Accounting" และโลโก้ + เอฟเฟกต์เบาๆ ลอยทั่วจอ + สีแถบหัว
   เลือกธีมอัตโนมัติตามวันที่ (วันลอยกระทงคำนวณจากข้างขึ้นข้างแรม) แอดมินเลือกเอง/ปิดได้ในหน้า "ตั้งค่า" (เก็บที่ Apps Script: themeMode)
   ลองดูตัวอย่างโดยเติม ?theme=รหัส ท้ายลิงก์ เช่น ?theme=songkran (ปิด: ?theme=off)
   ไฟล์นี้ต้องโหลดก่อน app.js สไตล์อยู่ใน fest.css ธีมที่ไม่ได้ใช้จะไม่โหลดฟอนต์ตกแต่ง */
var FEST = (function () {
  var LIST = [
    { id: 'newyear', name: 'ปีใหม่', emoji: '🎆', when: '28 ธ.ค. – 3 ม.ค.' },
    { id: 'xmas', name: 'คริสต์มาส', emoji: '🎄', when: '18 – 27 ธ.ค.' },
    { id: 'cny', name: 'ตรุษจีน', emoji: '🧧', when: 'ก่อน-หลังวันตรุษจีน' },
    { id: 'valentine', name: 'วาเลนไทน์', emoji: '💌', when: '8 – 14 ก.พ.' },
    { id: 'tax', name: 'เทศกาลยื่นภาษี', emoji: '🧮', when: '1 มี.ค. – 8 เม.ย.' },
    { id: 'songkran', name: 'สงกรานต์', emoji: '💦', when: '10 – 16 เม.ย.' },
    { id: 'halloween', name: 'ฮาโลวีน', emoji: '🎃', when: '24 – 31 ต.ค.' },
    { id: 'loy', name: 'ลอยกระทง', emoji: '🏮', when: 'วันเพ็ญเดือน 12 (ช่วง พ.ย.)' },
    { id: 'children', name: 'วันเด็ก', emoji: '🎈', when: 'เสาร์ที่ 2 ของ ม.ค. (3 วันก่อน)' },
    { id: 'veg', name: 'เทศกาลกินเจ', emoji: '🥬', when: '9 วัน ช่วง ก.ย. – ต.ค.' },
    { id: 'mother', name: 'วันแม่', emoji: '🤍', when: '5 – 12 ส.ค.' },
    { id: 'father', name: 'วันพ่อ', emoji: '💛', when: '28 พ.ย. – 5 ธ.ค.' },
    { id: 'visakha', name: 'วิสาขบูชา', emoji: '🪷', when: 'วันเพ็ญเดือน 6 (ช่วง พ.ค.)' },
    { id: 'lent', name: 'เข้าพรรษา', emoji: '🕯️', when: 'วันเพ็ญเดือน 8 (ช่วง ก.ค.)' },
    { id: 'easter', name: 'อีสเตอร์', emoji: '🐰', when: 'ศุกร์ประเสริฐ – วันอีสเตอร์' },
    { id: 'labour', name: 'วันแรงงาน', emoji: '🛠️', when: '29 เม.ย. – 3 พ.ค.' }
  ];
  var BY = {}; LIST.forEach(function (t) { BY[t.id] = t; });

  /* ---------- เลือกธีมตามวันที่ ---------- */
  var DAY = 86400000;
  function dn(y, m, d) { return Math.floor(Date.UTC(y, m - 1, d) / DAY); }
  var CNY = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [2, 8], 2036: [1, 28], 2037: [2, 15], 2038: [2, 4], 2039: [1, 24], 2040: [2, 12] };
  // วันลอยกระทง = คืนวันเพ็ญแรกที่ตกในช่วง 30 ต.ค. – 29 พ.ย. วัดแสงจันทร์ที่ 18:00 น. เวลาไทย (11:00 UTC) ประมาณจากรอบข้างขึ้นข้างแรม คลาดเคลื่อนได้ไม่เกิน 1 วัน
  // (ปีที่ปฏิทินไทยมีอธิกมาส วันจริงอาจต่างจากที่คำนวณได้ ให้แอดมินเลือกธีมเองในหน้า "ตั้งค่า")
  function moonAge(t) { var jd = t / DAY + 2440587.5, a = (jd - 2451550.1) % 29.530588853; return a < 0 ? a + 29.530588853 : a; }
  // วันเพ็ญแรกที่ตกในช่วง n วัน นับจากวันที่ d0 ของเดือน mi (0-11) (ใช้กับลอยกระทง วิสาขบูชา อาสาฬหบูชา)
  function fullDay(y, mi, d0, n) {
    var df = [], i; for (i = 0; i < n; i++) df.push(Math.abs(moonAge(Date.UTC(y, mi, d0 + i, 11)) - 14.765));
    for (i = 0; i < n; i++) if (df[i] < 0.7 && (i === 0 || df[i] <= df[i - 1]) && (i === n - 1 || df[i] <= df[i + 1])) { var dt = new Date(Date.UTC(y, mi, d0 + i)); return dn(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()); }
    return -1;
  }
  function loyDay(y) { return fullDay(y, 9, 30, 31); }
  // วันอีสเตอร์ (ปฏิทินเกรกอเรียน)
  function easterDay(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return dn(y, mo, da);
  }
  // วันเด็ก = เสาร์ที่ 2 ของ ม.ค.
  function childDay(y) { var d = new Date(Date.UTC(y, 0, 1)), w = d.getUTCDay(), first = 1 + ((6 - w + 7) % 7); return dn(y, 1, first + 7); }
  // เทศกาลกินเจ เริ่มขึ้น 1 ค่ำ เดือน 9 ≈ 44 วันก่อนวันลอยกระทง (คาดการณ์ ±1 วัน)
  function vegStart(y) { var l = loyDay(y); return l >= 0 ? l - 44 : -1; }
  function pick(date) {
    var y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate(), t = dn(y, m, d);
    if ((m === 12 && d >= 28) || (m === 1 && d <= 3)) return 'newyear';
    if (m === 12 && d >= 18) return 'xmas';
    var cd0 = childDay(y); if (m === 1 && t >= cd0 - 3 && t <= cd0) return 'children';
    var c = CNY[y]; if (c) { var cd = dn(y, c[0], c[1]); if (t >= cd - 3 && t <= cd + 6) return 'cny'; }
    if (m === 2 && d >= 8 && d <= 14) return 'valentine';
    var ea = easterDay(y); if (t >= ea - 2 && t <= ea) return 'easter';
    if ((m === 4 && d >= 29) || (m === 5 && d <= 3)) return 'labour';
    var vi = fullDay(y, 4, 5, 30); if (vi >= 0 && t >= vi - 3 && t <= vi + 1) return 'visakha';
    var as = fullDay(y, 6, 5, 30); if (as >= 0 && t >= as - 1 && t <= as + 2) return 'lent';
    if ((m === 3) || (m === 4 && d <= 8)) return 'tax';
    if (m === 4 && d >= 10 && d <= 16) return 'songkran';
    var vs = vegStart(y); if (vs >= 0 && t >= vs - 1 && t <= vs + 9) return 'veg';
    if (m === 10 && d >= 24) return 'halloween';
    if (m === 8 && d >= 5 && d <= 12) return 'mother';
    var l = loyDay(y); if (l >= 0 && t >= l - 3 && t <= l + 1) return 'loy';
    if ((m === 11 && d >= 28) || (m === 12 && d <= 5)) return 'father';
    return '';
  }
  function active() {
    var q = /[?&]theme=([a-z]+)/.exec(location.search);
    if (q) return BY[q[1]] ? q[1] : '';
    var mode = (typeof S !== 'undefined' && S && S.themeMode) || '';
    if (mode === 'off') return '';
    if (BY[mode]) return mode;
    return pick(new Date());
  }

  /* ---------- ฟอนต์ตกแต่ง (โหลดเฉพาะธีมที่ใช้ ตัดเหลือแค่ตัวอักษรที่ต้องใช้) ---------- */
  var CH = encodeURIComponent('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 &.-');
  var FONTS = {
    songkran: 'family=Rubik+Bubbles&family=Fredoka:wght@700',
    loy: 'family=Pacifico',
    newyear: 'family=Monoton',
    cny: 'family=Cinzel+Decorative:wght@700',
    halloween: 'family=Creepster',
    xmas: 'family=Mountains+of+Christmas:wght@700',
    valentine: 'family=Sacramento',
    tax: 'family=Caveat:wght@700',
    children: 'family=Chewy',
    veg: 'family=Lobster',
    mother: 'family=Playfair+Display:ital,wght@1,700',
    father: 'family=Bungee',
    visakha: 'family=Cormorant+Garamond:ital,wght@600',
    lent: 'family=Marko+One',
    easter: 'family=Sniglet:wght@800',
    labour: 'family=Staatliches'
  };
  var loaded = {};
  function loadFonts(id) {
    var ids = id === 'all' ? Object.keys(FONTS) : [id];
    ids.forEach(function (k) {
      if (!FONTS[k] || loaded[k]) return; loaded[k] = 1;
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + FONTS[k] + '&display=swap&text=' + CH; document.head.appendChild(l);
      var zh = { cny: '福', veg: '齋' }[k];
      if (zh) { var l2 = document.createElement('link'); l2.rel = 'stylesheet'; l2.href = 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap&text=' + encodeURIComponent(zh); document.head.appendChild(l2); }
    });
  }

  /* ---------- ตัวช่วยวาด SVG ---------- */
  function sv(vb, inner, cls, st) { return '<svg class="' + (cls || '') + '" viewBox="' + vb + '"' + (st ? ' style="' + st + '"' : '') + ' aria-hidden="true" focusable="false">' + inner + '</svg>'; }
  function flower(x, y, r, col, mid) {
    var o = ''; for (var i = 0; i < 5; i++) { var a = i * 72 - 90; o += '<circle cx="' + (x + Math.cos(a * Math.PI / 180) * r * 0.9).toFixed(1) + '" cy="' + (y + Math.sin(a * Math.PI / 180) * r * 0.9).toFixed(1) + '" r="' + r * 0.62 + '"/>'; }
    return '<g fill="' + col + '">' + o + '</g><circle cx="' + x + '" cy="' + y + '" r="' + r * 0.34 + '" fill="' + (mid || '#ffd166') + '"/>';
  }
  function burst(x, y, r, col, cls, delay) {
    var o = ''; for (var i = 0; i < 12; i++) { var a = i * 30 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); o += '<line x1="' + (c * r * 0.32).toFixed(1) + '" y1="' + (s * r * 0.32).toFixed(1) + '" x2="' + (c * r).toFixed(1) + '" y2="' + (s * r).toFixed(1) + '"/><circle cx="' + (c * r * 1.18).toFixed(1) + '" cy="' + (s * r * 1.18).toFixed(1) + '" r="1.8" fill="' + col + '" stroke="none"/>'; }
    return '<g transform="translate(' + x + ' ' + y + ')"><g class="fw ' + (cls || '') + '" style="animation-delay:' + (delay || 0) + 's" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round">' + o + '</g></g>';
  }
  function heart(x, y, s, st, cls) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path class="' + (cls || '') + '" d="M0 6C-10 -4 -6 -12 0 -6C6 -12 10 -4 0 6Z" ' + st + '/></g>'; }
  function drips(n, w, col) {
    var o = '<rect x="0" y="0" width="' + w + '" height="7" rx="3.5"/>', gap = (w - 14) / n;
    for (var i = 0; i < n; i++) { var x = 6 + i * gap + (i % 2) * 2, h = 11 + ((i * 7) % 5) * 5; o += '<rect class="dr" style="animation-delay:' + (i * 0.37).toFixed(2) + 's" x="' + x.toFixed(1) + '" y="0" width="' + (5 + (i % 3)) + '" height="' + h + '" rx="3"/>'; }
    return '<g fill="' + col + '">' + o + '</g>';
  }

  /* ---------- ภาพของแต่ละเทศกาล: back = หลังโลโก้ · front = บนโลโก้ (พิกัดโลโก้ = วงกลมกลาง (50,50) รัศมี 50) · art = ฉากทั้งแบนเนอร์ · extra = ของแถม ---------- */
  var ART = {};

  ART.songkran = function () {
    var gun = sv('0 0 210 120', '<path class="stream" d="M62 70 C 40 20, -10 20, -40 70" transform="translate(40 0)" fill="none" stroke="#e8fbff" stroke-width="5" stroke-linecap="round" stroke-dasharray="3 11"/>' +
      '<g transform="translate(70 40)"><rect x="0" y="22" width="92" height="30" rx="14" fill="#ff7a1a" stroke="#fff" stroke-width="3"/><rect x="62" y="48" width="22" height="36" rx="8" fill="#ff7a1a" stroke="#fff" stroke-width="3" transform="rotate(-8 70 60)"/><rect x="-26" y="28" width="34" height="14" rx="6" fill="#ffd166" stroke="#fff" stroke-width="3"/><rect x="26" y="0" width="44" height="26" rx="12" fill="#35d0ff" stroke="#fff" stroke-width="3"/><path d="M34 8q10 6 20 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></g>', 'd gun');
    var drops = ''; [[10, 18, 1], [34, 70, .8], [84, 12, .7], [150, 92, .9], [190, 30, .75]].forEach(function (p, i) { drops += '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + p[2] + ')"><path class="drop" style="animation-delay:' + (i * 0.45) + 's" d="M0 -12C7 -2 11 4 11 9a11 11 0 0 1-22 0C-11 4-7 -2 0 -12Z" fill="#fff" fill-opacity=".9"/></g>'; });
    return {
      back: '', front: '<rect x="10" y="38" width="36" height="20" rx="8" fill="#111"/><rect x="54" y="38" width="36" height="20" rx="8" fill="#111"/><path d="M46 46h8" stroke="#111" stroke-width="4"/><path d="M17 42l9 9M61 42l9 9" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/><g transform="translate(88 2)">' + flower(0, 0, 10, '#ff5d73', '#ffd166') + '</g>',
      art: gun + sv('0 0 220 130', drops, 'd drops'), extra: ''
    };
  };

  ART.loy = function () {
    var stars = ''; [[8, 12], [30, 30], [70, 10], [120, 24], [170, 12], [210, 36], [250, 14], [300, 28], [340, 10]].forEach(function (p, i) { stars += '<path class="tw" style="animation-delay:' + (i * 0.3) + 's" transform="translate(' + p[0] + ' ' + p[1] + ')" d="M0 -5L1.4 -1.4L5 0L1.4 1.4L0 5L-1.4 1.4L-5 0L-1.4 -1.4Z" fill="#fff6c9"/>'; });
    var lan = function (x, d, s) { return '<g transform="translate(' + x + ' 0) scale(' + s + ')"><g class="lan" style="animation-delay:' + d + 's"><path d="M-9 -13h18l5 26h-28z" fill="#ff9f1c"/><path d="M-9 -13h18l5 26h-28z" fill="url(#lg)" opacity=".5"/><rect x="-10" y="-16" width="20" height="4" rx="2" fill="#8a4b00"/><rect x="-13" y="12" width="26" height="3" rx="1.5" fill="#8a4b00"/><circle cx="0" cy="0" r="22" fill="#ffb703" opacity=".18"/></g></g>'; };
    return {
      back: '<ellipse cx="50" cy="106" rx="70" ry="14" fill="#2d7a3e"/><path d="M-18 106q9-9 17 0t17 0t17 0t17 0t17 0t17 0t17 0t17 0" stroke="#7bdc86" stroke-width="2" fill="none"/>' +
        '<g fill="#ff9ecb" stroke="#fff" stroke-width="2"><ellipse cx="50" cy="86" rx="9" ry="22" transform="rotate(-64 50 106)"/><ellipse cx="50" cy="86" rx="9" ry="22" transform="rotate(64 50 106)"/><ellipse cx="50" cy="86" rx="9" ry="22" transform="rotate(-32 50 106)"/><ellipse cx="50" cy="86" rx="9" ry="22" transform="rotate(32 50 106)"/></g>' +
        '<rect x="88" y="66" width="9" height="30" rx="2" fill="#fff3c4"/><path class="flame" d="M92.5 46c6 7 7 12 0 18c-7-6-6-11 0-18z" fill="#ffb703"/><path d="M-4 96l-10-30M-8 98l-14-26" stroke="#c98b3a" stroke-width="2"/>',
      front: '<ellipse cx="50" cy="104" rx="30" ry="6" fill="#ff9ecb" stroke="#fff" stroke-width="2"/>',
      art: sv('0 0 420 128', '<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' + stars + '<g transform="translate(360 52)"><circle r="30" fill="#fff6c9"/><circle cx="-9" cy="-8" r="6" fill="#f0e3a0"/><circle cx="10" cy="6" r="8" fill="#f0e3a0"/><circle cx="-4" cy="16" r="3.5" fill="#f0e3a0"/></g><g transform="translate(300 100)">' + lan(0, 0, 1) + '</g><g transform="translate(250 112)">' + lan(0, 2.2, .75) + '</g><g transform="translate(200 108)">' + lan(0, 4.4, .6) + '</g>', 'd sky', 'right:0;top:0;height:100%;width:auto;') +
        '<div class="d wave"></div>',
      extra: ''
    };
  };

  ART.newyear = function () {
    // ก.ค.–ธ.ค. แสดงปีหน้า ม.ค.–มิ.ย. แสดงปีนี้
    var yr = (function () { var n = new Date(); return n.getMonth() >= 6 ? n.getFullYear() + 1 : n.getFullYear(); })();
    return {
      back: '',
      front: '<g transform="rotate(14 50 10)"><path d="M26 14L52 -34L76 14Z" fill="#ff2d95"/><path d="M31 5h40M37 -7h28" stroke="#fff" stroke-width="4" opacity=".85"/><circle cx="52" cy="-36" r="8" fill="#ffd23f"/></g><path d="M20 -4l-8-8M84 -6l9-9M44 -30l-2-12" stroke="#35f2ff" stroke-width="3" stroke-linecap="round"/>',
      art: sv('0 0 360 128', burst(70, 60, 34, '#ff2d95', 'a', 0) + burst(190, 38, 26, '#35f2ff', 'b', .9) + burst(290, 76, 38, '#ffd23f', 'c', 1.7) + '<g fill="#fff" class="tw"><circle cx="30" cy="20" r="2"/><circle cx="250" cy="14" r="2"/><circle cx="330" cy="30" r="2"/><circle cx="140" cy="100" r="2"/></g>', 'd fws', 'right:0;top:0;height:100%;width:auto;'),
      extra: '<span class="fb-year">' + yr + '</span>'
    };
  };

  ART.cny = function () {
    var lant = function (cls) { return sv('0 0 60 150', '<line x1="30" y1="0" x2="30" y2="34" stroke="#e0a526" stroke-width="2"/><rect x="20" y="32" width="20" height="7" rx="2" fill="#e0a526"/><ellipse cx="30" cy="62" rx="26" ry="25" fill="#e0121b" stroke="#ffcf5a" stroke-width="2"/><path d="M30 37v50M16 40q-6 22 0 44M44 40q6 22 0 44" stroke="#ffcf5a" stroke-width="1.6" fill="none" opacity=".85"/><rect x="20" y="85" width="20" height="7" rx="2" fill="#e0a526"/><path d="M24 92v28M30 92v34M36 92v28" stroke="#ffcf5a" stroke-width="2.4" stroke-linecap="round"/><circle cx="30" cy="62" r="8" fill="none" stroke="#ffcf5a" stroke-width="1.5"/>', 'd lant ' + cls); };
    return {
      back: '<g class="env"><rect x="-16" y="-20" width="132" height="152" rx="12" fill="#d90d1a" stroke="#ffcf5a" stroke-width="3"/><path d="M-16 -8L50 40L116 -8" fill="none" stroke="#ffcf5a" stroke-width="3"/><circle cx="50" cy="114" r="15" fill="#ffcf5a"/><rect x="44" y="108" width="12" height="12" fill="#d90d1a"/><path d="M-6 130h112" stroke="#ffcf5a" stroke-width="2" stroke-dasharray="4 4"/></g>',
      front: '',
      art: lant('l1') + lant('l2') + sv('0 0 140 40', '<path d="M0 30q18-24 36 0t36 0t36 0t32 0" fill="none" stroke="#ffcf5a" stroke-width="2" opacity=".5"/><path d="M0 18q18-22 36 0t36 0t36 0t32 0" fill="none" stroke="#ffcf5a" stroke-width="1.5" opacity=".35"/>', 'd cloud'),
      extra: '<span class="fb-fu"><i>福</i></span>'
    };
  };

  ART.halloween = function () {
    var bat = function (cls, st) { return sv('0 0 60 30', '<path d="M30 12C26 4 16 2 4 8c6 2 8 6 8 10c4-3 8-2 10 2c1-4 4-6 8-6s7 2 8 6c2-4 6-5 10-2c0-4 2-8 8-10C44 2 34 4 30 12Z" fill="#12061c"/><circle cx="27" cy="12" r="1.4" fill="#ff7a1a"/><circle cx="33" cy="12" r="1.4" fill="#ff7a1a"/>', 'd bat ' + cls, st); };
    return {
      back: '',
      front: '<ellipse cx="50" cy="6" rx="52" ry="10" fill="#14081f" stroke="#7b2cbf" stroke-width="2"/><path d="M26 4C36 0 40 -14 44 -30C46 -38 58 -36 64 -34C60 -26 62 -10 74 4Z" fill="#1d0b2e" stroke="#7b2cbf" stroke-width="2"/><path d="M28 -2h46" stroke="#ff7a1a" stroke-width="6"/><rect x="45" y="-7" width="11" height="11" fill="none" stroke="#ffd23f" stroke-width="2.5"/>',
      art: sv('0 0 420 128', '<circle cx="320" cy="62" r="46" fill="#ff7a1a" opacity=".9"/><circle cx="305" cy="50" r="8" fill="#e0620f"/><circle cx="335" cy="78" r="10" fill="#e0620f"/><circle cx="342" cy="44" r="5" fill="#e0620f"/>', 'd moon', 'right:0;top:0;height:100%;width:auto;') +
        bat('b1', 'top:14%;') + bat('b2', 'top:52%;') +
        sv('0 0 100 100', '<g stroke="#fff" stroke-opacity=".4" stroke-width="1.5" fill="none"><path d="M0 0L90 70M0 0L60 95M0 0L96 36M0 0L28 100"/><path d="M0 26Q24 22 28 0M0 48Q40 42 48 0M0 72Q58 66 72 0"/></g>', 'd web') +
        sv('0 0 40 120', '<line x1="20" y1="0" x2="20" y2="62" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/><g transform="translate(20 74)"><ellipse rx="10" ry="9" fill="#120518"/><circle cx="-3" cy="-2" r="2" fill="#ff3b3b"/><circle cx="3" cy="-2" r="2" fill="#ff3b3b"/><g stroke="#120518" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M-8 -3l-12 -8l-6 6M-9 1l-14 0l-4 8M-8 5l-12 8l-3 8M-5 8l-6 12l0 6"/><path d="M8 -3l12 -8l6 6M9 1l14 0l4 8M8 5l12 8l3 8M5 8l6 12l0 6"/></g></g>', 'd spider') +
        sv('0 0 50 64', '<path d="M4 60V26C4 10 14 2 25 2s21 8 21 24v34l-7-6l-7 6l-7-6l-7 6l-7-6Z" fill="#f4eefc"/><circle cx="18" cy="26" r="4" fill="#1b0a2a"/><circle cx="32" cy="26" r="4" fill="#1b0a2a"/><ellipse cx="25" cy="38" rx="5" ry="6" fill="#1b0a2a"/>', 'd ghost'),
      extra: '<svg class="drips" viewBox="0 0 260 36" preserveAspectRatio="none" aria-hidden="true">' + drips(13, 258, '#79d94a') + '</svg>'
    };
  };

  ART.xmas = function () {
    var ball = function (cls, c1, c2) { return sv('0 0 36 90', '<line x1="18" y1="0" x2="18" y2="40" stroke="#f2e6c8" stroke-width="1.6"/><rect x="13" y="38" width="10" height="6" rx="2" fill="#e8c35a"/><circle cx="18" cy="62" r="19" fill="' + c1 + '"/><path d="M6 54q12 -12 24 0" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M5 66q13 10 26 0" stroke="' + c2 + '" stroke-width="3" fill="none"/>', 'd ball ' + cls); };
    return {
      back: '',
      front: '<path d="M14 24C14 -2 36 -26 70 -30C60 -18 66 4 88 22Z" fill="#e5192b" stroke="#fff" stroke-width="2"/><rect x="8" y="16" width="90" height="14" rx="7" fill="#fff" transform="rotate(-6 50 24)"/><circle cx="72" cy="-34" r="9" fill="#fff"/>',
      art: ball('k1', '#e63946', '#fff') + ball('k2', '#2a9d8f', '#fff') + ball('k3', '#ffd166', '#c1121f') +
        sv('0 0 130 120', '<g stroke="#1f7a3f" stroke-width="5" stroke-linecap="round"><path d="M130 100L30 70M130 100L40 100M130 100L50 128M130 100L36 40"/></g><g stroke="#2fa35a" stroke-width="3" stroke-linecap="round"><path d="M110 92l-14 -10M90 86l-16 -10M70 80l-14 -8M120 100l-20 2M100 100l-22 4M80 100l-20 6M110 108l-14 12M90 112l-14 12"/></g><circle cx="52" cy="66" r="6" fill="#e5192b"/><circle cx="60" cy="74" r="6" fill="#e5192b"/><circle cx="46" cy="76" r="6" fill="#e5192b"/>', 'd pine'),
      extra: ''
    };
  };

  ART.valentine = function () {
    var h = '', pos = [[40, 22, 1.6, 0], [130, 100, 1.1, .6], [190, 30, 2.1, 1.2], [260, 96, 1.4, 1.8], [330, 28, 1.2, .3], [372, 80, 1.9, .9]];
    pos.forEach(function (p) { h += heart(p[0], p[1], p[2], 'fill="none" stroke="#fff" stroke-width="1.6"', 'hb'); });
    return {
      back: '<path class="wing" d="M-4 44C-34 20 -46 -4 -34 -16C-22 -10 -14 -12 -8 -4C-22 0 -14 8 -4 10C-18 16 -10 26 0 26C-12 34 -4 44 4 46Z" fill="#fff" stroke="#ffc2d1" stroke-width="2"/><path class="wing r" d="M104 44C134 20 146 -4 134 -16C122 -10 114 -12 108 -4C122 0 114 8 104 10C118 16 110 26 100 26C112 34 104 44 96 46Z" fill="#fff" stroke="#ffc2d1" stroke-width="2"/><circle cx="50" cy="50" r="57" fill="#c9184a" stroke="#c9184a" stroke-width="9" stroke-dasharray="7 4"/><circle cx="50" cy="50" r="55" fill="none" stroke="#ff7b9c" stroke-width="2"/>',
      front: '<ellipse cx="50" cy="-12" rx="22" ry="6" fill="none" stroke="#ffd23f" stroke-width="4"/>',
      art: sv('0 0 100 100', '<path d="M0 0L52 60L100 0" fill="none" stroke="#ff9db5" stroke-width="1.6" vector-effect="non-scaling-stroke"/><path d="M0 100L40 52M100 100L64 52" fill="none" stroke="#ffc0d0" stroke-width="1.2" vector-effect="non-scaling-stroke"/>', 'd flap', 'inset:0;width:100%;height:100%;') +
        sv('0 0 400 120', h + '<g stroke="#9b1d3a" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M120 80L360 40"/><path d="M360 40l-14 -2M360 40l-10 10"/><path d="M120 80l-8 -2M120 80l-6 -9l6 -2M120 80l-3 -10l6 -2"/></g>', 'd hearts', 'right:0;top:0;height:100%;width:auto;'),
      extra: ''
    };
  };

  ART.tax = function () {
    return {
      back: '',
      front: '<path d="M2 26Q50 -4 98 26L104 44Q50 22 -4 44Z" fill="#3fa66b" fill-opacity=".82" stroke="#1d6b43" stroke-width="2.5"/><rect x="0" y="22" width="100" height="7" rx="3" fill="#1d6b43"/><path d="M28 14l22 -4" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>',
      art: sv('0 0 330 124', '<g transform="translate(18 14) rotate(-6 36 44)"><rect width="72" height="92" rx="9" fill="#e8eef7" stroke="#2b3a55" stroke-width="3"/><rect x="8" y="9" width="56" height="20" rx="4" fill="#bfe3c9" stroke="#2b3a55" stroke-width="2"/><text x="58" y="25" text-anchor="end" font-family="monospace" font-size="15" font-weight="700" fill="#1d4e89">7.00%</text><g fill="#2b3a55">' + (function () { var o = ''; for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) o += '<rect x="' + (8 + c * 15) + '" y="' + (37 + r * 13) + '" width="11" height="9" rx="2" fill="' + (c === 3 ? '#e63946' : '#2b3a55') + '"/>'; return o; })() + '</g></g>' +
        '<g transform="translate(110 10) rotate(5)"><path d="M0 0h62v100l-8 -6l-8 6l-8 -6l-8 6l-8 -6l-8 6l-8 -6l-6 6Z" fill="#fff" stroke="#2b3a55" stroke-width="2.4"/><g stroke="#9aa7bd" stroke-width="2.4" stroke-linecap="round"><path d="M10 16h30M10 28h42M10 40h26M10 52h40"/></g><text x="10" y="82" font-family="Caveat,cursive" font-size="20" font-weight="700" fill="#1d4e89">฿ 7%</text></g>' +
        '<g transform="translate(196 22) rotate(-12)"><rect width="104" height="46" rx="8" fill="none" stroke="#d62839" stroke-width="5"/><rect x="5" y="5" width="94" height="36" rx="5" fill="none" stroke="#d62839" stroke-width="2"/><text x="52" y="33" text-anchor="middle" font-family="Caveat,cursive" font-size="32" font-weight="700" fill="#d62839" letter-spacing="2">PAID</text></g>' +
        '<circle cx="268" cy="98" r="14" fill="none" stroke="#b08968" stroke-width="3" opacity=".55"/><circle cx="268" cy="98" r="9" fill="none" stroke="#b08968" stroke-width="1.5" opacity=".35"/>', 'd desk', 'right:0;top:0;height:100%;width:auto;'),
      extra: '<svg class="scrib" viewBox="0 0 200 64" preserveAspectRatio="none" aria-hidden="true"><path class="draw" d="M12 34C22 6, 150 -4, 192 20S168 62, 98 58S6 54, 12 26" fill="none" stroke="#e63946" stroke-width="3.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><svg class="under" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path class="draw d2" d="M4 8q30-9 60 0t60 0t60 0t14 -2" fill="none" stroke="#e63946" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>'
    };
  };

  ART.mother = function () {
    var ring = '<g stroke="#8cc3ee" stroke-width=".9">', i;
    for (i = 0; i < 16; i++) { var a = i * 22.5 * Math.PI / 180; ring += flower(+(50 + Math.cos(a) * 57).toFixed(1), +(50 + Math.sin(a) * 57).toFixed(1), 7, '#fff', '#ffe08a'); }
    ring += '</g>';
    var g = '<path d="M0 8C70 78 170 78 240 8" fill="none" stroke="#5aa469" stroke-width="2.4"/>', t = '<g stroke="#8cc3ee" stroke-width=".9">';
    for (i = 0; i <= 8; i++) { var u = i / 8, x = u * 240, y = 8 + 35 * Math.sin(Math.PI * u) * 1.55; t += flower(+x.toFixed(1), +y.toFixed(1), 8, '#fff', '#ffe08a'); }
    t += '</g>';
    var tas = '<g stroke="#5aa469" stroke-width="2" stroke-linecap="round"><path d="M120 62v22"/><path d="M112 84l8 6l8 -6"/></g><g class="tw" fill="#fff" stroke="#8cc3ee" stroke-width=".9"><circle cx="120" cy="94" r="5"/></g>';
    return {
      back: ring, front: '',
      art: sv('0 0 240 110', g + t + tas, 'd garl', 'right:6px;top:-6px;width:230px;height:auto;'),
      extra: ''
    };
  };

  ART.father = function () {
    var rays = ''; for (var i = 0; i < 18; i++) { rays += '<path d="M0 0L' + (300 * Math.cos((i * 20 - 4) * Math.PI / 180)).toFixed(0) + ' ' + (300 * Math.sin((i * 20 - 4) * Math.PI / 180)).toFixed(0) + 'L' + (300 * Math.cos((i * 20 + 4) * Math.PI / 180)).toFixed(0) + ' ' + (300 * Math.sin((i * 20 + 4) * Math.PI / 180)).toFixed(0) + 'Z"/>'; }
    var mug = sv('0 0 150 130', '<g class="steam" fill="none" stroke="#1d1d1b" stroke-width="3.2" stroke-linecap="round" opacity=".6"><path d="M44 22q-8 -10 0 -18t0 -10"/><path d="M66 24q-8 -10 0 -18t0 -10"/><path d="M88 22q-8 -10 0 -18t0 -10"/></g>' +
      '<path d="M112 50h14a14 14 0 0 1 0 34h-14" fill="none" stroke="#1d1d1b" stroke-width="7"/><path d="M26 34h92v52a22 22 0 0 1 -22 22h-48a22 22 0 0 1 -22 -22z" fill="#fff" stroke="#1d1d1b" stroke-width="5"/>' +
      '<text x="72" y="82" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="38" fill="#e63946">No.1</text><text x="72" y="55" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="15" fill="#1d1d1b">DAD</text>', 'd mug', 'right:14px;bottom:2px;width:132px;height:auto;');
    return {
      back: '',
      front: '<g transform="translate(50 100)"><g class="tie"><path d="M0 0L-22 -9V13Z" fill="#1d3557" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><path d="M0 0L22 -9V13Z" fill="#1d3557" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><rect x="-6" y="-7" width="12" height="14" rx="3" fill="#e63946" stroke="#fff" stroke-width="2.4"/></g></g>',
      art: sv('-300 -300 600 600', '<g fill="#fff" fill-opacity=".22">' + rays + '</g>', 'd rays', 'left:-60px;top:50%;width:520px;height:520px;margin-top:-260px;') + mug,
      extra: ''
    };
  };

  ART.children = function () {
    var cols = ['#ff595e', '#ffca3a', '#1982c4', '#8ac926'], b = '';
    [[-14, -18, 0], [34, -34, .7], [86, -20, 1.3]].forEach(function (p, i) {
      b += '<g transform="translate(' + p[0] + ' ' + p[1] + ')"><g class="bal" style="animation-delay:' + p[2] + 's"><path d="M0 0C-4 30 4 60 ' + (6 - i * 4) + ' 92" fill="none" stroke="#fff" stroke-width="1.6" transform="translate(0 20)"/><ellipse cx="0" cy="0" rx="15" ry="19" fill="' + cols[i] + '" stroke="#fff" stroke-width="2.4"/><path d="M-5 -9q-4 5 -2 11" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M-3 19l3 5l3 -5z" fill="' + cols[i] + '"/></g></g>';
    });
    var blocks = sv('0 0 170 124', '<g class="blk"><g transform="translate(6 62) rotate(-5 28 28)"><rect width="56" height="56" rx="8" fill="#ff595e" stroke="#fff" stroke-width="3"/><text x="28" y="42" text-anchor="middle" font-family="Chewy,cursive" font-size="36" fill="#fff">A</text></g>' +
      '<g transform="translate(66 62) rotate(4 28 28)"><rect width="56" height="56" rx="8" fill="#ffca3a" stroke="#fff" stroke-width="3"/><text x="28" y="42" text-anchor="middle" font-family="Chewy,cursive" font-size="36" fill="#1982c4">B</text></g>' +
      '<g transform="translate(34 6) rotate(-3 28 28)"><rect width="56" height="56" rx="8" fill="#1982c4" stroke="#fff" stroke-width="3"/><text x="28" y="42" text-anchor="middle" font-family="Chewy,cursive" font-size="36" fill="#fff">C</text></g></g>' +
      '<path class="tw" d="M146 20l4 9l10 1l-8 7l3 10l-9 -6l-9 6l3 -10l-8 -7l10 -1z" fill="#ffca3a" stroke="#fff" stroke-width="2"/>', 'd blocks', 'right:12px;bottom:-4px;width:150px;height:auto;');
    var bunt = '<path d="M0 6Q100 22 200 6T400 6" fill="none" stroke="#fff" stroke-width="2"/>', k = 0;
    for (var x = 8; x < 400; x += 26) { bunt += '<path d="M' + x + ' ' + (7 + 6 * Math.sin(x / 64)).toFixed(1) + 'l11 0l-5.5 16z" fill="' + cols[k++ % 4] + '" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>'; }
    return {
      back: b, front: '',
      art: sv('0 0 400 30', bunt, 'd bunt', 'left:0;top:0;width:100%;height:30px;') + blocks,
      extra: ''
    };
  };

  ART.veg = function () {
    var flag = '<g transform="translate(94 -22)"><rect x="-2" y="0" width="5" height="120" rx="2.5" fill="#8a5a2b" stroke="#fff" stroke-width="1.6"/><circle cx="0.5" cy="-1" r="5" fill="#e63946"/><g class="flag"><path d="M3 4h46q-6 22 0 44h-46z" fill="#ffd60a" stroke="#c1121f" stroke-width="2.4" stroke-linejoin="round"/><text x="26" y="39" text-anchor="middle" font-family="Ma Shan Zheng,serif" font-size="32" fill="#c1121f">齋</text></g></g>';
    var bowl = sv('0 0 190 120', '<g class="veg"><g transform="translate(56 28)"><circle r="19" fill="#4caf50" stroke="#fff" stroke-width="2.4"/><circle cx="-12" cy="9" r="12" fill="#43a047" stroke="#fff" stroke-width="2.4"/><circle cx="13" cy="8" r="12" fill="#66bb6a" stroke="#fff" stroke-width="2.4"/><rect x="-6" y="10" width="12" height="20" rx="4" fill="#9ccc65" stroke="#fff" stroke-width="2.4"/></g>' +
      '<g transform="translate(112 34) rotate(24)"><path d="M0 -4L12 40L-12 40Z" fill="#ff8f1f" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><path d="M0 -4C-8 -16 -2 -22 0 -14C2 -22 8 -16 0 -4Z" fill="#43a047" stroke="#fff" stroke-width="2"/></g>' +
      '<g transform="translate(142 44)"><path d="M-18 6a18 15 0 0 1 36 0z" fill="#d7a86e" stroke="#fff" stroke-width="2.4"/><rect x="-6" y="6" width="12" height="16" rx="5" fill="#f3e5ce" stroke="#fff" stroke-width="2.4"/></g></g>' +
      '<path d="M18 62h154a77 52 0 0 1 -154 0z" fill="#fff" stroke="#c1121f" stroke-width="4"/><path d="M32 78h126" stroke="#ffd60a" stroke-width="5" stroke-linecap="round"/><path d="M60 96h70" stroke="#c1121f" stroke-width="3" stroke-linecap="round" opacity=".5"/>', 'd bowl', 'right:12px;bottom:-6px;width:170px;height:auto;');
    var bunt = '<path d="M0 6Q100 20 200 6T400 6" fill="none" stroke="#8a5a2b" stroke-width="2"/>', k = 0;
    for (var x = 8; x < 400; x += 24) bunt += '<path d="M' + x + ' ' + (7 + 6 * Math.sin(x / 64)).toFixed(1) + 'l11 0l-5.5 15z" fill="' + (k++ % 2 ? '#c1121f' : '#ffd60a') + '" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>';
    return {
      back: flag, front: '',
      art: sv('0 0 400 30', bunt, 'd bunt', 'left:0;top:0;width:100%;height:30px;') + bowl,
      extra: ''
    };
  };

  ART.visakha = function () {
    var i, m = '';
    for (i = 0; i < 24; i++) { var a = i * 15; m += '<path d="M50 -14L55 -2L45 -2Z" fill="#d9a521" opacity="' + (i % 2 ? .9 : .5) + '" transform="rotate(' + a + ' 50 50)"/>'; }
    var leaf = function (x, y, r, s) { return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ') scale(' + s + ')"><path d="M0 0C-22 -6 -24 -32 -3 -38C0 -50 2 -50 4 -38C24 -32 20 -6 0 0Z" fill="#8bb174" stroke="#4f7942" stroke-width="2"/><path d="M0 0V-34" stroke="#4f7942" stroke-width="1.6"/></g>'; };
    var can = function (x, h, d) { return '<g transform="translate(' + x + ' 0)"><rect x="-6" y="' + (100 - h) + '" width="12" height="' + h + '" rx="3" fill="#fffaf0" stroke="#d9a521" stroke-width="2"/><g transform="translate(0 ' + (100 - h - 2) + ')"><g class="fl" style="animation-delay:' + d + 's"><path d="M0 -4C-8 -14 -2 -22 0 -30C3 -22 8 -14 0 -4Z" fill="#ffb703"/><path d="M0 -4C-4 -10 -1 -14 0 -18C2 -14 4 -10 0 -4Z" fill="#fff3b0"/></g></g></g>'; };
    return {
      back: '<g class="mand">' + m + '</g><circle cx="50" cy="50" r="62" fill="none" stroke="#d9a521" stroke-width="2.2" stroke-dasharray="2 6" stroke-linecap="round"/><circle cx="50" cy="50" r="56" fill="#fff6d8" fill-opacity=".8"/>',
      front: '<g fill="#fff" stroke="#e58fb4" stroke-width="2"><ellipse cx="50" cy="102" rx="7" ry="18" transform="rotate(-50 50 112)"/><ellipse cx="50" cy="102" rx="7" ry="18" transform="rotate(50 50 112)"/><ellipse cx="50" cy="100" rx="7" ry="19"/></g>',
      art: sv('0 0 240 120', leaf(30, 118, -28, 1) + leaf(76, 118, 22, .8) + can(120, 62, 0) + can(150, 82, .6) + can(180, 50, 1.2) + '<path d="M104 104h92" stroke="#d9a521" stroke-width="3" stroke-linecap="round"/>', 'd cands', 'right:8px;bottom:0;width:230px;height:auto;'),
      extra: ''
    };
  };

  ART.lent = function () {
    var orn = '', i; for (i = 0; i < 6; i++) orn += '<path d="M' + (52 + (i % 2) * 0) + ' ' + (36 + i * 20) + 'q-14 -4 -16 10q4 -2 8 -2q-6 8 8 12q14 -4 8 -12q4 0 8 2q-2 -14 -16 -10z" fill="none" stroke="#ffd166" stroke-width="2" opacity=".85" transform="translate(' + ((i % 2) * 0) + ' 0)"/>';
    var candle = sv('0 0 110 150', '<g transform="translate(55 22)"><g class="fl"><path d="M0 -2C-12 -16 -3 -26 0 -40C5 -26 12 -16 0 -2Z" fill="#ffb703"/><path d="M0 -2C-6 -10 -1 -16 0 -22C3 -16 6 -10 0 -2Z" fill="#fff3b0"/></g></g><rect x="30" y="24" width="50" height="116" rx="12" fill="#fff0c2" stroke="#8a4b00" stroke-width="3"/><rect x="24" y="130" width="62" height="14" rx="5" fill="#8a4b00"/>' + orn.replace(/<path/g, '<path').replace(/translate\(0 0\)/g, ''), 'd candle', 'right:18px;bottom:8px;width:84px;height:auto;');
    return {
      back: '<circle cx="50" cy="50" r="58" fill="#c75b00" stroke="#ffd166" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round"/><path d="M-6 100q56 22 112 0" fill="none" stroke="#ffd166" stroke-width="3" opacity=".7"/>',
      front: '<path d="M6 86C22 74 44 108 50 108S78 74 94 86C92 108 72 118 50 118S8 108 6 86Z" fill="#ffd166" stroke="#8a4b00" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 96q30 14 60 0" fill="none" stroke="#c75b00" stroke-width="2.4" stroke-linecap="round"/>',
      art: sv('0 0 200 140', '<g transform="translate(160 62)"><g class="fl"><path d="M0 -2C-14 -18 -4 -30 0 -46C6 -30 14 -18 0 -2Z" fill="#ffb703"/><path d="M0 -2C-7 -10 -1 -18 0 -24C3 -18 7 -10 0 -2Z" fill="#fff3b0"/></g></g><circle cx="160" cy="48" r="34" fill="#ffd166" opacity=".16"/>', 'd glow', 'right:34px;top:0;width:150px;height:auto;') + candle,
      extra: ''
    };
  };

  ART.easter = function () {
    var egg = function (x, y, c1, c2, r, st) { return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ')"><ellipse rx="22" ry="29" fill="' + c1 + '" stroke="#fff" stroke-width="3"/>' + st.replace(/C2/g, c2) + '</g>'; };
    var zig = '<path d="M-17 -6l6 -6l6 6l6 -6l6 6l6 -6l6 6" fill="none" stroke="C2" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>', dots = '<circle cx="-8" cy="8" r="4" fill="C2"/><circle cx="8" cy="12" r="4" fill="C2"/><circle cx="0" cy="-6" r="4" fill="C2"/>', band = '<path d="M-21 6h42" stroke="C2" stroke-width="7"/><path d="M-19 16h38" stroke="C2" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>';
    return {
      back: '',
      front: '<g class="ear"><ellipse cx="32" cy="-14" rx="9" ry="26" transform="rotate(-8 32 -14)" fill="#fff" stroke="#ffb3c6" stroke-width="3"/><ellipse cx="32" cy="-12" rx="4" ry="17" transform="rotate(-8 32 -14)" fill="#ffc2d4"/></g><g class="ear r"><ellipse cx="68" cy="-14" rx="9" ry="26" transform="rotate(8 68 -14)" fill="#fff" stroke="#ffb3c6" stroke-width="3"/><ellipse cx="68" cy="-12" rx="4" ry="17" transform="rotate(8 68 -14)" fill="#ffc2d4"/></g>',
      art: sv('0 0 230 120', '<path d="M6 112q10 -26 14 -2q6 -28 12 0q8 -24 12 2q8 -22 14 0q12 -28 14 2M130 112q8 -26 12 0q8 -26 12 2q8 -20 14 0q8 -26 12 2q8 -22 14 0q8 -24 12 2" fill="none" stroke="#6bbf59" stroke-width="5" stroke-linecap="round"/>' +
        '<g class="eggs">' + egg(54, 80, '#ffd6e0', '#ff7aa2', -10, zig) + egg(112, 74, '#cfe8ff', '#4d9de0', 6, dots) + egg(168, 82, '#fff1b8', '#f4a300', -4, band) + egg(206, 90, '#d9f2c8', '#5cb85c', 12, dots) + '</g>', 'd eggs', 'right:10px;bottom:-4px;width:220px;height:auto;'),
      extra: ''
    };
  };

  ART.labour = function () {
    var gear = function (r, n, col) { var p = [], k, step = Math.PI * 2 / n; for (k = 0; k < n; k++) { var a = k * step; [[-.28, .8], [-.14, 1], [.14, 1], [.28, .8]].forEach(function (q) { p.push((Math.cos(a + q[0] * step * 1.6) * r * q[1]).toFixed(1) + ',' + (Math.sin(a + q[0] * step * 1.6) * r * q[1]).toFixed(1)); }); }
      return '<polygon points="' + p.join(' ') + '" fill="' + col + '" stroke="#1b1c1f" stroke-width="3" stroke-linejoin="round"/><circle r="' + (r * .34) + '" fill="#2b2d31" stroke="#1b1c1f" stroke-width="3"/>'; };
    return {
      back: '',
      front: '<g><path d="M8 24C8 -6 92 -6 92 24Z" fill="#ffc400" stroke="#1b1c1f" stroke-width="3" stroke-linejoin="round"/><rect x="2" y="22" width="96" height="9" rx="4.5" fill="#ffd84d" stroke="#1b1c1f" stroke-width="3"/><path d="M50 -4V22M34 2V22M66 2V22" stroke="#1b1c1f" stroke-width="2.6" stroke-opacity=".55"/><path d="M24 14q8 -10 20 -11" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none" stroke-linecap="round"/></g>',
      art: sv('0 0 190 130', '<g transform="translate(60 74)"><g class="gr">' + gear(44, 10, '#ffc400') + '</g></g><g transform="translate(138 42)"><g class="gr rv">' + gear(26, 8, '#e8590c') + '</g></g><g transform="translate(150 100) rotate(-35)"><rect x="-4" y="-32" width="8" height="64" rx="3" fill="#cfd4da" stroke="#1b1c1f" stroke-width="3"/><path d="M-12 -34a12 12 0 1 1 24 0l-6 0v-8h-12v8z" fill="#cfd4da" stroke="#1b1c1f" stroke-width="3" stroke-linejoin="round"/></g>', 'd gears', 'right:8px;bottom:6px;width:180px;height:auto;'),
      extra: ''
    };
  };

  /* ---------- เอฟเฟกต์ลอยทั่วจอ (เบาๆ ปิดได้) ---------- */
  var FXD = {
    songkran: { n: 16, ch: ['💧', '💧', '🫧'], cls: 'fall' },
    loy: { n: 12, ch: ['✨', '·', '🏮'], cls: 'rise' },
    newyear: { n: 26, ch: ['', '', '', '✦'], cls: 'fall conf' },
    cny: { n: 14, ch: ['🪙', '🧧', '·'], cls: 'fall' },
    halloween: { n: 10, ch: ['🦇', '🦇', '👻', '🎃'], cls: 'fly' },
    xmas: { n: 30, ch: ['❄', '❅', '❆', '·'], cls: 'fall snow' },
    valentine: { n: 16, ch: ['♥', '♥', '💗', '♡'], cls: 'rise' },
    tax: { n: 14, ch: ['฿', '%', '✓', '7%', '฿'], cls: 'rise ink' },
    children: { n: 14, ch: ['🎈', '⭐', '🎈', '✨', '🎈'], cls: 'rise' },
    veg: { n: 14, ch: ['🌿', '🍃', '🥬', '·'], cls: 'fall' },
    mother: { n: 18, ch: ['✿', '🤍', '❀', '·'], cls: 'fall snow' },
    father: { n: 14, ch: ['⭐', '💛', '★', '·'], cls: 'rise' },
    visakha: { n: 14, ch: ['🪷', '✨', '·', '🤍'], cls: 'rise' },
    lent: { n: 12, ch: ['🕯️', '✨', '·', '🪷'], cls: 'rise' },
    easter: { n: 16, ch: ['🥚', '🌷', '🐣', '·', '🌸'], cls: 'fall' },
    labour: { n: 12, ch: ['⚙', '🔧', '★', '·'], cls: 'rise' }
  };
  function fxHtml(id) {
    var d = FXD[id]; if (!d) return ''; var o = '';
    for (var i = 0; i < d.n; i++) { var ch = d.ch[i % d.ch.length], r = Math.random;
      o += '<i class="p ' + d.cls + '" style="--x:' + (r() * 100).toFixed(1) + ';--y:' + (8 + r() * 80).toFixed(0) + ';--d:' + (9 + r() * 12).toFixed(1) + ';--l:' + (r() * 16).toFixed(1) + ';--s:' + (10 + r() * 14).toFixed(0) + ';--w:' + (r() * 16 - 8).toFixed(1) + ';--r:' + (r() * 540 - 270).toFixed(0) + ';--h:' + (r() * 360).toFixed(0) + '">' + ch + '</i>'; }
    return o;
  }
  function fxOff() { try { return localStorage.getItem('fxOff') === '1'; } catch (e) { return false; } }
  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function setFx(off) { try { localStorage.setItem('fxOff', off ? '1' : ''); } catch (e) {} apply(); }

  /* ---------- ใช้ธีม: ตั้ง data-fest ที่ <html> + เอฟเฟกต์ ---------- */
  var cur = null;
  function apply() {
    var id = active(), root = document.documentElement;
    if (id) { root.setAttribute('data-fest', id); loadFonts(id); } else root.removeAttribute('data-fest');
    var fx = document.getElementById('fx');
    if (!fx) { fx = document.createElement('div'); fx.id = 'fx'; fx.setAttribute('aria-hidden', 'true'); document.body.appendChild(fx); }
    var show = id && !fxOff() && !reduced();
    var key = show ? id : '';
    if (key !== cur) { fx.innerHTML = show ? fxHtml(id) : ''; cur = key; }
    return id;
  }

  /* ---------- แบนเนอร์: โลโก้ + คำว่า Sirikul Accounting ที่เล่นดูเดิล ---------- */
  function words() {
    var c = (typeof S !== 'undefined' && S && S.company) || 'Sirikul Accounting', p = String(c).trim().split(/\s+/);
    return { big: p[0] || 'Sirikul', small: p.slice(1).join(' ') };
  }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // size: 'lg' | 'sm' · forceId: แสดงธีมที่ระบุ (ใช้ในแกลเลอรี) ไม่ระบุ = ธีมที่ใช้อยู่ตอนนี้ (ไม่มี = ไม่แสดง)
  function banner(size, forceId) {
    var id = forceId || active(); if (!id || !ART[id]) return '';
    loadFonts(id);
    var a = ART[id](), w = words(), logo = (typeof S !== 'undefined' && S && S.logo) ? '<img src="' + S.logo + '" alt="">' : '<span class="fb-s">' + esc(w.big.charAt(0).toUpperCase()) + '</span>';
    return '<div class="fb fb-' + id + ' fb-' + (size || 'lg') + '" role="img" aria-label="' + esc(BY[id].name + ' · ' + w.big + ' ' + w.small) + '">' +
      '<div class="fb-art">' + a.art + '</div>' +
      '<div class="fb-logo">' + (a.back ? sv('-25 -25 150 150', a.back, 'fb-acc back') : '') + '<div class="fb-logoin">' + logo + '</div>' + (a.front ? sv('-25 -25 150 150', a.front, 'fb-acc front') : '') + '</div>' +
      '<div class="fb-word"><b>' + esc(w.big) + '</b>' + (w.small ? '<i>' + esc(w.small) + '</i>' : '') + (id === 'halloween' || id === 'tax' ? a.extra : '') + '</div>' +
      (id === 'newyear' || id === 'cny' ? a.extra : '') + (forceId ? '' : '<button type="button" class="fb-fx' + (fxOff() ? ' off' : '') + '" data-act="fxtoggle" aria-label="เปิด/ปิดเอฟเฟกต์ลอย" title="เปิด/ปิดเอฟเฟกต์ลอย">✨</button>') + '</div>';
  }

  /* ---------- ตัวเลือกธีมสำหรับหน้า "ตั้งค่า" (แกลเลอรีตัวอย่างทุกเทศกาล) ---------- */
  function gallery(selected) {
    loadFonts('all');
    var cur2 = pick(new Date());
    return '<div class="thmgrid">' + LIST.map(function (t) {
      return '<button type="button" class="thm' + (selected === t.id ? ' on' : '') + '" data-act="thmpick" data-id="' + t.id + '">' + banner('sm', t.id) +
        '<span class="thm-n"><b>' + t.emoji + ' ' + t.name + '</b><small>' + t.when + (cur2 === t.id ? ' · ตรงกับวันนี้' : '') + '</small></span></button>';
    }).join('') + '</div>';
  }

  return { list: LIST, by: BY, pick: pick, active: active, apply: apply, banner: banner, gallery: gallery, loadFonts: loadFonts, fxOff: fxOff, setFx: setFx, loyDay: loyDay, dn: dn };
})();
