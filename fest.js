/* ===== ธีมเทศกาล (Sirikul Accounting) =====
   8 เทศกาล แต่ละแบบมีภาษาภาพของตัวเอง: แบนเนอร์ดูเดิลที่เล่นกับคำว่า "Sirikul Accounting" และโลโก้ + เอฟเฟกต์เบาๆ ลอยทั่วจอ + สีแถบหัว
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
    { id: 'loy', name: 'ลอยกระทง', emoji: '🏮', when: 'วันเพ็ญเดือน 12 (ช่วง พ.ย.)' }
  ];
  var BY = {}; LIST.forEach(function (t) { BY[t.id] = t; });

  /* ---------- เลือกธีมตามวันที่ ---------- */
  var DAY = 86400000;
  function dn(y, m, d) { return Math.floor(Date.UTC(y, m - 1, d) / DAY); }
  var CNY = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [2, 8], 2036: [1, 28], 2037: [2, 15], 2038: [2, 4], 2039: [1, 24], 2040: [2, 12] };
  // วันลอยกระทง = คืนวันเพ็ญแรกที่ตกในช่วง 30 ต.ค. – 29 พ.ย. วัดแสงจันทร์ที่ 18:00 น. เวลาไทย (11:00 UTC) ประมาณจากรอบข้างขึ้นข้างแรม คลาดเคลื่อนได้ไม่เกิน 1 วัน
  // (ปีที่ปฏิทินไทยมีอธิกมาส วันจริงอาจต่างจากที่คำนวณได้ ให้แอดมินเลือกธีมเองในหน้า "ตั้งค่า")
  function moonAge(t) { var jd = t / DAY + 2440587.5, a = (jd - 2451550.1) % 29.530588853; return a < 0 ? a + 29.530588853 : a; }
  function loyDay(y) {
    var df = [], i; for (i = 0; i < 31; i++) df.push(Math.abs(moonAge(Date.UTC(y, 9, 30 + i, 11)) - 14.765));
    for (i = 0; i < 31; i++) if (df[i] < 0.7 && (i === 0 || df[i] <= df[i - 1]) && (i === 30 || df[i] <= df[i + 1])) { var dt = new Date(Date.UTC(y, 9, 30 + i)); return dn(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()); }
    return -1;
  }
  function pick(date) {
    var y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate(), t = dn(y, m, d);
    if ((m === 12 && d >= 28) || (m === 1 && d <= 3)) return 'newyear';
    if (m === 12 && d >= 18) return 'xmas';
    var c = CNY[y]; if (c) { var cd = dn(y, c[0], c[1]); if (t >= cd - 3 && t <= cd + 6) return 'cny'; }
    if (m === 2 && d >= 8 && d <= 14) return 'valentine';
    if ((m === 3) || (m === 4 && d <= 8)) return 'tax';
    if (m === 4 && d >= 10 && d <= 16) return 'songkran';
    if (m === 10 && d >= 24) return 'halloween';
    var l = loyDay(y); if (l >= 0 && t >= l - 3 && t <= l + 1) return 'loy';
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
    tax: 'family=Caveat:wght@700'
  };
  var loaded = {};
  function loadFonts(id) {
    var ids = id === 'all' ? Object.keys(FONTS) : [id];
    ids.forEach(function (k) {
      if (!FONTS[k] || loaded[k]) return; loaded[k] = 1;
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + FONTS[k] + '&display=swap&text=' + CH; document.head.appendChild(l);
      if (k === 'cny') { var l2 = document.createElement('link'); l2.rel = 'stylesheet'; l2.href = 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap&text=' + encodeURIComponent('福'); document.head.appendChild(l2); }
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

  /* ---------- เอฟเฟกต์ลอยทั่วจอ (เบาๆ ปิดได้) ---------- */
  var FXD = {
    songkran: { n: 16, ch: ['💧', '💧', '🫧'], cls: 'fall' },
    loy: { n: 12, ch: ['✨', '·', '🏮'], cls: 'rise' },
    newyear: { n: 26, ch: ['', '', '', '✦'], cls: 'fall conf' },
    cny: { n: 14, ch: ['🪙', '🧧', '·'], cls: 'fall' },
    halloween: { n: 10, ch: ['🦇', '🦇', '👻', '🎃'], cls: 'fly' },
    xmas: { n: 30, ch: ['❄', '❅', '❆', '·'], cls: 'fall snow' },
    valentine: { n: 16, ch: ['♥', '♥', '💗', '♡'], cls: 'rise' },
    tax: { n: 14, ch: ['฿', '%', '✓', '7%', '฿'], cls: 'rise ink' }
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
