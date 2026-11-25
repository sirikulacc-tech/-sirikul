/* ===== ระบบรถส่วนกลางศิริกุล — หน้าเว็บ (GitHub Pages) =====
   หน้าจอและการคำนวณทั้งหมดอยู่ในไฟล์นี้ ข้อมูลเก็บใน Google Sheets / Drive ผ่าน Apps Script (API_URL)
   ถ้าสร้าง deployment ใหม่ใน Apps Script จนลิงก์ /exec เปลี่ยน ให้แก้ API_URL */
var API_URL = 'https://script.google.com/macros/s/AKfycbwzROKf1b1TM17Gr4dtmhMWgJ_DL5V5xPrOKWj29mIYMp3e-oif8mOkeDYN-Hd-4xKJ/exec';
var PUBLIC_URL = location.href.split(/[?#]/)[0]; // ลิงก์หน้าเว็บนี้ ใช้ทำ QR
var QS = new URLSearchParams(location.search);
var INITIAL_CAR = (QS.get('car') || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
var INITIAL_PLATE = (QS.get('plate') || '').replace(/[^\wก-๙\- ]/g, '').slice(0, 20);
var ADMIN_MODE = QS.get('admin') === '1'; // หน้าแอดมิน = ลิงก์ + ?admin=1
var S = { known:[], drvLic:{}, forceExtra:false, company:'', logo:'', removed:[], name:'', profiles:{}, dlist:null, pin:'', pinRequired:false, asub:'overview', carForm:false, rmonth:'', report:null, reportData:null, allUsage:[], maint:[], drivers:[], cars:[], types:[], mtypes:[], alerts:[], usage:[], expenses:[], open:[], appUrl:'',
          plate:'', sub:'trip', tab:'home', edit:'', hist:{}, mopen:false, mdef:'', busy:false };
var $ = function (s) { return document.querySelector(s); };

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function thDate(s) { // 2026-11-19 -> 19/11/2569
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? m[3] + '/' + m[2] + '/' + (Number(m[1]) + 543) : '-';
}
function thTime(s) { return /^\d{4}-\d{2}-\d{2}/.test(s || '') ? thDate(s) + ' ' + String(s).slice(11, 16) : '-'; }
function today() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function baht(n) { return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function toast(text, kind) {
  var m = $('#msg'); m.textContent = text; m.className = kind; m.style.display = 'block';
  setTimeout(function () { m.style.display = 'none'; }, 3500);
}
// ส่งคำขอไป Apps Script แบบ text/plain (ไม่ต้องขออนุญาต CORS ล่วงหน้า) และไม่ส่งคุกกี้ Google
function call(action, payload) {
  return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, payload: payload || {} }), credentials: 'omit', redirect: 'follow' })
    .then(function (r) { if (!r.ok) throw new Error('เชื่อมต่อระบบไม่ได้ (' + r.status + ')'); return r.json(); })
    .catch(function (e) { throw new Error(/Failed to fetch|NetworkError|Load failed|JSON/.test(e.message) ? 'เชื่อมต่อระบบไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' : e.message); })
    .then(function (r) { if (r && r.ok) return r.data; throw new Error(r ? r.error : 'ไม่มีการตอบกลับ'); });
}
// ที่เก็บในเครื่อง (อาจถูกบล็อกในบางเบราว์เซอร์ จึงครอบ try ไว้ทุกครั้ง)
function sget(store, k) { try { return window[store].getItem(k) || ''; } catch (e) { return ''; } }
function sset(store, k, v) { try { v ? window[store].setItem(k, v) : window[store].removeItem(k); } catch (e) {} }
function isAdmin() { return !S.pinRequired || !!S.pin; }
function showWho() { /* แถบด้านบนแสดงตามหน้า (ดู headerLeft) */ }
function profile(n) { return S.profiles[n] || {}; }
function saveProfile(n, phone, lic) {
  S.profiles[n] = { phone: phone, lic: lic };
  sset('localStorage', 'driverProfiles', JSON.stringify(S.profiles));
}
function licNote(d) {
  var n = daysLeft(d);
  if (n === null) return '';
  if (n < 0) return '<span class="cd-bad">ใบขับขี่หมดอายุแล้ว ' + (-n) + ' วัน</span>';
  if (n <= 30) return '<span class="cd-warn">ใบขับขี่จะหมดอายุในอีก ' + n + ' วัน อย่าลืมต่ออายุ</span>';
  return '<span class="cd-ok">ใบขับขี่ใช้ได้อีก ' + n + ' วัน</span>';
}
// ช่องเบอร์โทร/ใบขับขี่ ซ่อนไว้ จะเด้งขึ้นเมื่อพิมพ์ชื่อที่ยังไม่มีในระบบ หรือกด "แก้ไขวันหมดอายุ"
function driverFields() {
  var pf = profile(S.name);
  return '<div id="drvNote" class="drv-note"></div><div id="licCard"></div>' +
    '<div id="drvExtra" class="drv-extra hide"><div class="drv-new" id="drvExtraTitle">ชื่อใหม่ กรุณากรอกเบอร์โทรและวันหมดอายุใบขับขี่ (กรอกครั้งเดียว)</div>' +
    '<div id="phoneRow"><label>เบอร์โทร</label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="12" value="' + esc(pf.phone || '') + '" placeholder="เช่น 0812345678"></div>' +
    '<label>ใบขับขี่หมดอายุ</label><input name="licenseExp" type="date" value="' + esc(pf.lic || '') + '"></div>' +
    '<div id="licNote" style="font-size:13.5px;margin-top:6px"></div>';
}
function isKnownDriver(n) { return S.known.indexOf(String(n || '').trim()) >= 0; }
// mode: false = ซ่อน, 'new' = คนขับใหม่ (เบอร์+วันหมดอายุ), 'lic' = แก้วันหมดอายุอย่างเดียว
function showDriverExtra(mode) {
  var x = $('#drvExtra'); if (!x) return;
  x.classList.toggle('hide', !mode); x.dataset.mode = mode || '';
  $('#phoneRow').classList.toggle('hide', mode === 'lic');
  $('#drvExtraTitle').textContent = mode === 'lic' ? 'แก้ไขวันหมดอายุใบขับขี่' : 'ชื่อใหม่ กรุณากรอกเบอร์โทรและวันหมดอายุใบขับขี่ (กรอกครั้งเดียว)';
  x.querySelector('input[name=phone]').required = mode === 'new';
  x.querySelector('input[name=licenseExp]').required = !!mode;
}
var TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
function thDateLong(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? Number(m[3]) + ' ' + TH_MONTHS[Number(m[2]) - 1] + ' ' + (Number(m[1]) + 543) : ''; }
function licCardHtml(d) {
  var n = daysLeft(d); if (n === null || n > 30) return '';
  var bad = n < 0;
  return '<div class="liccard ' + (bad ? 'bad' : 'warn') + '"><div class="lc-t">🪪 ' + (bad ? 'ใบขับขี่หมดอายุแล้ว' : 'ใบขับขี่ใกล้หมดอายุ') + '</div>' +
    '<div class="lc-n">' + (bad ? 'เกิน ' + (-n) + ' วัน' : n === 0 ? 'หมดวันนี้' : 'อีก ' + n + ' วัน') + '</div>' +
    '<div>หมดอายุ ' + thDateLong(d) + '</div><div class="lc-b">' + (bad ? 'ไม่ควรขับรถจนกว่าจะต่ออายุ' : 'อย่าลืมไปต่อใบขับขี่') + '</div>' +
    '<button type="button" class="usebtn" data-act="editlic">แก้ไขวันหมดอายุ</button></div>';
}
// เบิกรถทีละขั้น: 1 ชื่อ → 2 เลขไมล์ → 3 วัตถุประสงค์ → 4 ปลายทาง/รูป/ปุ่มเบิกรถ
// ขั้นต่อไปขึ้นเมื่อขั้นก่อนหน้าเสร็จ ขึ้นแล้วไม่ซ่อนกลับ (ยกเว้นชื่อไม่ถูกต้อง จะกลับไปขั้นแรก)
function updateSteps(focus) {
  var f = $('#fCheckout'); if (!f) return;
  focus = focus || S.stepFocus; S.stepFocus = false;
  var E = f.elements, n = E['name'].value.trim(), s = 1;
  if (n && isKnownDriver(n) && !S.forceExtra) { s = 2; if (E['odoStart'].value !== '') { s = 3; if (E['purpose'].value.trim()) s = 4; } }
  var prev = Number(f.dataset.stage || 1), st = s === 1 ? 1 : Math.max(prev, s);
  f.dataset.stage = st;
  f.querySelectorAll('.step').forEach(function (el) {
    var k = Number(el.dataset.step), show = k <= st;
    if (show && el.classList.contains('hide')) el.classList.add('step-in');
    el.classList.toggle('hide', !show);
  });
  if (focus && st > prev) {
    var nx = f.querySelector('.step[data-step="' + st + '"] input:not([type=hidden]):not([type=file])');
    if (nx) nx.focus({ preventScroll: false });
  }
}
function updateDriverUI() { updateDriverUI_(); updateSteps(); }
// เขียน innerHTML เฉพาะเมื่อข้อความเปลี่ยนจริง (กันปุ่มถูกสลับตัวระหว่างที่ผู้ใช้กำลังแตะ ทำให้การแตะหาย)
function put(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }
function updateDriverUI_() {
  var f = $('#fCheckout'); if (!f) return;
  var n = f.elements['name'].value.trim(), note = $('#drvNote');
  f.querySelectorAll('.qchips[data-field=name] .qchip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === n); });
  var nameEl = f.elements['name'];
  if (!n) {
    showDriverExtra(false); nameEl.setCustomValidity(''); put($('#licNote'), ''); put($('#licCard'), '');
    put(note, '<button type="button" class="linkbtn" data-act="newdriver">ยังไม่มีชื่อในระบบ? เพิ่มชื่อของฉันก่อนเบิกรถ</button>');
    return;
  }
  if (isKnownDriver(n) && !S.forceExtra) {
    nameEl.setCustomValidity('');
    if ($('#drvExtra').dataset.mode !== 'lic') showDriverExtra(false);
    put(note, '<span class="cd-ok">✓ พบชื่อในระบบแล้ว ไม่ต้องกรอกข้อมูลเพิ่ม</span>');
    var paint = function () { put($('#licCard'), licCardHtml(S.drvLic[n])); put($('#licNote'), licCardHtml(S.drvLic[n]) ? '' : licNote(S.drvLic[n])); };
    if (S.drvLic[n] !== undefined) paint();
    else call('driverCheck', { name: n }).then(function (r) {
      S.drvLic[n] = (r && r.licenseExp) || '';
      var cur = $('#fCheckout'); if (cur && cur.elements['name'].value.trim() === n) paint();
    }).catch(function () { /* เช็กไม่ได้ก็เบิกต่อได้ */ });
  } else {
    // ชื่อใหม่: ต้องเพิ่มชื่อ เบอร์โทร และวันหมดอายุใบขับขี่ที่หน้า "เพิ่มชื่อคนขับ" ก่อน แล้วค่อยเบิกรถต่อ
    showDriverExtra(false); put($('#licCard'), ''); put($('#licNote'), '');
    nameEl.setCustomValidity('ยังไม่มีชื่อนี้ในระบบ กรุณากด "เพิ่มชื่อของฉัน" ก่อนเบิกรถ');
    put(note, '<div class="newdrv-note"><b>ยังไม่มีชื่อ "' + esc(n) + '" ในระบบ</b><span>เพิ่มชื่อ เบอร์โทร และวันหมดอายุใบขับขี่ก่อน (ทำครั้งเดียว) แล้วค่อยเบิกรถต่อ</span>' +
      '<button type="button" class="small" data-act="newdriver">+ เพิ่มชื่อของฉัน</button></div>');
  }
}
function nameField(label) {
  return '<label>' + label + '</label><input name="name" list="drivers" maxlength="60" required autocomplete="name" value="' + esc(S.name) + '" placeholder="พิมพ์หรือเลือกชื่อ">' +
    '<datalist id="drivers">' + S.drivers.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>';
}
// สแกน QR ของรถคันไหน จะล็อกอยู่ที่คันนั้น (S.locked = รหัสรถ) ไม่มีเมนูสลับไปคันอื่น เปิดลิงก์ปกติที่ไม่มี ?car= ยังเลือกรถได้
function curCar() {
  if (S.locked) { var lc = S.cars.filter(function (c) { return c.id === S.locked; })[0]; if (lc) return lc; }
  return S.cars.filter(function (c) { return c.plate === S.plate; })[0] || S.cars[0];
}

/* ย่อรูปบนมือถือก่อนอัปโหลด */
function shrink(file) { return shrinkTo(file, 1800, 0.85); }
function shrinkTo(file, max, quality) {
  return new Promise(function (resolve, reject) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var r = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = function () { reject(new Error('เปิดรูปไม่ได้')); };
    img.src = url;
  });
}
function readDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(new Error('อ่านไฟล์ไม่ได้')); };
    r.readAsDataURL(file);
  });
}

/* ---------- ไอคอน + ธีม ---------- */
var ICON = {
  car:'<path d="M5 16l1.6-5.1A2 2 0 0 1 8.5 9.5h7a2 2 0 0 1 1.9 1.4L19 16"/><path d="M3 16h18v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="13.2" r=".7"/><circle cx="16.5" cy="13.2" r=".7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".7"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon:'<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
  qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4"/>',
  chart:'<path d="M4 20V11M10 20V5M16 20v-7M2 20h20"/>',
  expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  compress:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.9 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-7.8-9-7.8z"/><circle cx="7.5" cy="11" r=".9"/><circle cx="10" cy="7" r=".9"/><circle cx="14.5" cy="7" r=".9"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  edit:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  idcard:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.6 1.8-2.4 3-2.4s2.4.8 3 2.4M15 10h3M15 14h3"/>',
  power:'<path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>'
};
function ic(n, size) {
  var z = size || 22;
  return '<svg class="ic" width="' + z + '" height="' + z + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>';
}
function paintIcons() {
  document.querySelectorAll('[data-i]').forEach(function (el) { el.innerHTML = ic(el.dataset.i, Number(el.dataset.s) || 22); el.style.display = 'contents'; });
}
function logoImg(cls) { return S.logo ? '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + S.logo + '" alt="โลโก้ ' + esc(S.company) + '">' : ''; }
function applyLogo() {
  var el = $('#brandLogo'); if (!el) return;
  if (S.logo) { el.removeAttribute('data-i'); el.className = 'logo img'; el.style.display = ''; el.innerHTML = logoImg(); }
  else if (!el.hasAttribute('data-i')) { el.setAttribute('data-i', 'car'); el.className = 'logo'; el.innerHTML = ''; paintIcons(); }
}
function shrinkLogo(file) {
  return new Promise(function (resolve, reject) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var r = Math.min(1, 320 / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * r)); c.height = Math.max(1, Math.round(img.height * r));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png')); // PNG เพื่อเก็บพื้นโปร่งใส
    };
    img.onerror = function () { reject(new Error('เปิดไฟล์รูปไม่ได้')); };
    img.src = url;
  });
}
var PALETTES = [['emerald', 'มรกต', '#047857', '#34d399'], ['ocean', 'น้ำเงิน', '#1d4ed8', '#60a5fa'], ['violet', 'ม่วง', '#6d28d9', '#a78bfa'],
  ['sunset', 'ส้ม', '#c2410c', '#fb923c'], ['rose', 'ชมพู', '#be185d', '#f472b6'], ['slate', 'เทาเข้ม', '#334155', '#94a3b8']];
function curPalette() { var p = document.documentElement.getAttribute('data-palette') || 'emerald'; return PALETTES.some(function (x) { return x[0] === p; }) ? p : 'emerald'; }
function setPalette(id, save) {
  if (!PALETTES.some(function (x) { return x[0] === id; })) id = 'emerald';
  document.documentElement.setAttribute('data-palette', id);
  if (save) { try { localStorage.setItem('palette', id); } catch (e) {} }
  var m = document.querySelector('meta[name=theme-color]');
  if (m) { var a = getComputedStyle(document.documentElement).getPropertyValue('--a1').trim(); if (a) m.setAttribute('content', a); }
}
function closePalette() { var o = $('#palPop'); if (o) o.remove(); }
function togglePalette() {
  if ($('#palPop')) return closePalette();
  var cur = curPalette(), el = document.createElement('div'); el.id = 'palPop'; el.className = 'palpop';
  el.innerHTML = '<div class="pp-h">เลือกสีธีม</div><div class="pp-g">' + PALETTES.map(function (x) {
    return '<button type="button" data-p="' + x[0] + '" class="' + (x[0] === cur ? 'on' : '') + '"><i style="background:linear-gradient(135deg,' + x[2] + ',' + x[3] + ')"></i><span>' + x[1] + '</span></button>';
  }).join('') + '</div><div class="pp-f">ใช้ได้ทั้งโหมดสว่างและมืด จำค่าไว้ในเครื่องนี้</div>';
  el.addEventListener('click', function (e) {
    e.stopPropagation(); var b = e.target.closest('button[data-p]'); if (!b) return;
    setPalette(b.dataset.p, true); el.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
  });
  document.body.appendChild(el);
}
document.addEventListener('click', function (e) { if (!e.target.closest('#palPop') && !e.target.closest('#palBtn')) closePalette(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePalette(); if (ADMIN_MODE && (S.carForm || S.tl)) { S.carForm = false; S.tl = ''; S.edit = ''; render(); } } });
function setTheme(t, save) {
  document.documentElement.setAttribute('data-theme', t);
  if (save) { try { localStorage.setItem('theme', t); } catch (e) { /* เบราว์เซอร์บล็อกที่เก็บข้อมูล ใช้ได้เฉพาะรอบนี้ */ } }
  setPalette(curPalette(), false);
  var tb = $('#themeBtn');
  if (tb) { tb.innerHTML = ic(t === 'dark' ? 'sun' : 'moon', 18); tb.setAttribute('aria-label', t === 'dark' ? 'เปลี่ยนเป็นโหมดปกติ' : 'เปลี่ยนเป็นโหมดมืด'); }
}

/* ---------- เต็มจอ / ติดตั้งเป็นแอป ----------
   เบราว์เซอร์ไม่ให้เข้าเต็มจอเองตอนเปิดหน้า จึงเข้าเต็มจอเมื่อแตะหน้าจอครั้งแรก (Android/คอมพิวเตอร์)
   ถ้าผู้ใช้กดออกเอง จะไม่บังคับซ้ำในรอบนั้น ส่วน iPhone ใช้วิธีติดตั้งเป็นแอปบนหน้าจอหลัก */
var FS = {
  standalone: !!((window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone),
  supported: !!(document.fullscreenEnabled && document.documentElement.requestFullscreen),
  mobile: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches),
  ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
  prompt: null, auto: true
};
function isFull() { return !!document.fullscreenElement; }
function enterFull() { if (FS.supported && !isFull()) document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(function () {}); }
function toggleFull() { if (isFull()) { FS.auto = false; document.exitFullscreen().catch(function () {}); } else enterFull(); }
function paintFsBtn() {
  var b = $('#fsBtn'); if (!b) return;
  b.classList.toggle('hide', FS.standalone || !FS.supported);
  b.innerHTML = ic(isFull() ? 'compress' : 'expand', 18);
  b.setAttribute('aria-label', isFull() ? 'ออกจากเต็มจอ' : 'เต็มจอ');
}
function initFullscreen() {
  if (FS.standalone) document.body.classList.add('standalone');
  if (sget('sessionStorage', 'fsOff')) FS.auto = false;
  $('#fsBtn').addEventListener('click', function (e) { e.stopPropagation(); toggleFull(); });
  document.addEventListener('fullscreenchange', function () {
    if (!isFull()) { FS.auto = false; sset('sessionStorage', 'fsOff', '1'); } // ออกเอง = ไม่บังคับซ้ำ
    paintFsBtn();
  });
  // เบราว์เซอร์นับการแตะบนจอสัมผัสเป็น "การกดของผู้ใช้" ตอนปล่อยนิ้ว (pointerup/click) ไม่ใช่ตอนแตะลง
  // จึงลองเข้าเต็มจอทุกครั้งที่แตะ จนกว่าจะเข้าได้ (เลื่อนหน้าจอไม่นับ) หยุดเมื่อผู้ใช้กดออกเอง
  var tryFull = function () { if (FS.auto && !FS.standalone && FS.supported && !isFull()) enterFull(); };
  ['pointerup', 'click'].forEach(function (ev) { document.addEventListener(ev, tryFull, true); });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); FS.prompt = e; if (!ADMIN_MODE && S.tab === 'home') render(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  paintFsBtn();
}
function installCard() {
  if (FS.standalone || !FS.mobile || sget('localStorage', 'installHide')) return '';
  var how = FS.prompt ? '<button data-act="install">ติดตั้งแอป</button>'
    : FS.ios ? '<div class="mute" style="font-size:13px;margin-top:4px">แตะปุ่ม <b>แชร์</b> ด้านล่างของ Safari แล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b></div>'
    : '<div class="mute" style="font-size:13px;margin-top:4px">แตะ ⋮ มุมขวาบนของ Chrome แล้วเลือก <b>เพิ่มลงในหน้าจอหลัก</b> หรือ <b>ติดตั้งแอป</b></div>';
  return '<div class="card install"><img src="icons/icon-192.png?v=3" alt=""><div><b>เปิดเป็นแอปเต็มจอ</b><div class="mute" style="font-size:14px">ติดตั้งไว้บนหน้าจอหลัก เปิดแล้วเต็มจอทุกครั้ง ไม่มีแถบเบราว์เซอร์</div>' +
    how + '<div class="btns"><button class="ghost" data-act="installhide">ไม่ต้องแสดงอีก</button></div></div></div>';
}

/* ---------- ตัวช่วย: ค้างเบิก / เดือน / กล่องยืนยัน ---------- */
var ODO_GAP = 300, TRIP_MAX = 800; // เกณฑ์เตือนเลขไมล์ผิดปกติ (กม.)
function hoursSince(ts) { var t = new Date(String(ts).replace(' ', 'T') + '+07:00').getTime(); return isNaN(t) ? 0 : (Date.now() - t) / 3600000; }
function overdue(ts) { var h = hoursSince(ts); return h >= 24 ? 'ค้าง ' + Math.floor(h / 24) + ' วัน' : ''; }
var MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
function monthTh(m) { return MONTHS[Number(m.slice(5, 7)) - 1] + ' ' + (Number(m.slice(0, 4)) + 543); }
function km(n) { return Number(n || 0).toLocaleString('th-TH'); }
function askConfirm(msg, okText, withReason) {
  return new Promise(function (resolve) {
    $('#modal').style.display = 'block'; $('#modalClose').style.display = 'none';
    $('#modalBody').innerHTML = '<h2>ตรวจสอบอีกครั้ง</h2><div style="white-space:pre-line">' + esc(msg) + '</div>' +
      (withReason ? '<label>เหตุผล</label><input id="mReason" maxlength="150" placeholder="เช่น กดเบิกผิดคัน">' : '') +
      '<button id="mOk">' + esc(okText || 'ยืนยัน') + '</button><button class="ghost" id="mNo">' + (withReason ? 'ยกเลิก' : 'กลับไปแก้') + '</button>';
    var done = function (v) { $('#modal').style.display = 'none'; $('#modalClose').style.display = ''; resolve(v); };
    $('#mOk').onclick = function () {
      if (!withReason) return done(true);
      var r = $('#mReason').value.trim(); if (!r) return toast('กรุณาระบุเหตุผล', 'err'); done(r);
    };
    $('#mNo').onclick = function () { done(false); };
  });
}

/* ---------- แถบด้านบน: หน้ารถแสดงป้ายทะเบียน + พ.ร.บ./ภาษี/ประกัน หน้าอื่นแสดงชื่อหน้า ---------- */
function headerLeft() {
  if (ADMIN_MODE) {
    var pg = ADMIN_PAGES.filter(function (p) { return p[0] === S.asub; })[0] || ADMIN_PAGES[0];
    return '<div class="abar"><span class="crumb">แอดมิน</span><span class="sep">/</span><b>' + pg[1] + '</b></div><span class="adate">' + ic('clock', 15) + new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</span>';
  }
  if (S.tab === 'car' && S.cars.length) {
    var car = curCar(), t = openTripOf(car.plate);
    return '<div class="hcar"><div class="hplate">' + plateHtml(car, 'st-' + carHealth(car)) +
      '<span class="hchip type">' + vIcon(car.vtype) + ' ' + esc(vShort(car.vtype || (t ? 'ถูกเบิกอยู่' : 'ว่าง'))) + '</span></div>' +
      '<div class="hexp">' + hexpRow('พ.ร.บ.', car.actExp) + hexpRow('ภาษี', car.taxExp) + hexpRow('ประกัน', car.insExp, car.insurer) + '</div></div>';
  }
  return '<div class="htitle">' + (S.tab === 'expense' ? 'บันทึกค่าใช้จ่าย' : S.tab === 'car' ? 'รถ' : 'หน้าแรก') + '</div>';
}
// แถวเดียวต่อรายการ: ชื่อ · วันหมดอายุ (ปีย่อ) · บริษัทประกัน · จำนวนวันที่เหลือ
function hexpRow(label, d, sub) {
  var n = daysLeft(d), cls = n === null ? 'na' : n < 0 ? 'bad' : n <= 30 ? 'warn' : 'ok';
  var txt = n === null ? 'ไม่ระบุ' : n < 0 ? 'เกิน ' + (-n) + ' วัน' : n === 0 ? 'วันนี้' : n + ' วัน';
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''), short = m ? m[3] + '/' + m[2] + '/' + String(Number(m[1]) + 543).slice(2) : '';
  var co = sub ? String(sub).replace(/\s*ประกันภัย\s*/, ' ').trim() : ''; // แถบด้านบนย่อชื่อบริษัท เช่น "วิริยะประกันภัย" -> "วิริยะ"
  var full = label + (d ? ' หมดอายุ ' + thDate(d) : '') + (sub ? ' · ' + sub : '') + (n === null ? '' : n < 0 ? ' · เกินกำหนด ' + (-n) + ' วัน' : ' · เหลือ ' + n + ' วัน');
  return '<div class="hx" title="' + esc(full) + '"><span class="hx-l">' + label + '</span><span class="hx-d">' + short + (co ? ' · ' + esc(co) : '') + '</span><b class="' + cls + '">' + txt + '</b></div>';
}

/* ---------- เฟรมหลัก ---------- */
function render() {
  var h = '';
  if (!ADMIN_MODE && S.locked) {
    var lc = curCar();
    if (!lc || lc.id !== S.locked) S.locked = ''; // รถคันนี้ถูกนำออก: กลับไปใช้แบบเลือกรถได้
    else { S.plate = lc.plate; if (S.tab === 'home') S.tab = 'car'; }
  }
  var hb = document.querySelector('nav button[data-t=home]'); if (hb) hb.classList.toggle('hide', !!S.locked);
  document.body.classList.toggle('admin', !!ADMIN_MODE);
  $('#nav').classList.toggle('hide', !!ADMIN_MODE || !S.cars);
  if (ADMIN_MODE) h = viewAdmin();
  else if (S.tab === 'car') h = viewCar();
  else if (S.tab === 'expense') h = viewExpense();
  else h = viewHome();
  $('#app').innerHTML = h;
  $('#hLeft').innerHTML = headerLeft();
  document.querySelector('header').classList.toggle('carhead', !ADMIN_MODE && S.tab === 'car' && S.cars.length > 0);
  document.querySelectorAll('nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === S.tab); });
  bindForms();
  paintIcons();
  applyLogo();
  paintFsBtn();
  if (ADMIN_MODE && S.asub === 'qr') drawQr();
  if (!ADMIN_MODE && S.tab === 'car' && (S.sub === 'history' || S.sub === 'maint')) ensureHist();
}

function links(s) {
  if (!s) return '';
  return '<div>' + String(s).split('\n').map(function (u, i) {
    return /^https:\/\/(drive|docs)\.google\.com\//.test(u) ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">รูป ' + (i + 1) + '</a> ' : '';
  }).join('') + '</div>';
}
function imageField(label) {
  return '<label>' + esc(label || 'แนบรูป') + ' (ไม่เกิน 5 รูป)</label>' +
    '<input type="file" id="imgs" accept="image/*" multiple><div class="thumbs" id="thumbs"></div>';
}
function expClass(d) {
  if (!d) return '';
  var t = today(), lim = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return d < t ? 'exp-bad' : (d <= lim ? 'exp-warn' : '');
}

/* ---------- หน้าแรก ---------- */
function soonest(c) {
  var best = null;
  [['พ.ร.บ.', c.actExp], ['ภาษี', c.taxExp], ['ประกัน', c.insExp]].forEach(function (p) {
    var n = daysLeft(p[1]);
    if (n !== null && (best === null || n < best.n)) best = { what: p[0], n: n };
  });
  return best;
}
function viewHome() {
  var h = '<div class="hello">' + (S.logo ? '<div class="hello-logo">' + logoImg() + '</div>' : '') + '<div><span class="co">' + esc(S.company) + '</span><b>สวัสดี' + (S.name ? ' คุณ' + esc(S.name) : '') + '</b><span>' + (S.cars.length ? 'เลือกรถที่ต้องการ หรือสแกน QR ที่รถ' : 'ยังไม่มีรถในระบบ') + '</span></div></div>';
  h += installCard();
  if (S.cars.length) {
    h += '<div class="tiles" style="margin-bottom:14px">' + S.cars.map(function (c) {
      var t = openTripOf(c.plate), sn = soonest(c);
      var cls = sn && sn.n < 0 ? '' : sn && sn.n <= 30 ? 'warn' : 'free';
      return '<button class="tile" data-act="opencar" data-p="' + esc(c.plate) + '">' +
        plateHtml(c, 'sm') +
        '<div class="mdl">' + esc(c.model) + '</div>' +
        (t ? '<span class="chip">ถูกเบิกโดย ' + esc(t.name) + (overdue(t.ts) ? ' · ' + overdue(t.ts) : '') + '</span>' : '<span class="chip free">ว่าง พร้อมใช้</span>') +
        (sn && sn.n <= 30 ? '<span class="chip ' + cls + '">' + sn.what + ' ' + cdText(sn.n) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  var od = S.open.filter(function (t) { return overdue(t.ts); });
  if (od.length) {
    h += '<div class="card"><h2>ลืมคืนรถหรือเปล่า?</h2>' + od.map(function (t) {
      return '<div class="alert bad">' + esc(t.plate) + ' · ' + esc(t.name) + ' · ' + overdue(t.ts) + '</div>';
    }).join('') + '<div class="mute" style="font-size:13px">เบิกค้างเกิน 24 ชั่วโมง ให้กดที่รถเพื่อคืนรถ หรือแจ้งแอดมินยกเลิกถ้าเบิกผิด</div></div>';
  }
  if (S.alerts.length) {
    h += '<div class="card"><h2>แจ้งเตือนวันครบกำหนด</h2>' + S.alerts.map(function (a) {
      return '<div class="alert ' + (a.expired ? 'bad' : '') + '">' + esc(a.plate) + ' · ' + esc(a.what) + ' ' +
        (a.expired ? 'เลยกำหนดแล้ว ' : 'ครบกำหนด ') + thDate(a.date) + '</div>';
    }).join('') + '</div>';
  }
  if (S.open.length) {
    h += '<div class="card"><h2>รถที่ถูกเบิกอยู่</h2>' + S.open.map(function (t) {
      return '<div class="row"><b>' + esc(t.plate) + '</b> · ' + esc(t.name) + (overdue(t.ts) ? ' <span class="chip">' + overdue(t.ts) + '</span>' : '') + '<br><span class="mute">' + thTime(t.ts) + ' · ' + esc(t.purpose) + '</span></div>';
    }).join('') + '</div>';
  }
  h += '<div class="card"><h2>การใช้รถล่าสุด</h2>' + (S.usage.length ? S.usage.map(function (u) {
    var km = u.status === 'open' ? 'ยังไม่คืนรถ' : u.status === 'cancelled' ? esc(u.returnName || 'ยกเลิก') : (u.odoEnd - u.odoStart) + ' กม.';
    return '<div class="row"><b>' + esc(u.plate) + '</b> · ' + esc(u.name) + '<br>' + esc(u.purpose) +
      '<br><span class="mute">' + thTime(u.ts) + ' · ' + km + '</span>' + links(u.images) + links(u.returnImages) + '</div>';
  }).join('') : '<div class="mute">ยังไม่มีรายการ</div>') + '</div>';
  h += '<div class="card"><h2>ค่าใช้จ่ายล่าสุด</h2>' + (S.expenses.length ? S.expenses.map(function (e) {
    return '<div class="row"><b>' + esc(e.plate) + '</b> · ' + esc(e.type) + ' · ' + baht(e.amount) + ' บาท<br>' +
      '<span class="mute">' + thDate(e.date) + ' · ' + esc(e.name) + (e.note ? ' · ' + esc(e.note) : '') + '</span>' + links(e.images) + '</div>';
  }).join('') : '<div class="mute">ยังไม่มีรายการ</div>') + '</div>';
  return h;
}

/* ---------- หน้ารถ (ปลายทางของ QR) ---------- */
function openTripOf(plate) { return S.open.filter(function (t) { return t.plate === plate; })[0]; }

function daysLeft(d) {
  if (!d) return null;
  var a = d.split('-'), t = today().split('-');
  return Math.round((Date.UTC(+a[0], a[1] - 1, +a[2]) - Date.UTC(+t[0], t[1] - 1, +t[2])) / 86400000);
}
function cdText(n) { return n === null ? 'ยังไม่ระบุ' : n < 0 ? 'เกินกำหนด ' + (-n) + ' วัน' : n === 0 ? 'หมดอายุวันนี้' : 'เหลือ ' + n + ' วัน'; }
function cdClass(n) { return n === null ? 'cd-na' : n < 0 ? 'cd-bad' : n <= 30 ? 'cd-warn' : 'cd-ok'; }
function cdRow(label, d, extra) {
  var n = daysLeft(d);
  return '<div class="cdrow"><div class="t"><span>' + label + '</span><span class="' + cdClass(n) + '">' + cdText(n) + '</span></div>' +
    '<div class="d">' + (d ? 'หมดอายุ ' + thDate(d) : '') + '</div>' + (extra || '') + '</div>';
}

/* ---------- ประเภทรถ / สีป้ายทะเบียน ---------- */
var VTYPES = [['รถเก๋ง', '🚗'], ['รถกระบะ', '🛻'], ['รถตู้', '🚐'], ['รถอเนกประสงค์ (SUV/MPV)', '🚙'], ['รถบรรทุก', '🚚'], ['รถจักรยานยนต์', '🏍️'], ['อื่นๆ', '🚘']];
var PLATE_COLORS = [['black', 'ขาว-ดำ (รถนั่งไม่เกิน 7 ที่นั่ง)'], ['green', 'ขาว-เขียว (รถบรรทุก/กระบะส่วนบุคคล)'], ['blue', 'ขาว-น้ำเงิน (รถนั่งเกิน 7 ที่นั่ง เช่น รถตู้)'], ['red', 'ป้ายแดง (รถใหม่ยังไม่จดทะเบียน)']];
// สีป้ายตั้งให้อัตโนมัติจากประเภทรถ (ไม่มีช่องให้เลือก): ขาว-ดำ รถนั่ง/จยย. · ขาว-เขียว กระบะ/บรรทุก · ขาว-น้ำเงิน รถตู้
function plateColorFor(vtype) {
  return { 'รถเก๋ง': 'black', 'รถอเนกประสงค์ (SUV/MPV)': 'black', 'รถจักรยานยนต์': 'black', 'อื่นๆ': 'black', 'รถกระบะ': 'green', 'รถบรรทุก': 'green', 'รถตู้': 'blue' }[vtype] || '';
}
// ชื่อประเภทรถแบบสั้นสำหรับแถบด้านบน (พื้นที่จำกัด)
function vShort(t) { return { 'รถอเนกประสงค์ (SUV/MPV)': 'SUV/MPV', 'รถจักรยานยนต์': 'จักรยานยนต์' }[t] || String(t).replace(/\s*\(.*\)\s*$/, ''); }
function vIcon(t) { var v = VTYPES.filter(function (x) { return x[0] === t; })[0]; return v ? v[1] : '🚗'; }
function plateHtml(c, cls) {
  var pc = ['green', 'blue', 'red'].indexOf(c.plateColor) >= 0 ? ' pc-' + c.plateColor : '';
  return '<div class="plate' + (cls ? ' ' + cls : '') + pc + '"><div class="no">' + esc(c.plate) + '</div><div class="pv">' + esc(c.province || '') + '</div></div>';
}

/* ---------- หน้ารถ: การ์ดสรุป + เมนูแบบแถว ---------- */
function lastService(plate) {
  return S.maint.filter(function (m) { return m.plate === plate && m.type === SERVICE; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
}
function odoDigits(n) {
  if (n === '' || n == null) return '<span class="mute">ยังไม่มีข้อมูล</span>';
  var s = String(Math.round(Number(n))); while (s.length < 6) s = '0' + s;
  return '<span class="odo">' + s.split('').map(function (d) { return '<i>' + d + '</i>'; }).join('') + '</span>';
}
function serviceBlock(car) {
  var sv = lastService(car.plate);
  var head = function (right, cls) { return '<div class="sv-head"><span>🔧 เช็คระยะถัดไป</span><b class="' + (cls || '') + '">' + right + '</b></div>'; };
  if (!sv) return '<div class="cs-svc">' + head('ยังไม่มีข้อมูล', 'na') + '</div>';
  var nd = daysLeft(sv.nextDate), cur = car.lastOdo === '' ? null : Number(car.lastOdo);
  var hasKm = sv.nextOdo !== '' && sv.odo !== '' && cur !== null && Number(sv.nextOdo) > Number(sv.odo);
  var dayTxt = nd === null ? '' : (nd < 0 ? 'เกิน ' + (-nd) + ' วัน' : 'อีก ' + nd + ' วัน');
  if (!hasKm) {
    var dc = nd === null ? 'na' : nd < 0 ? 'bad' : nd <= 30 ? 'warn' : 'ok';
    return '<div class="cs-svc">' + head(dayTxt || 'ไม่ได้กำหนด', dc) + '<div class="sv-cap">เช็คล่าสุด ' + thDate(sv.date) + (sv.odo !== '' ? ' ที่ ' + km(sv.odo) + ' กม.' : '') + '</div></div>';
  }
  var interval = Number(sv.nextOdo) - Number(sv.odo), used = Math.max(0, cur - Number(sv.odo)), left = Number(sv.nextOdo) - cur;
  var pct = Math.min(100, Math.round(used / interval * 100));
  var cls = left < 0 || (nd !== null && nd < 0) ? 'bad' : (left <= Math.max(500, interval * 0.1) || (nd !== null && nd <= 30)) ? 'warn' : 'ok';
  return '<div class="cs-svc">' + head(left < 0 ? 'เกิน ' + km(-left) + ' กม.' : 'อีก ' + km(left) + ' กม.', cls) +
    '<div class="sv-bar ' + cls + '"><i style="width:' + Math.max(pct, 3) + '%"></i><span>' + pct + '%</span></div>' +
    '<div class="sv-cap">ใช้ไป ' + km(used) + ' / ' + km(interval) + ' กม. · เช็คล่าสุดที่ ' + km(sv.odo) + ' กม.' + (dayTxt ? ' · ' + dayTxt : '') + '</div></div>';
}
function viewCar() {
  if (!S.cars.length) return '<div class="card">ยังไม่มีรถในระบบ ให้แอดมินเพิ่มในหน้าแอดมิน</div>';
  var car = curCar(); S.plate = car.plate;
  var t = openTripOf(car.plate);
  if (S.sub) return subPage(car, t);
  var parts = String(car.model || '').trim().split(/\s+/), brand = parts.shift() || 'รถ', rest = parts.join(' ');
  var svc = serviceBlock(car);
  var h = '<div class="carsum ' + (t ? 'busy' : 'free') + '">' +
    '<div class="cs-top"><div class="cs-ic">' + vIcon(car.vtype) + '</div><div class="cs-name"><b>' + esc(brand) + '</b>' + (rest ? '<span>' + esc(rest) + '</span>' : '') + '</div>' +
    (t ? '<span class="cs-st busy">ถูกเบิกโดย ' + esc(t.name) + '</span>' : '<span class="cs-st free">ว่าง พร้อมใช้งาน</span>') + '</div>' +
    '<div class="cs-odo"><span>🛣️ ไมล์ล่าสุด</span>' + odoDigits(car.lastOdo) + '<em>กม.</em></div>' +
    svc + '</div>';
  h += '<div class="mlist">' +
    mRow('trip', t ? '🔑' : '🚗', t ? 'คืนรถ' : 'เบิกรถ', t ? 'เบิกโดย ' + esc(t.name) + ' · ' + thTime(t.ts) : 'บันทึกการใช้รถก่อนออกเดินทาง', true) +
    mRow('info', '📋', 'ข้อมูลรถ', 'รายละเอียดรถ ภาษี พ.ร.บ. ประกัน สำเนาทะเบียน') +
    mRow('history', '🕘', 'ประวัติการใช้งาน', 'ใครใช้ เมื่อไหร่ ไปไหน') +
    mRow('maint', '🔧', 'ประวัติซ่อมบำรุง', 'งานซ่อมและเช็คระยะ') + '</div>';
  if (!S.locked) h += '<select id="pickCar" class="pick" aria-label="เปลี่ยนรถ">' + S.cars.map(function (c) {
    return '<option value="' + esc(c.plate) + '"' + (c.plate === car.plate ? ' selected' : '') + '>เปลี่ยนรถ: ' + esc(c.plate) + ' ' + esc(c.model) + '</option>';
  }).join('') + '</select>';
  if (S.locked && !FS.supported) h += installCard(); // iPhone เข้าเต็มจอจากเว็บไม่ได้ แนะนำให้ติดตั้งเป็นแอปแทน
  h += '<div class="foot">' + (S.logo ? '<div class="foot-logo">' + logoImg() + '</div>' : '') + '<b>' + esc(S.company) + '</b><span>ระบบรถส่วนกลาง</span></div>';
  return h;
}
function mRow(k, emo, title, sub, primary) {
  return '<button class="mrow' + (primary ? ' primary' : '') + '" data-act="sub" data-s="' + k + '"><span class="mr-ic">' + emo + '</span><span class="mr-tx"><b>' + title + '</b><span>' + sub + '</span></span><span class="mr-go" aria-hidden="true">›</span></button>';
}

/* ---------- หน้าย่อยของรถ (แถบด้านบนอยู่ที่เดิม ปัดขวาเพื่อย้อนกลับ) ---------- */
function subPage(car, t) {
  var title = { trip: t ? 'คืนรถ' : 'เบิกรถ', newdriver: 'เพิ่มชื่อคนขับ', history: 'ประวัติการใช้งาน', info: 'ข้อมูลรถ', maint: 'ประวัติซ่อมบำรุง' }[S.sub] || '';
  var body = S.sub === 'trip' ? viewTrip(car, t) : S.sub === 'newdriver' ? viewNewDriver() : S.sub === 'history' ? viewHistory(car) : S.sub === 'info' ? viewInfo(car) : viewMaint(car);
  var anim = S.lastSheet === S.sub ? '' : ' slidein'; S.lastSheet = S.sub;
  return '<div class="subpage' + anim + '">' + (S.sub === 'newdriver' ? '<button class="backlink" data-act="sub" data-s="trip">← กลับไปเบิกรถ</button>' : '<button class="backlink" data-act="closesheet">← กลับเมนูรถ</button>') +
    '<h2 class="sp-title">' + title + '</h2>' + body + '<div class="swipe-hint">ปัดขวาเพื่อย้อนกลับ</div></div>';
}
function openSheet(k) {
  S.sub = k; S.mopen = false; S.mdef = '';
  try { if (!(history.state && history.state.sheet)) history.pushState({ sheet: 1 }, ''); } catch (e) {}
  render(); window.scrollTo(0, 0);
}
function closeSheet() {
  if (!S.sub) return;
  try { if (history.state && history.state.sheet) { history.back(); return; } } catch (e) {}
  S.sub = ''; S.lastSheet = ''; render(); window.scrollTo(0, 0);
}
window.addEventListener('popstate', function () { if (S.sub) { S.sub = ''; S.lastSheet = ''; render(); window.scrollTo(0, 0); } });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.sub && !ADMIN_MODE) closeSheet(); });
// ปัดขวาเพื่อย้อนกลับ
(function () {
  var sx = 0, sy = 0, st = 0, on = false;
  document.addEventListener('touchstart', function (e) {
    on = !ADMIN_MODE && S.tab === 'car' && !!S.sub && e.touches.length === 1 && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    if (on) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!on) return; on = false;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (dx > 70 && Math.abs(dy) < 50 && Date.now() - st < 700) closeSheet();
  }, { passive: true });
})();
var MENU_IC = { trip:'car', history:'clock', info:'info', maint:'wrench' };
function menuBtn(k, label) { return '<button data-act="sub" data-s="' + k + '" class="' + (S.sub === k ? 'on' : '') + '"><span class="mi">' + ic(MENU_IC[k], 24) + '</span><span>' + label + '</span></button>'; }

/* ---------- ปุ่มลัดตอนเบิกรถ ---------- */
var DEFAULT_PURPOSES = ['ส่งเอกสาร', 'พบลูกค้า', 'ติดต่อสรรพากร', 'ติดต่อธนาคาร', 'ติดต่อหน่วยงานราชการ', 'ซื้อของสำนักงาน'];
function topValues(list, max) {
  var cnt = {}; list.forEach(function (v) { v = String(v || '').trim(); if (v) cnt[v] = (cnt[v] || 0) + 1; });
  return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, max);
}
function uniq(a) { var seen = {}; return a.filter(function (v) { v = String(v || '').trim(); if (!v || seen[v]) return false; seen[v] = 1; return true; }); }
function chips(field, values) {
  return values.length ? '<div class="qchips" data-field="' + field + '">' + values.map(function (v) { return '<button type="button" class="qchip" data-v="' + esc(v) + '">' + esc(v) + '</button>'; }).join('') + '</div>' : '';
}
// เพิ่มชื่อคนขับก่อนเบิกรถครั้งแรก (ทำครั้งเดียว) บันทึกแล้วกลับไปหน้าเบิกรถพร้อมชื่อที่กรอก
function viewNewDriver() {
  return '<form class="card" id="fNewDriver"><div class="mute" style="font-size:14px">ทำครั้งเดียว ครั้งต่อไปเบิกรถได้เลยโดยไม่ต้องกรอกซ้ำ</div>' +
    '<label>ชื่อคนขับ <span class="req">*</span></label><input name="name" required maxlength="60" autocomplete="name" value="' + esc(S.newName || '') + '" placeholder="ชื่อที่ใช้เบิกรถ">' +
    '<label>เบอร์โทร <span class="req">*</span></label><input name="phone" type="tel" inputmode="tel" required maxlength="12" autocomplete="tel" placeholder="เช่น 0812345678">' +
    '<label>ใบขับขี่หมดอายุ <span class="req">*</span></label><input name="licenseExp" type="date" required>' +
    '<div id="regLicNote" style="font-size:13.5px;margin-top:6px"></div>' +
    '<button type="submit">บันทึกชื่อ แล้วเบิกรถต่อ</button></form>';
}
function viewTrip(car, t) {
  if (!t) {
    var names = uniq([S.name].concat(Object.keys(S.profiles), topValues(S.allUsage.map(function (u) { return u.name; }), 6))).slice(0, 6);
    var purposes = uniq(topValues(S.allUsage.map(function (u) { return u.purpose; }), 6).concat(DEFAULT_PURPOSES)).slice(0, 8);
    var dests = topValues(S.allUsage.map(function (u) { return u.dest; }), 8);
    var last = car.lastOdo;
    // ทำทีละขั้น: ยังไม่เลือกชื่อคนขับ ขั้นต่อไปจะยังไม่ขึ้น (ดู updateSteps)
    return '<form class="card" id="fCheckout">' +
      '<input type="hidden" name="plate" value="' + esc(car.plate) + '">' +
      '<div class="step" data-step="1"><label>ชื่อคนขับ <span class="req">*</span></label>' + chips('name', names) +
      '<input name="name" list="drivers" maxlength="60" required autocomplete="name" value="' + esc(S.name) + '" placeholder="แตะชื่อด้านบน หรือพิมพ์ชื่อของคุณ">' +
      '<datalist id="drivers">' + S.drivers.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      driverFields() + '</div>' +
      '<div class="step hide" data-step="2"><label>เลขไมล์ก่อนออก (กม.) <span class="req">*</span> <small class="mute">ดูจากหน้าปัดรถ' + (last !== '' ? ' · ล่าสุดในระบบ ' + km(last) : '') + '</small></label>' +
      '<input name="odoStart" type="number" inputmode="numeric" min="0" required placeholder="พิมพ์เลขไมล์ที่เห็นบนหน้าปัด">' +
      (last !== '' ? '<button type="button" class="usebtn" data-act="uselast" data-v="' + esc(last) + '">ใช้เลขไมล์ล่าสุด (' + km(last) + ')</button>' : '') + '</div>' +
      '<div class="step hide" data-step="3"><label>วัตถุประสงค์การใช้รถ <span class="req">*</span></label>' + chips('purpose', purposes) +
      '<input name="purpose" maxlength="200" required placeholder="แตะเลือกด้านบน หรือพิมพ์เอง"></div>' +
      '<div class="step hide" data-step="4"><label>ปลายทาง / เส้นทาง</label>' + chips('dest', dests) +
      '<input name="dest" maxlength="120" placeholder="พิมพ์สถานที่ หรือเลือกจากรายการ">' +
      imageField('ถ่ายรูปหน้าปัดไมล์/สภาพรถ (ถ้ามี)') + '<button type="submit">เบิกรถ</button></div></form>';
  }
  return '<form class="card" id="fReturn">' +
    '<div class="tripbox"><div><span class="mute">เบิกโดย</span> <b>' + esc(t.name) + '</b></div><div class="mute">' + thTime(t.ts) + ' · ไมล์ก่อน ' + km(t.odoStart) + '</div>' +
    '<div>' + esc(t.purpose) + (t.dest ? ' · ' + esc(t.dest) : '') + '</div></div>' +
    '<input type="hidden" name="id" value="' + esc(t.id) + '">' +
    '<label>เลขไมล์หลังกลับ (กม.) <span class="req">*</span></label><input name="odoEnd" type="number" inputmode="numeric" min="' + esc(t.odoStart) + '" required placeholder="พิมพ์เลขไมล์ที่เห็นบนหน้าปัด">' +
    '<div id="tripKm" class="mute" style="font-size:13.5px;margin-top:6px"></div>' +
    imageField('ถ่ายรูปหน้าปัดไมล์ตอนคืน (ถ้ามี)') + '<button type="submit">คืนรถ</button></form>';
}

// ประวัติของรถคำนวณจากข้อมูลที่โหลดมาแล้ว (การใช้รถย้อนหลัง 12 เดือน, ซ่อมบำรุงทั้งหมด)
function histOf(plate) {
  return {
    usage: S.allUsage.filter(function (u) { return u.plate === plate; }).slice().reverse().slice(0, 100),
    maint: S.maint.filter(function (m) { return m.plate === plate; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 100)
  };
}
function ensureHist() { /* ไม่ต้องโหลดเพิ่ม */ }

function viewHistory(car) {
  var d = histOf(car.plate);
  if (!d) return '<div class="card center mute">กำลังโหลดประวัติ...</div>';
  return '<div class="card"><h2>ประวัติการใช้รถ 12 เดือนล่าสุด (' + d.usage.length + ' รายการ)</h2>' + (d.usage.length ? d.usage.map(function (u) {
    var km = u.status === 'open' ? '<span class="badge">ยังไม่คืนรถ</span>' : u.status === 'cancelled' ? '<span class="badge">' + esc(u.returnName || 'ยกเลิก') + '</span>' : (u.odoEnd - u.odoStart) + ' กม. · คืน ' + thTime(u.returnTs) + (u.returnName && u.returnName !== u.name ? ' โดย ' + esc(u.returnName) : '');
    return '<div class="row"><b>' + esc(u.name) + '</b> · ' + thTime(u.ts) + '<br>ไปที่: ' + esc(u.purpose) + (u.dest ? ' · ' + esc(u.dest) : '') +
      '<br><span class="mute">ไมล์ ' + esc(u.odoStart) + (u.odoEnd !== '' ? ' → ' + esc(u.odoEnd) : '') + ' · ' + km + '</span>' +
      links(u.images) + links(u.returnImages) + '</div>';
  }).join('') : '<div class="mute">ยังไม่มีประวัติการใช้</div>') + '</div>';
}

var SERVICE = 'ตรวจเช็คตามระยะ';

/* ---------- แยกข้อมูลจากข้อความสำเนาทะเบียน (ผล OCR อาจวางค่าไว้บรรทัดเดียวกับหัวข้อ หรือบรรทัดถัดไป) ---------- */
var PROVINCES = ['กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
  'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช',
  'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี',
  'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม',
  'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ',
  'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี',
  'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี'];
function parseRegText(raw) {
  // OCR บางครั้งให้เลขไทย ตัวอักษรเต็มความกว้าง หรือช่องว่างแปลกๆ จึงทำให้เป็นตัวเลข/ตัวอักษรปกติก่อน
  var text = String(raw || '').replace(/\r/g, '').replace(/[๐-๙]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); })
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[​ ]/g, ' ');
  var lines = text.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  var pickAt = function (labelRe, valueRe) { // คืน [ค่า, เลขบรรทัดที่เจอ]
    for (var i = 0; i < lines.length; i++) {
      var lm = labelRe.exec(lines[i]);
      if (!lm) continue;
      var cands = [lines[i].slice(lm.index + lm[0].length), lines[i + 1] || '', lines[i + 2] || ''];
      for (var j = 0; j < cands.length; j++) {
        var v = valueRe.exec(cands[j].replace(/^[\s:.\-]+/, ''));
        if (v) return [String(v[1] || v[0]).trim(), i];
      }
    }
    return ['', -1];
  };
  var pick = function (labelRe, valueRe) { return pickAt(labelRe, valueRe)[0]; };
  var provRe = new RegExp('(' + PROVINCES.join('|') + ')');
  var plateRe = /((?:[0-9]\s?)?[ก-ฮ]{1,3}\s?-?\s?[0-9]{1,4})(?![0-9])/;
  var out = {};
  var pl = pickAt(/เลขทะเบียน|ทะเบียนรถ/, plateRe), plate = pl[0] || (plateRe.exec(text) || [])[1] || '';
  out.plate = plate.replace(/\s*-\s*/, ' ').replace(/^([0-9])\s+([ก-ฮ])/, '$1$2').replace(/([ก-ฮ])\s*([0-9])/, '$1 $2');
  // จังหวัดของป้าย: หาใกล้บรรทัดเลขทะเบียนก่อน (กันไปหยิบจังหวัดในที่อยู่เจ้าของรถ)
  var prov = '';
  if (pl[1] >= 0) for (var k = pl[1]; k <= pl[1] + 2 && k < lines.length && !prov; k++) prov = (provRe.exec(lines[k]) || [])[1] || '';
  out.province = prov || pick(/จังหวัด/, provRe) || (provRe.exec(text) || [])[1] || (/กรุงเทพ/.test(text) ? 'กรุงเทพมหานคร' : '');
  var brand = pick(/ยี่ห้อรถ|ยี่ห้อ(?!เครื่อง)/, /([A-Za-z][A-Za-z\- ]{1,20})/).toUpperCase();
  var model = pick(/แบบ(?!รถ)|รุ่น(?!ปี)/, /([A-Za-z0-9][A-Za-z0-9\- ]{0,25})/).toUpperCase();
  if (brand && model.indexOf(brand) === 0) model = model.slice(brand.length).trim();
  model = model.replace(/\s+(?:19|20|25)[0-9]{2}$/, '').trim(); // ปีแยกไปอยู่ช่อง "ปี" แล้ว
  out.model = [brand, model].filter(Boolean).join(' ');
  var yr = pick(/รุ่นปี|ปี\s*ค\.?\s*ศ|ปีที่ผลิต/, /((?:19|20|25)[0-9]{2})/);
  out.year = yr ? String(Number(yr) > 2400 ? Number(yr) - 543 : Number(yr)) : '';
  out.color = pick(/(?:^|\s)สี(?![ก-๙]*เครื่อง)/, /([ก-๙]{2,}(?: ?[ก-๙]{2,})?)/);
  // เลขตัวถัง: VIN จริงไม่มีตัว I O Q จึงแก้ที่ OCR มักอ่านพลาด (O→0, I→1, Q→0) และรวมช่องว่างที่ OCR แทรกกลางเลข
  var fixVin = function (v) { v = v.replace(/[ \-]/g, '').toUpperCase(); return v.length === 17 ? v.replace(/[OQ]/g, '0').replace(/I/g, '1') : v; };
  var vinRaw = pick(/เลขตัวรถ|เลขตัวถัง|เลขถัง/, /([A-Z0-9][A-Z0-9 \-]{8,24})/i);
  var vin = vinRaw ? fixVin(vinRaw) : '';
  if (!/^[A-Z0-9]{10,20}$/.test(vin)) vin = '';
  out.vin = vin || ((/\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(text) || [])[1] || '').toUpperCase();
  var eng = pick(/เลขเครื่องยนต์|เลขเครื่อง/, /([A-Z0-9][A-Z0-9 \-]{4,24})/i).replace(/[ ]/g, '').toUpperCase();
  out.engineNo = /^[A-Z0-9\-]{5,20}$/.test(eng) ? eng : '';
  // ประเภทรถ: ดูจาก "ลักษณะ" ก่อน แล้วค่อยใช้รหัส รย.
  var cat = (/ร\s?\.?\s?ย\s?\.?\s?(\d{1,2})(?![0-9])/.exec(text) || [])[1];
  var look = pick(/ลักษณะ(?!รถ[ก-๙]*จดทะเบียน)/, /([ก-๙A-Za-z][ก-๙A-Za-z0-9\/ ()]{1,30})/);
  var vt = '';
  if (/กระบะ|ปิค?กอัพ|ปิ[คก]อัพ|pick\s?-?up/i.test(look)) vt = 'รถกระบะ';
  else if (/ตู้|van\b/i.test(look)) vt = 'รถตู้';
  else if (/เก๋ง|sedan|hatch|แฮทช์/i.test(look)) vt = 'รถเก๋ง';
  else if (/suv|mpv|อเนกประสงค์|แวกอน|วากอน|wagon/i.test(look)) vt = 'รถอเนกประสงค์ (SUV/MPV)';
  else if (/จักรยานยนต์|มอเตอร์ไซค์/.test(look + ' ' + (cat === '12' ? 'จักรยานยนต์' : ''))) vt = 'รถจักรยานยนต์';
  else if (/บรรทุก/.test(look)) vt = 'รถบรรทุก';
  if (!vt) vt = { '1': 'รถเก๋ง', '2': 'รถตู้', '3': 'รถกระบะ', '12': 'รถจักรยานยนต์' }[cat] || '';
  if (vt === 'รถบรรทุก' && cat === '3') vt = 'รถกระบะ';
  if (vt) out.vtype = vt;
  // สีป้ายตามรหัส รย. (ถ้าไม่มี ใช้ตามประเภทรถ): รย.1 ขาว-ดำ · รย.2 ขาว-น้ำเงิน · รย.3 ขาว-เขียว
  var pc = { '1': 'black', '2': 'blue', '3': 'green', '12': 'black' }[cat] || plateColorFor(vt);
  if (pc) out.plateColor = pc;
  out.fuel = pick(/เชื้อเพลิง/, /(เบนซิน|ดีเซล|ไฟฟ้า|ไฮบริด|LPG|NGV|แก๊ส[ก-๙]*)/i);
  Object.keys(out).forEach(function (k) { if (!out[k]) delete out[k]; });
  return out;
}

var OCR_LABELS = { vtype: 'ประเภทรถ', plate: 'ทะเบียน', province: 'จังหวัด', model: 'ยี่ห้อ/รุ่น', year: 'ปี', color: 'สี', fuel: 'เชื้อเพลิง', vin: 'เลขตัวถัง', engineNo: 'เลขเครื่อง' };
var INSURERS = ['วิริยะประกันภัย', 'ทิพยประกันภัย', 'กรุงเทพประกันภัย', 'สินมั่นคงประกันภัย', 'เมืองไทยประกันภัย', 'ไทยศรีประกันภัย', 'ไทยประกันภัย', 'อินทรประกันภัย', 'ชับบ์สามัคคีประกันภัย', 'แอลเอ็มจี ประกันภัย', 'เอเชียประกันภัย 1950', 'นวกิจประกันภัย', 'ไทยวิวัฒน์ประกันภัย', 'ธนชาตประกันภัย', 'โตเกียวมารีนประกันภัย'];

function serviceCard(car, d) {
  var h = '<div class="card"><h2>เช็คระยะ</h2>';
  var last = d && d.maint.filter(function (m) { return m.type === SERVICE; })[0];
  if (!d) return h + '<div class="mute">กำลังโหลด...</div></div>';
  if (!last) return h + '<div class="mute">ยังไม่มีบันทึกการเช็คระยะ</div><button data-act="addservice">บันทึกการเช็คระยะ</button></div>';
  var ago = -daysLeft(last.date);
  h += '<div class="kv"><span>เช็คระยะล่าสุด</span><span>' + thDate(last.date) + '<br><span class="mute">' +
    (ago > 0 ? 'ผ่านมา ' + ago + ' วัน' : 'วันนี้') + (last.odo !== '' ? ' · ไมล์ ' + Number(last.odo).toLocaleString('th-TH') : '') + '</span></span></div>';
  var n = daysLeft(last.nextDate);
  h += '<div class="kv"><span>เช็คครั้งต่อไป (วันที่)</span><span>' + (last.nextDate ? thDate(last.nextDate) + '<br><span class="' + cdClass(n) + '">' + cdText(n) + '</span>' : '-') + '</span></div>';
  var left = last.nextOdo !== '' && car.lastOdo !== '' ? Number(last.nextOdo) - Number(car.lastOdo) : null;
  h += '<div class="kv"><span>เช็คครั้งต่อไป (ไมล์)</span><span>' + (last.nextOdo !== '' ? Number(last.nextOdo).toLocaleString('th-TH') + ' กม.' : '-') +
    (left === null ? '' : '<br><span class="' + (left <= 0 ? 'cd-bad' : left <= 1000 ? 'cd-warn' : 'cd-ok') + '">' +
      (left <= 0 ? 'เกินกำหนด ' + Number(-left).toLocaleString('th-TH') + ' กม.' : 'เหลืออีก ' + left.toLocaleString('th-TH') + ' กม.') + '</span>') + '</span></div>';
  return h + '<button class="line" data-act="addservice">บันทึกการเช็คระยะครั้งใหม่</button></div>';
}

function viewMaint(car) {
  var d = histOf(car.plate);
  var h = serviceCard(car, d);
  h += '<details class="card"' + (S.mopen ? ' open' : '') + '><summary>+ เพิ่มประวัติซ่อมบำรุง</summary><form id="fMaint">' +
    '<label>วันที่</label><input name="date" type="date" value="' + today() + '" required>' +
    '<label>ประเภท</label><select name="type">' + S.mtypes.map(function (t) { return '<option' + (t === S.mdef ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
    '<label>รายละเอียด</label><textarea name="detail" rows="2" maxlength="300" required></textarea>' +
    '<label>เลขไมล์ขณะซ่อม (ถ้ามี)</label><input name="odo" type="number" inputmode="numeric" min="0" value="' + esc(car.lastOdo) + '">' +
    '<label>อู่/ร้าน</label><input name="shop" maxlength="100">' +
    '<label>ค่าใช้จ่าย (บาท)</label><input name="cost" type="number" inputmode="decimal" min="0" step="0.01">' +
    '<label>ครบกำหนดครั้งต่อไป วันที่ (ถ้ามี)</label><input name="nextDate" type="date">' +
    '<label>ครบกำหนดครั้งต่อไป ไมล์ (ถ้ามี)</label><input name="nextOdo" type="number" inputmode="numeric" min="0">' +
    '<div class="mute" style="font-size:13px;margin-top:6px">ถ้าเลือก "ตรวจเช็คตามระยะ" ระบบเติมครั้งต่อไปให้ที่ +10,000 กม. / +6 เดือน แก้ได้</div>' +
    nameField('ผู้บันทึก') + imageField('แนบรูปใบเสร็จ/หน้างาน') + '<button type="submit">บันทึก</button></form></details>';
  if (!d) return h + '<div class="card center mute">กำลังโหลดประวัติ...</div>';
  h += '<div class="card"><h2>ประวัติซ่อมบำรุง (' + d.maint.length + ' รายการ)</h2>' + (d.maint.length ? d.maint.map(function (m) {
    return '<div class="row"><b>' + esc(m.type) + '</b> · ' + thDate(m.date) + (m.cost !== '' ? ' · ' + baht(m.cost) + ' บาท' : '') +
      '<br>' + esc(m.detail) + '<br><span class="mute">' + (m.shop ? esc(m.shop) + ' · ' : '') + (m.odo !== '' ? 'ไมล์ ' + esc(m.odo) + ' · ' : '') + 'บันทึกโดย ' + esc(m.name) + '</span>' +
      (m.nextDate || m.nextOdo !== '' ? '<br><span class="' + expClass(m.nextDate) + '">ครั้งต่อไป: ' + (m.nextDate ? thDate(m.nextDate) : '') + (m.nextOdo !== '' ? ' / ไมล์ ' + esc(m.nextOdo) : '') + '</span>' : '') +
      links(m.images) + '</div>';
  }).join('') : '<div class="mute">ยังไม่มีประวัติซ่อมบำรุง</div>') + '</div>';
  return h;
}

function viewInfo(car) {
  function kv(k, v) { return '<div class="kv"><span>' + k + '</span><span>' + (v === '' || v == null ? '-' : esc(v)) + '</span></div>'; }
  function exp(k, d) { return '<div class="kv"><span>' + k + '</span><span class="' + expClass(d) + '">' + thDate(d) + '</span></div>'; }
  return '<button class="line regbtn" data-act="reg">ดูสำเนาทะเบียนรถ</button>' +
    '<div class="card info-main"><h2>ข้อมูลรถ</h2>' + kv('ทะเบียน', car.plate) + kv('จังหวัด', car.province) + kv('ยี่ห้อ/รุ่น', car.model) + kv('ปี', car.year) +
    kv('สี', car.color) + kv('เชื้อเพลิง', car.fuel) + kv('เลขตัวถัง', car.vin) + kv('เลขเครื่อง', car.engineNo) +
    kv('เลขไมล์ล่าสุด', car.lastOdo === '' ? '' : Number(car.lastOdo).toLocaleString('th-TH') + ' กม.') + '</div>' +
    '<div class="card"><h2>วันหมดอายุ</h2>' + exp('พ.ร.บ.', car.actExp) + exp('ภาษีรถ', car.taxExp) + exp('ประกันภัย', car.insExp) + kv('บริษัทประกันภัย', car.insurer) + '</div>' +
    '';
}

/* ---------- สำเนาทะเบียน ---------- */
async function showReg() {
  var body = $('#modalBody'); $('#modal').style.display = 'block';
  body.innerHTML = '<div class="center mute">กำลังโหลดสำเนาทะเบียน...</div>';
  try {
    var d = await call('getRegDoc', { plate: S.plate });
    body.innerHTML = '<h2>สำเนาทะเบียน ' + esc(S.plate) + '</h2>' + (d.dataUrl
      ? '<img alt="สำเนาทะเบียนรถ" src="' + d.dataUrl + '">'
      : '<a href="' + esc(d.url) + '" target="_blank" rel="noopener">เปิดไฟล์ PDF สำเนาทะเบียน</a><div class="mute">ต้องมีสิทธิ์เข้าถึงโฟลเดอร์ใน Drive</div>');
  } catch (e) { body.innerHTML = '<h2>ดูสำเนาทะเบียนไม่ได้</h2>' + esc(e.message); }
}

/* ---------- ค่าใช้จ่าย ---------- */
function carOptions() {
  return S.cars.map(function (c) { return '<option value="' + esc(c.plate) + '"' + (c.plate === S.plate ? ' selected' : '') + '>' + esc(c.plate) + ' ' + esc(c.model) + '</option>'; }).join('');
}
function viewExpense() {
  if (!S.cars.length) return '<div class="card">ยังไม่มีรถในระบบ ให้แอดมินเพิ่มในแท็บ "จัดการ"</div>';
  return '<form class="card" id="fExpense"><h2>บันทึกค่าใช้จ่าย</h2><div class="mute" style="font-size:14px">ค่าซ่อมบำรุงให้บันทึกที่หน้ารถ เมนู "ซ่อมบำรุง"</div>' +
    (S.locked ? (function () { var c = curCar(); return '<input type="hidden" name="plate" value="' + esc(c.plate) + '"><label>ทะเบียนรถ</label><div class="lockcar">' + plateHtml(c, 'sm') + '<span>' + esc(c.model || '') + '</span></div>'; })()
      : '<label>ทะเบียนรถ</label><select name="plate">' + carOptions() + '</select>') +
    '<label>วันที่</label><input name="date" type="date" value="' + today() + '" required>' +
    '<label>ประเภท</label><select name="type">' + S.types.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select>' +
    '<label>จำนวนเงิน (บาท)</label><input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required>' +
    '<label>หมายเหตุ</label><input name="note" maxlength="300">' +
    nameField('ผู้บันทึก') + imageField('แนบรูปใบเสร็จ') + '<button type="submit">บันทึก</button></form>';
}

/* ---------- จัดการรถ (ผู้จัดการ/แอดมิน) ---------- */
/* ===================== หน้าแอดมิน (คอมพิวเตอร์) ===================== */
var ADMIN_PAGES = [
  ['overview', 'ภาพรวม', 'home', 'สถานะรถวันนี้ และสิ่งที่ต้องจัดการ'],
  ['cars', 'จัดการรถ', 'car', 'เพิ่ม แก้ไข หรือนำรถออกจากระบบ แก้ทะเบียนแล้ว QR เดิมยังใช้ได้'],
  ['qr', 'QR ติดรถ', 'qr', 'QR ประจำรถแต่ละคัน รถใหม่จะมี QR ขึ้นที่นี่อัตโนมัติ'],
  ['open', 'ค้างเบิก', 'clock', 'รถที่ยังไม่คืน และยกเลิกรายการที่เบิกผิด'],
  ['report', 'รายงานรายเดือน', 'chart', 'ระยะทาง ค่าใช้จ่าย และต้นทุนต่อ กม. แยกต่อคันและต่อคนขับ'],
  ['drivers', 'คนขับ', 'shield', 'เบอร์โทร และวันหมดอายุใบขับขี่'],
  ['settings', 'ตั้งค่า', 'sliders', 'โลโก้และชื่อบริษัทที่แสดงในแอปและบนสติกเกอร์ QR']
];
function licDays(d) { return daysLeft(d.licenseExp); }
function adminCount(k) {
  if (k === 'open') return S.open.length;
  if (k === 'overview') return S.alerts.filter(function (a) { return a.expired; }).length + S.open.filter(function (t) { return overdue(t.ts); }).length;
  if (k === 'drivers' && S.dlist) return S.dlist.filter(function (d) { var n = licDays(d); return d.active !== 'N' && n !== null && n <= 30; }).length;
  return 0;
}
function ensureDlist() {
  if (S.dlist || S.dlist === false) return;
  S.dlist = false;
  // วาดหน้าใหม่เฉพาะหน้าที่ใช้รายชื่อนี้ ไม่ให้ฟอร์มที่กำลังกรอกอยู่หน้าอื่นถูกล้าง
  call('listDrivers', { pin: S.pin }).then(function (d) { S.dlist = Array.isArray(d) ? d : []; if (ADMIN_MODE && (S.asub === 'overview' || S.asub === 'drivers')) render(); }).catch(function (e) { S.dlist = null; toast(e.message, 'err'); });
}
function kpi(label, value, sub, cls, icon) { return '<div class="kpi ' + (cls || '') + (icon ? ' hasic' : '') + '">' + (icon ? '<div class="kic">' + ic(icon, 22) + '</div>' : '') + '<div class="kb"><div class="l">' + label + '</div><div class="v">' + value + '</div><div class="s">' + (sub || '&nbsp;') + '</div></div></div>'; }
function dt(head, rows, numCols, foot, rowCls) {
  numCols = numCols || [];
  var cell = function (tag, v, i) { return '<' + tag + (numCols.indexOf(i) >= 0 ? ' class="num"' : '') + '>' + v + '</' + tag + '>'; };
  return '<div class="tblscroll"><table class="dt"><thead><tr>' + head.map(function (v, i) { return cell('th', v, i); }).join('') + '</tr></thead><tbody>' +
    rows.map(function (r, j) { return '<tr' + (rowCls && rowCls[j] ? ' class="' + rowCls[j] + '"' : '') + '>' + r.map(function (v, i) { return cell('td', v, i); }).join('') + '</tr>'; }).join('') + '</tbody>' +
    (foot ? '<tfoot><tr>' + foot.map(function (v, i) { return cell('td', v, i); }).join('') + '</tr></tfoot>' : '') + '</table></div>';
}
function miniPlate(c) { return plateHtml(c, 'sm'); }
function expChip(d) {
  var n = daysLeft(d);
  var cls = n === null ? 'na' : n < 0 ? '' : n <= 30 ? 'warn' : 'free';
  var txt = n === null ? 'ไม่ระบุ' : n < 0 ? 'เกิน ' + (-n) + ' วัน' : 'เหลือ ' + n + ' วัน';
  return '<span class="chip ' + cls + '">' + txt + '</span>' + (d ? '<div class="sub">' + thDate(d) + '</div>' : '');
}

function viewAdmin() {
  if (S.pinRequired && !S.pin) return '<div class="adm-gate">' + (S.logo ? '<div class="gate-logo">' + logoImg() + '</div>' : '') + '<form class="card" id="fPin"><h2>โหมดแอดมิน</h2><div class="mute" style="font-size:14px">ใส่ PIN แอดมินเพื่อแก้ข้อมูลรถ อัปโหลดสำเนาทะเบียน และพิมพ์ QR (การเบิก/คืนรถทั่วไปไม่ต้องใช้ PIN)</div>' +
      '<label>PIN แอดมิน</label><input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" required>' +
      '<button type="submit">เข้าโหมดแอดมิน</button></form>' + '</div>';
  if (!ADMIN_PAGES.some(function (p) { return p[0] === S.asub; })) S.asub = 'overview';
  var page = ADMIN_PAGES.filter(function (p) { return p[0] === S.asub; })[0];
  var side = '<aside class="side noprint"><div class="side-brand">' + (S.logo ? '<div class="lg">' + logoImg() + '</div>' : '') + '<div><b>' + esc(S.company) + '</b><small>ระบบรถส่วนกลาง</small></div></div><div class="sec">เมนูแอดมิน</div>' + ADMIN_PAGES.map(function (p) {
    var n = adminCount(p[0]);
    return '<button data-act="asub" data-s="' + p[0] + '" class="' + (p[0] === S.asub ? 'on' : '') + '">' + ic(p[2], 20) + '<span>' + p[1] + '</span>' + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>';
  }).join('') + '<div class="side-foot">' +
    (S.appUrl ? '<a class="side-link" href="' + esc(S.appUrl) + '" target="_blank" rel="noopener">' + ic('car', 18) + 'เปิดหน้าคนขับ</a>' : '') +
    (S.pinRequired ? '<button data-act="logout">' + ic('sliders', 18) + 'ออกจากโหมดแอดมิน</button>' : '') + '</div></aside>';
  var acts = '';
  if (S.asub === 'cars') acts = (S.cars.length && S.cars.length <= 8 ? '<button class="ghost" data-act="carcsv">ส่งออก CSV</button>' : '') + '<button data-act="newcar">+ เพิ่มรถคันใหม่</button>';
  if (S.asub === 'drivers') acts = '<button data-act="newdrv">+ เพิ่มคนขับ</button>';
  if (S.asub === 'qr' && S.cars.length) acts = '<button class="ghost" data-act="print">พิมพ์ QR ทั้งหมด</button>';
  if (S.asub === 'report') acts = '<input type="month" id="rMonth" aria-label="เดือน" value="' + esc(S.rmonth || today().slice(0, 7)) + '"><button data-act="runreport">ดูรายงาน</button>';
  var body = { cars: admCars, qr: admQr, open: admOpen, report: admReport, drivers: admDrivers, settings: admSettings }[S.asub] || admOverview;
  return '<div class="adm">' + side + '<section class="adm-main">' +
    '<div class="desk-note alert">หน้าแอดมินออกแบบสำหรับคอมพิวเตอร์ เปิดบนจอใหญ่จะใช้งานง่ายกว่า</div>' +
    (S.pinRequired ? '' : '<div class="pinwarn noprint">' + ic('shield', 16) + '<span><b>ยังไม่เปิดรหัสแอดมิน</b> ใครมีลิงก์หน้านี้ก็เข้าได้ ควรเปิดก่อนแจก QR (ดู README)</span></div>') +
    '<div class="ph"><div><h1>' + page[1] + '</h1><p>' + page[3] + '</p></div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>' +
    body() + '</section></div>';
}

function tripChart() {
  var days = [], i, map = {};
  for (i = 13; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); days.push([k, d]); map[k] = 0; }
  S.usage.forEach(function (u) { if (u.status === 'cancelled') return; var k = String(u.ts).slice(0, 10); if (k in map) map[k]++; });
  var max = Math.max.apply(null, days.map(function (x) { return map[x[0]]; }).concat([1])), total = 0;
  var bars = days.map(function (x) {
    var n = map[x[0]]; total += n;
    return '<div class="bc' + (x[0] === today() ? ' now' : '') + '" title="' + thDate(x[0]) + ': ' + n + ' เที่ยว"><b>' + (n || '') + '</b><i style="height:' + Math.max(n / max * 100, n ? 8 : 2) + '%"></i><span>' + x[1].getDate() + '</span></div>';
  }).join('');
  return '<div class="card chart"><div class="ch-h"><h2>การใช้รถ 14 วันล่าสุด</h2><span class="chip free">' + total + ' เที่ยว</span></div><div class="bars">' + bars + '</div></div>';
}
function admOverview() {
  ensureDlist();
  var od = S.open.filter(function (t) { return overdue(t.ts); });
  var expd = S.alerts.filter(function (a) { return a.expired; }).length;
  var lic = S.dlist ? S.dlist.filter(function (d) { var n = licDays(d); return d.active !== 'N' && n !== null && n < 0; }) : null;
  var free = S.cars.length - S.open.length, nTodo = S.alerts.length + od.length + (lic ? lic.length : 0);
  var hr = new Date().getHours(), greet = hr < 12 ? 'สวัสดีตอนเช้า' : hr < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  var h = '<div class="hero"><div class="hero-t"><small>' + greet + ' ' + esc(S.company) + '</small><b>' +
    (nTodo ? 'วันนี้มี ' + nTodo + ' เรื่องที่ต้องดูแล' : 'ทุกอย่างเรียบร้อยดี') + '</b><span>รถว่างพร้อมใช้ ' + free + ' จาก ' + S.cars.length + ' คัน' + (S.open.length ? ' · กำลังถูกเบิก ' + S.open.length + ' คัน' : '') + '</span></div>' +
    '<div class="hero-a"><button data-act="newcar">' + ic('car', 17) + 'เพิ่มรถคันใหม่</button><button class="glass" data-act="asub" data-s="qr">' + ic('qr', 17) + 'พิมพ์ QR</button><button class="glass" data-act="asub" data-s="report">' + ic('chart', 17) + 'รายงานเดือนนี้</button></div></div>' +
    '<div class="kpis">' +
    kpi('รถที่ใช้งาน', S.cars.length, 'คัน', 'ok', 'car') +
    kpi('ถูกเบิกอยู่', S.open.length, od.length ? 'ค้างเกิน 24 ชม. ' + od.length + ' คัน' : 'ไม่มีรถค้างเกิน 24 ชม.', od.length ? 'bad' : 'info', 'clock') +
    kpi('ใกล้ครบกำหนด 30 วัน', S.alerts.length, expd ? 'เลยกำหนดแล้ว ' + expd + ' รายการ' : 'พ.ร.บ. ภาษี ประกัน เช็คระยะ', expd ? 'bad' : S.alerts.length ? 'warn' : 'ok', 'shield') +
    kpi('ใบขับขี่หมดอายุ', lic === null ? '…' : lic.length, 'คน', lic && lic.length ? 'bad' : 'ok', 'info') + '</div>';
  var todo = [];
  od.forEach(function (t) { todo.push(['bad', esc(t.plate) + ' ยังไม่คืนรถ · ' + esc(t.name) + ' · ' + overdue(t.ts), 'open']); });
  S.alerts.forEach(function (a) { todo.push([a.expired ? 'bad' : '', esc(a.plate) + ' · ' + esc(a.what) + (a.expired ? ' เลยกำหนด ' : ' ครบกำหนด ') + thDate(a.date), 'cars']); });
  (lic || []).forEach(function (d) { todo.push(['bad', 'ใบขับขี่ของ ' + esc(d.name) + ' หมดอายุ ' + thDate(d.licenseExp), 'drivers']); });
  h += '<div class="split2"><div class="card"><h2>ต้องจัดการ (' + todo.length + ')</h2>' + (todo.length ? todo.map(function (x) {
    var icn = { open: 'clock', cars: 'shield', drivers: 'info' }[x[2]] || 'info';
    return '<button class="todo ' + (x[0] || 'warn') + '" data-act="asub" data-s="' + x[2] + '"><i class="tdot">' + ic(icn, 16) + '</i><span class="tt">' + x[1] + '</span><span class="tgo" aria-hidden="true">›</span></button>';
  }).join('') : '<div class="mute">ไม่มีรายการที่ต้องจัดการ</div>') + '</div>';
  h += '<div class="stack">' + tripChart() + '<div class="card flush"><h2>รถที่ถูกเบิกอยู่ (' + S.open.length + ')</h2>' + (S.open.length ? dt(['ทะเบียน', 'ผู้เบิก', 'เวลาเบิก', 'ไปที่ไหน'],
    S.open.map(function (t) { return ['<b>' + esc(t.plate) + '</b>', esc(t.name) + (overdue(t.ts) ? ' <span class="chip">' + overdue(t.ts) + '</span>' : ''), thTime(t.ts), esc(t.purpose)]; }))
    : '<div class="mute" style="padding:0 12px 10px">ไม่มีรถถูกเบิก</div>') + '</div></div></div>';
  h += '<div class="card flush"><h2>การใช้รถล่าสุด</h2>' + (S.usage.length ? dt(['เวลาเบิก', 'ทะเบียน', 'ผู้ใช้', 'ไปที่ไหน', 'ระยะทาง'],
    S.usage.map(function (u) {
      var k = u.status === 'open' ? '<span class="chip">ยังไม่คืน</span>' : u.status === 'cancelled' ? '<span class="chip na">ยกเลิก</span>' : km(u.odoEnd - u.odoStart) + ' กม.';
      return [thTime(u.ts), '<b>' + esc(u.plate) + '</b>', esc(u.name), esc(u.purpose), k];
    }), [4]) : '<div class="mute" style="padding:0 12px 10px">ยังไม่มีรายการ</div>') + '</div>';
  return h;
}

function svcInfo(car) {
  var sv = lastService(car.plate); if (!sv) return null;
  var nd = daysLeft(sv.nextDate), left = sv.nextOdo !== '' && car.lastOdo !== '' ? Number(sv.nextOdo) - Number(car.lastOdo) : null;
  var interval = sv.nextOdo !== '' && sv.odo !== '' ? Number(sv.nextOdo) - Number(sv.odo) : 0;
  var cls = (left !== null && left < 0) || (nd !== null && nd < 0) ? 'bad' : ((left !== null && left <= Math.max(500, interval * 0.1)) || (nd !== null && nd <= 30)) ? 'warn' : 'free';
  return { left: left, nd: nd, cls: cls, date: sv.nextDate };
}
// สถานะรวมของรถ: ok = ปกติ · warn = มีรายการใกล้ครบกำหนด (≤30 วัน หรือใกล้เช็คระยะ) · bad = เกินกำหนด
function carHealth(c) {
  var worst = 'ok';
  [c.actExp, c.taxExp, c.insExp].forEach(function (d) { var n = daysLeft(d); if (n !== null && n < 0) worst = 'bad'; else if (n !== null && n <= 30 && worst !== 'bad') worst = 'warn'; });
  var si = svcInfo(c);
  if (si && si.cls === 'bad') worst = 'bad'; else if (si && si.cls === 'warn' && worst === 'ok') worst = 'warn';
  return worst;
}
function carFlags(c) {
  var due = [c.actExp, c.taxExp, c.insExp].some(function (d) { var n = daysLeft(d); return n !== null && n <= 30; });
  var si = svcInfo(c);
  return { busy: !!openTripOf(c.plate), due: due, svc: !!(si && si.cls !== 'free'), nodoc: !c.regDocId };
}
var CAR_FILTERS = [['all', 'ทั้งหมด', ''], ['free', 'ว่าง พร้อมใช้', 'ok'], ['busy', 'ถูกเบิกอยู่', 'info'], ['due', 'ภาษี / พ.ร.บ. / ประกัน ใกล้หมด', 'warn'], ['svc', 'ใกล้เช็คระยะ', 'warn'], ['nodoc', 'ยังไม่มีสำเนาทะเบียน', 'bad']];
function carRows() {
  var f = S.cf || (S.cf = { st: 'all', vt: '', q: '', sort: 'plate', dir: 1 });
  var q = f.q.trim().toLowerCase();
  var list = S.cars.filter(function (c) {
    var fl = carFlags(c);
    if (f.st === 'free' && fl.busy) return false;
    if (f.st !== 'all' && f.st !== 'free' && !fl[f.st]) return false;
    if (f.vt && (c.vtype || 'ไม่ระบุ') !== f.vt) return false;
    if (q && [c.plate, c.model, c.vin, c.province, c.vtype].join(' ').toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var key = {
    plate: function (c) { return c.plate; }, model: function (c) { return c.model; }, vtype: function (c) { return c.vtype || ''; },
    odo: function (c) { return c.lastOdo === '' ? -1 : Number(c.lastOdo); },
    act: function (c) { return c.actExp || '9999'; }, tax: function (c) { return c.taxExp || '9999'; }, ins: function (c) { return c.insExp || '9999'; },
    svc: function (c) { var si = svcInfo(c); return si && si.left !== null ? si.left : 1e9; }
  }[f.sort] || function (c) { return c.plate; };
  return list.sort(function (a, b) { var x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * f.dir; });
}
function carCards() {
  var tile = function (label, d) {
    var n = daysLeft(d), st = n === null ? 'na' : n < 0 ? 'bad' : n <= 30 ? 'warn' : 'ok';
    var big = n === null ? 'ไม่ระบุ' : n < 0 ? 'เกิน ' + (-n) + ' วัน' : n + ' วัน';
    return '<div class="due-tile ' + st + '"><span class="dl">' + label + '</span><b>' + big + '</b><small>' + (d ? thDate(d) : '-') + '</small></div>';
  };
  return '<div class="ccards">' + S.cars.map(function (c) {
    var t = openTripOf(c.plate), si = svcInfo(c), worst = carHealth(c);
    var svc = !si ? '<span class="chip na">ยังไม่มีข้อมูล</span>' :
      '<span class="chip ' + si.cls + '">' + (si.left !== null ? (si.left < 0 ? 'เกิน ' + km(-si.left) : 'อีก ' + km(si.left)) + ' กม.' : '') + (si.left !== null && si.nd !== null ? ' · ' : '') + (si.nd !== null ? (si.nd < 0 ? 'เกิน ' + (-si.nd) : 'อีก ' + si.nd) + ' วัน' : '') + '</span>';
    return '<div class="ccard car st-' + worst + (c.id === S.edit && S.carForm ? ' sel' : '') + '">' +
      '<div class="cc-top">' + plateHtml(c) + (t ? '<span class="spill busy"><i></i>ถูกเบิก · ' + esc(t.name) + '</span>' : '<span class="spill free"><i></i>ว่าง</span>') + '</div>' +
      '<div class="cc-name"><span class="vic">' + vIcon(c.vtype) + '</span><div class="cc-nm"><b>' + esc(c.model || 'ไม่ระบุรุ่น') + '</b><div class="sub">' + esc([c.vtype, c.year, c.color].filter(Boolean).join(' · ')) + '</div></div>' +
      '<button type="button" class="tlbtn" data-act="timeline" data-id="' + esc(c.id) + '">' + ic('clock', 16) + 'ไทม์ไลน์</button></div>' +
      '<div class="cc-stats"><div class="cc-stat"><span>เลขไมล์ล่าสุด</span><b>' + (c.lastOdo === '' ? '-' : km(c.lastOdo) + ' <small>กม.</small>') + '</b></div>' +
      '<div class="cc-stat"><span>' + ic('wrench', 14) + ' เช็คระยะถัดไป</span>' + svc + '</div></div>' +
      '<div class="cc-due">' + tile('พ.ร.บ.', c.actExp) + tile('ภาษี', c.taxExp) + tile('ประกัน', c.insExp) + '</div>' +
      (c.insurer ? '<div class="cc-ins">' + ic('shield', 14) + esc(c.insurer) + '</div>' : '') +
      (c.regDocId ? '' : '<div class="nodoc-note">' + ic('info', 14) + 'ยังไม่มีสำเนาทะเบียน</div>') +
      '<div class="cc-act"><button class="small" data-act="editcar" data-id="' + esc(c.id) + '">' + ic('edit', 15) + 'แก้ไขข้อมูล</button><button class="small ghost" data-act="asub" data-s="qr">' + ic('qr', 15) + 'QR</button><button class="small line" data-act="removecar" data-id="' + esc(c.id) + '">นำออก</button></div></div>';
  }).join('') + '</div>';
}
function admCars() {
  if (!S.cars.length) return withDrawer(emptyState('car', 'ยังไม่มีรถในระบบ', 'กด "+ เพิ่มรถคันใหม่" ด้านบนเพื่อเริ่ม หรือถ่ายรูปสำเนาทะเบียนให้ระบบกรอกข้อมูลให้ได้'));
  if (S.cars.length <= 8) {
    var left = '<div>' + carCards();
    if (S.removed.length) left += '<div class="card flush" style="margin-top:18px"><h2>รถที่นำออกแล้ว</h2>' + dt(['ทะเบียน', 'ยี่ห้อ/รุ่น', ''], S.removed.map(function (c) {
      return ['<b>' + esc(c.plate) + '</b>', esc(c.model), '<div class="acts"><button class="small ghost" data-act="restorecar" data-id="' + esc(c.id) + '">นำกลับมาใช้</button></div>'];
    })) + '</div>';
    left += '</div>';
    return withDrawer(left);
  }
  var f = S.cf || (S.cf = { st: 'all', vt: '', q: '', sort: 'plate', dir: 1 });
  var cnt = { all: S.cars.length, free: 0, busy: 0, due: 0, svc: 0, nodoc: 0 }, vts = {};
  S.cars.forEach(function (c) { var fl = carFlags(c); if (!fl.busy) cnt.free++; ['busy', 'due', 'svc', 'nodoc'].forEach(function (k) { if (fl[k]) cnt[k]++; }); var v = c.vtype || 'ไม่ระบุ'; vts[v] = (vts[v] || 0) + 1; });
  var chips = '<div class="fchips">' + CAR_FILTERS.map(function (x) {
    return '<button class="fchip ' + x[2] + (f.st === x[0] ? ' on' : '') + '" data-act="cfst" data-s="' + x[0] + '">' + x[1] + ' <b>' + cnt[x[0]] + '</b></button>';
  }).join('') + '</div><div class="fchips">' + '<button class="fchip' + (!f.vt ? ' on' : '') + '" data-act="cfvt" data-s="">ทุกประเภท <b>' + S.cars.length + '</b></button>' +
    Object.keys(vts).map(function (v) { return '<button class="fchip' + (f.vt === v ? ' on' : '') + '" data-act="cfvt" data-s="' + esc(v) + '">' + (v === 'ไม่ระบุ' ? '' : vIcon(v) + ' ') + esc(v) + ' <b>' + vts[v] + '</b></button>'; }).join('') + '</div>';
  var rows = carRows();
  var th = function (k, label) { return '<button class="sorth' + (f.sort === k ? ' on' : '') + '" data-act="cfsort" data-s="' + k + '">' + label + (f.sort === k ? (f.dir > 0 ? ' ▲' : ' ▼') : '') + '</button>'; };
  var trs = rows.map(function (c) {
    var t = openTripOf(c.plate), si = svcInfo(c);
    var svc = !si ? '<span class="chip na">ไม่มีข้อมูล</span>' :
      (si.left !== null ? '<span class="chip ' + si.cls + '">' + (si.left < 0 ? 'เกิน ' + km(-si.left) : 'อีก ' + km(si.left)) + ' กม.</span>' : '') +
      (si.nd !== null ? '<div class="sub">' + thDate(si.date) + ' · ' + (si.nd < 0 ? 'เกิน ' + (-si.nd) : 'อีก ' + si.nd) + ' วัน</div>' : '');
    return [miniPlate(c) + (c.regDocId ? '' : '<div class="sub nodoc">ยังไม่มีสำเนาทะเบียน</div>'),
      '<div class="mcell"><span class="vic">' + vIcon(c.vtype) + '</span><div><b>' + esc(c.model) + '</b><div class="sub">' + esc([c.vtype, c.year, c.color].filter(Boolean).join(' · ')) + '</div></div></div>',
      t ? '<span class="chip">ถูกเบิก · ' + esc(t.name) + '</span>' : '<span class="chip free">ว่าง</span>',
      c.lastOdo === '' ? '<span class="mute">-</span>' : km(c.lastOdo),
      expChip(c.actExp), expChip(c.taxExp), expChip(c.insExp) + (c.insurer ? '<div class="sub">' + esc(c.insurer) + '</div>' : ''), svc,
      '<div class="acts"><button class="small ghost" data-act="timeline" data-id="' + esc(c.id) + '">ไทม์ไลน์</button><button class="small ghost" data-act="editcar" data-id="' + esc(c.id) + '">แก้ไข</button><button class="small line" data-act="removecar" data-id="' + esc(c.id) + '">นำออก</button></div>'];
  });
  var tools = '<div class="ftools"><label class="fsearch">' + ic('search', 16) + '<input id="cfq" type="search" placeholder="ค้นหา ทะเบียน / รุ่น / เลขตัวถัง" value="' + esc(f.q) + '"></label>' +
    '<span class="mute fcount">พบ ' + rows.length + ' จาก ' + S.cars.length + ' คัน · คลิกหัวตารางเพื่อเรียง</span><button class="small ghost" data-act="carcsv">ส่งออก CSV</button></div>';
  var head = [th('plate', 'ทะเบียน'), th('model', 'ยี่ห้อ/รุ่น'), 'สถานะ', th('odo', 'เลขไมล์'), th('act', 'พ.ร.บ.'), th('tax', 'ภาษี'), th('ins', 'ประกัน'), th('svc', 'เช็คระยะถัดไป'), ''];
  var left = '<div><div class="card carsbox">' + chips + tools +
    (S.cars.length ? (rows.length ? dt(head, trs, [3], null, rows.map(function (c) { return c.id === S.edit ? 'sel' : ''; })) : '<div class="mute" style="padding:14px 4px">ไม่พบรถตามตัวกรอง</div>')
      : '<div class="mute" style="padding:12px 4px">ยังไม่มีรถ กด "+ เพิ่มรถคันใหม่" ด้านบนเพื่อเริ่ม</div>') + '</div>';
  if (S.removed.length) {
    left += '<div class="card flush" style="margin-top:18px"><h2>รถที่นำออกแล้ว</h2>' + dt(['ทะเบียน', 'ยี่ห้อ/รุ่น', ''], S.removed.map(function (c) {
      return ['<b>' + esc(c.plate) + '</b>', esc(c.model), '<div class="acts"><button class="small ghost" data-act="restorecar" data-id="' + esc(c.id) + '">นำกลับมาใช้</button></div>'];
    })) + '<div class="mute" style="font-size:13px;padding:8px 12px">ประวัติของรถที่นำออกยังอยู่ครบ QR เดิมจะกลับมาใช้ได้เมื่อนำกลับมาใช้</div></div>';
  }
  left += '</div>';
  return withDrawer(left);
}
function withDrawer(left, inner) {
  if (inner === undefined) inner = S.carForm ? carForm() : S.tl ? timelineView() : '';
  if (!inner) return left;
  return '<div class="split drawer-on"><div class="drawer-bg" data-act="closecar"></div>' + left + '<div class="sticky drawer">' + inner + '</div></div>';
}
function tlEvents(c) {
  var ev = [];
  S.allUsage.forEach(function (u) {
    if (u.plate !== c.plate || u.status === 'cancelled') return;
    var done = u.status !== 'open' && u.odoEnd !== '';
    ev.push({ k: 'use', at: String(u.ts), title: 'ถูกเบิกโดย ' + esc(u.name), sub: esc(u.purpose || '') + (u.dest ? ' · ' + esc(u.dest) : ''),
      meta: done ? 'คืน ' + thTime(u.returnTs) + ' · ' + km(u.odoEnd - u.odoStart) + ' กม.' + (u.returnName && u.returnName !== u.name ? ' · คืนโดย ' + esc(u.returnName) : '') : '<span class="chip">ยังไม่คืนรถ</span>' });
  });
  S.maint.forEach(function (m) {
    if (m.plate !== c.plate) return;
    ev.push({ k: 'mt', at: String(m.date), title: esc(m.type || 'ซ่อมบำรุง'), sub: esc(m.detail || ''), meta: [m.shop ? esc(m.shop) : '', m.odo !== '' && m.odo != null ? 'ไมล์ ' + km(m.odo) : '', m.cost !== '' && m.cost != null ? baht(m.cost) + ' บาท' : ''].filter(Boolean).join(' · ') });
  });
  (S.allExp || []).forEach(function (x) {
    if (x.plate !== c.plate) return;
    ev.push({ k: 'ex', at: String(x.date), title: esc(x.type || 'ค่าใช้จ่าย') + ' · ' + baht(x.amount) + ' บาท', sub: esc(x.note || ''), meta: x.name ? 'บันทึกโดย ' + esc(x.name) : '' });
  });
  [['actExp', 'พ.ร.บ.'], ['taxExp', 'ภาษีรถ'], ['insExp', 'ประกันภัย']].forEach(function (z) {
    var d = c[z[0]]; if (!d) return; var n = daysLeft(d);
    ev.push({ k: 'due', at: String(d), title: z[1] + (n !== null && n < 0 ? ' เกินกำหนด' : ' ครบกำหนด'), sub: '', meta: n === null ? '' : n < 0 ? '<span class="chip">เกิน ' + (-n) + ' วัน</span>' : '<span class="chip ' + (n <= 30 ? 'warn' : 'free') + '">อีก ' + n + ' วัน</span>' });
  });
  return ev.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
}
function timelineView() {
  var c = S.cars.filter(function (x) { return x.id === S.tl; })[0]; if (!c) return '';
  var all = tlEvents(c), f = S.tlf || 'all';
  var cnt = { all: all.length, use: 0, mt: 0, ex: 0, due: 0 }; all.forEach(function (e) { cnt[e.k]++; });
  var list = all.filter(function (e) { return f === 'all' || e.k === f; });
  var tabs = [['all', 'ทั้งหมด'], ['use', 'การใช้รถ'], ['mt', 'ซ่อมบำรุง'], ['ex', 'ค่าใช้จ่าย'], ['due', 'กำหนดครบ']];
  var icons = { use: 'car', mt: 'wrench', ex: 'receipt', due: 'shield' };
  var lastM = '', body = list.map(function (e) {
    var m = String(e.at).slice(0, 7), head = '';
    if (m !== lastM) { lastM = m; head = '<div class="tl-m">' + (/^\d{4}-\d{2}$/.test(m) ? monthTh(m) : '') + '</div>'; }
    return head + '<div class="tl-i ' + e.k + '"><i class="tl-dot">' + ic(icons[e.k], 15) + '</i><div class="tl-b"><div class="tl-t"><b>' + e.title + '</b><span class="tl-d">' + (e.k === 'use' ? thTime(e.at) : thDate(String(e.at).slice(0, 10))) + '</span></div>' +
      (e.sub ? '<div class="tl-s">' + e.sub + '</div>' : '') + (e.meta ? '<div class="tl-x">' + e.meta + '</div>' : '') + '</div></div>';
  }).join('');
  return '<div class="card noprint tlcard"><div class="dhead"><div><h2>ไทม์ไลน์รถ</h2><div class="tl-plate">' + plateHtml(c, 'sm') + '<span>' + esc(c.model || '') + '</span></div></div><button type="button" class="dclose" data-act="closecar" aria-label="ปิด">✕</button></div>' +
    '<div class="fchips tl-tabs">' + tabs.map(function (t) { return '<button type="button" class="fchip' + (f === t[0] ? ' on' : '') + '" data-act="tlf" data-s="' + t[0] + '">' + t[1] + ' <b>' + cnt[t[0]] + '</b></button>'; }).join('') + '</div>' +
    '<div class="tl">' + (body || '<div class="mute" style="padding:20px 4px">ยังไม่มีรายการ</div>') + '</div></div>';
}
function carCsv() {
  var cols = [['ทะเบียน', 'plate'], ['จังหวัด', 'province'], ['ประเภทรถ', 'vtype'], ['ยี่ห้อ/รุ่น', 'model'], ['ปี', 'year'], ['สี', 'color'], ['เชื้อเพลิง', 'fuel'], ['เลขตัวถัง', 'vin'], ['เลขเครื่อง', 'engineNo'], ['เลขไมล์ล่าสุด', 'lastOdo'], ['พ.ร.บ.หมดอายุ', 'actExp'], ['ภาษีหมดอายุ', 'taxExp'], ['ประกันหมดอายุ', 'insExp'], ['บริษัทประกัน', 'insurer']];
  var q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var lines = [cols.map(function (c) { return c[0]; }).concat(['สถานะ', 'เช็คระยะถัดไป (กม.)']).map(q).join(',')].concat(carRows().map(function (c) {
    var si = svcInfo(c), t = openTripOf(c.plate);
    return cols.map(function (k) { return q(c[k[1]]); }).concat([q(t ? 'ถูกเบิก: ' + t.name : 'ว่าง'), q(si && si.left !== null ? si.left : '')]).join(',');
  }));
  var url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  var a = document.createElement('a'); a.href = url; a.download = 'Sirikul-cars-' + today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}
function carForm() {
  var e = S.cars.filter(function (c) { return c.id === S.edit; })[0] || {};
  var v = function (k) { return esc(e[k]); };
  var f = function (label, input, full) { return '<div class="' + (full ? 'full' : '') + '"><label>' + label + '</label>' + input + '</div>'; };
  return '<form class="card noprint" id="fCar"><div class="dhead"><h2>' + (e.id ? 'แก้ไขรถ ' + esc(e.plate) : 'เพิ่มรถคันใหม่') + '</h2><button type="button" class="dclose" data-act="closecar" aria-label="ปิด">✕</button></div>' +
    '<div class="ocrbox"><b>อ่านจากสำเนาทะเบียน</b><div class="mute" style="font-size:13.5px;margin:2px 0 8px">ถ่ายรูปหรือเลือกไฟล์สแกนหน้ารายการจดทะเบียน ระบบจะกรอกข้อมูลให้ ตรวจแล้วกดบันทึก (ไฟล์นี้จะถูกเก็บเป็นสำเนาทะเบียนด้วย)</div>' +
    '<input type="file" id="ocrFile" accept="image/*,application/pdf" capture="environment"><div id="ocrMsg" style="font-size:13.5px;margin-top:6px"></div></div>' +
    '<input type="hidden" name="id" value="' + v('id') + '">' +
    '<div class="fgrid">' +
    f('ทะเบียน', '<input name="plate" required maxlength="20" value="' + v('plate') + '" placeholder="เช่น 1กข 1234">') +
    f('จังหวัด (แสดงบนป้ายทะเบียน)', '<input name="province" maxlength="40" value="' + v('province') + '" placeholder="เช่น กรุงเทพมหานคร">') +
    (e.id ? '<div class="full mute" style="font-size:13px;margin-top:4px">แก้เลขทะเบียนได้ QR เดิมยังใช้ได้ และประวัติทั้งหมดจะย้ายไปอยู่ใต้ทะเบียนใหม่</div>' : '') +
    f('ประเภทรถ', '<select name="vtype"><option value="">เลือกประเภท</option>' + VTYPES.map(function (x) { return '<option' + (e.vtype === x[0] ? ' selected' : '') + '>' + x[0] + '</option>'; }).join('') + '</select>') +
    '<input type="hidden" name="plateColor" value="' + esc(e.plateColor || 'black') + '">' +
    f('ยี่ห้อ/รุ่น', '<input name="model" maxlength="80" value="' + v('model') + '">') +
    f('ปี (ค.ศ.)', '<input name="year" inputmode="numeric" maxlength="4" value="' + v('year') + '">') +
    f('สี', '<input name="color" maxlength="30" value="' + v('color') + '">') +
    f('เชื้อเพลิง', '<input name="fuel" maxlength="30" value="' + v('fuel') + '" placeholder="เบนซิน/ดีเซล/ไฟฟ้า">') +
    f('เลขตัวถัง', '<input name="vin" maxlength="30" value="' + v('vin') + '">') +
    f('เลขเครื่อง', '<input name="engineNo" maxlength="30" value="' + v('engineNo') + '">') +
    f('พ.ร.บ.หมดอายุ', '<input name="actExp" type="date" value="' + v('actExp') + '">') +
    f('ภาษีหมดอายุ', '<input name="taxExp" type="date" value="' + v('taxExp') + '">') +
    f('ประกันหมดอายุ', '<input name="insExp" type="date" value="' + v('insExp') + '">') +
    f('บริษัทประกันภัย', '<input name="insurer" list="insurers" maxlength="60" value="' + v('insurer') + '" placeholder="พิมพ์หรือเลือก">' +
      '<datalist id="insurers">' + INSURERS.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>') +
    f('สำเนาทะเบียนรถ (รูปหรือ PDF ไม่เกิน 4 MB)' + (e.regDocId ? ' — มีไฟล์เดิม เลือกใหม่เพื่อแทนที่' : ''), '<input type="file" id="regFile" accept="image/*,application/pdf">', true) +
    '</div><button type="submit">' + (e.id ? 'บันทึกการแก้ไข' : 'เพิ่มรถ') + '</button>' +
    '<button type="button" class="ghost" data-act="closecar">ยกเลิก</button></form>';
}

function admSettings() {
  return '<div class="split2"><form class="card" id="fSettings"><h2>โลโก้บริษัท</h2>' +
    '<div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">' +
    '<div class="logo-prev" id="logoPreview">' + (S.logo ? logoImg() : 'ยังไม่มีโลโก้') + '</div>' +
    '<div style="flex:1;min-width:220px"><label>เลือกไฟล์โลโก้</label><input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml">' +
    '<div class="mute" style="font-size:13px;margin-top:6px">แนะนำไฟล์ PNG พื้นโปร่งใส รูปทรงจัตุรัสหรือแนวนอน ระบบย่อให้อัตโนมัติ โลโก้จะแสดงที่หัวแอป หน้าแรกของคนขับ เมนูแอดมิน และบนสติกเกอร์ QR</div>' +
    (S.logo ? '<button type="button" class="small line" data-act="removelogo" style="margin-top:10px">ลบโลโก้</button>' : '') + '</div></div>' +
    '<label>ชื่อบริษัทที่แสดง</label><input name="company" maxlength="60" required value="' + esc(S.company) + '">' +
    '<button type="submit">บันทึกการตั้งค่า</button></form>' +
    '<div class="card"><h2>ตัวอย่างสติกเกอร์ QR</h2><div class="qrcell" style="max-width:220px">' +
    (S.logo ? logoImg('qlogo') : '') + '<span class="qco">' + esc(S.company) + '</span>' +
    '<div style="width:150px;height:150px;margin:0 auto 6px;background:repeating-linear-gradient(45deg,#e5e7eb 0 8px,#f3f4f6 8px 16px);border-radius:6px"></div>' +
    '<b>1กข 1234</b><small>สแกนเพื่อเบิก/คืนรถ</small></div>' +
    '<div class="mute" style="font-size:13px;margin-top:10px">ไฟล์โลโก้เก็บในโฟลเดอร์ "รถส่วนกลางศิริกุล/โลโก้" ใน Google Drive ไม่ได้อยู่บน GitHub</div></div></div>';
}

function admQr() {
  if (!S.cars.length) return '<div class="card mute">ยังไม่มีรถ เพิ่มรถได้ที่เมนู "จัดการรถ"</div>';
  return '<div class="card"><div class="qrgrid" id="qrgrid"></div><div class="mute noprint" style="font-size:13px;margin-top:12px">QR ผูกกับรหัสประจำรถ แก้เลขทะเบียนแล้ว QR เดิมยังใช้ได้ ไม่ต้องพิมพ์ใหม่ กด "คัดลอกลิงก์" เพื่อส่งทาง LINE ได้</div></div>';
}

function emptyState(icon, title, sub) { return '<div class="card empty"><div class="em-ic">' + ic(icon, 30) + '</div><b>' + title + '</b><span>' + (sub || '') + '</span></div>'; }
function admOpen() {
  if (!S.open.length) return emptyState('shield', 'ไม่มีรถค้างเบิก', 'รถทุกคันถูกคืนเรียบร้อยแล้ว');
  var list = S.open.slice().sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });
  var byPlate = {}; S.cars.forEach(function (c) { byPlate[c.plate] = c; });
  return '<div class="card flush">' + dt(['ทะเบียน', 'ผู้เบิก', 'เวลาเบิก', 'ค้าง', 'ไมล์ก่อน', 'ไปที่ไหน', ''], list.map(function (t) {
    var c = byPlate[t.plate];
    return ['<b>' + esc(t.plate) + '</b>', esc(t.name), thTime(t.ts), overdue(t.ts) ? '<span class="chip">' + overdue(t.ts) + '</span>' : '<span class="mute">-</span>', km(t.odoStart), esc(t.purpose),
      '<div class="acts">' + (c && S.appUrl ? '<a class="small linkbtn" href="' + esc(carUrl(c)) + '" target="_blank" rel="noopener">เปิดหน้ารถ</a>' : '') +
      '<button class="small line" data-act="cancel" data-id="' + esc(t.id) + '">ยกเลิก (เบิกผิด)</button></div>'];
  }), [4]) + '<div class="mute" style="font-size:13px;padding:10px 12px">"ยกเลิก" ใช้เมื่อกดเบิกผิด รายการจะไม่นับในรายงาน ถ้าใช้รถจริงแต่ลืมคืน ให้เปิดหน้ารถแล้วกดคืนรถ</div></div>';
}

function admReport() {
  var r = S.report;
  if (!r) return '<div class="card mute">เลือกเดือนด้านบนแล้วกด "ดูรายงาน"</div>';
  var t = r.totals;
  var h = '<div class="kpis">' + kpi('จำนวนเที่ยว', km(t.trips), monthTh(r.month), 'info', 'car') + kpi('ระยะทางรวม', km(t.km), 'กิโลเมตร', 'ok', 'chart') +
    kpi('ค่าใช้จ่ายรวม', baht(t.total), 'น้ำมัน ' + baht(t.fuel) + ' · อื่นๆ ' + baht(t.other) + ' · ซ่อม ' + baht(t.maint), 'warn', 'receipt') +
    kpi('ต้นทุนเฉลี่ยต่อ กม.', t.perKm == null ? '-' : baht(t.perKm), 'บาท', 'info', 'sliders') + '</div>';
  h += '<div class="card flush"><h2>ต่อคัน</h2>' + (r.byCar.length ? dt(['ทะเบียน', 'เที่ยว', 'ระยะทาง (กม.)', 'น้ำมัน', 'อื่นๆ', 'ซ่อมบำรุง', 'รวม', 'บาท/กม.'],
    r.byCar.map(function (c) { return ['<b>' + esc(c.plate) + '</b>', c.trips, km(c.km), baht(c.fuel), baht(c.other), baht(c.maint), '<b>' + baht(c.total) + '</b>', c.perKm == null ? '-' : baht(c.perKm)]; }),
    [1, 2, 3, 4, 5, 6, 7], ['รวม', t.trips, km(t.km), baht(t.fuel), baht(t.other), baht(t.maint), baht(t.total), t.perKm == null ? '-' : baht(t.perKm)])
    : '<div class="mute" style="padding:0 12px 12px">ไม่มีข้อมูลในเดือนนี้</div>') + '</div>';
  h += '<div class="split2" style="margin-top:18px"><div class="card flush"><h2>ต่อคนขับ</h2>' + (r.byDriver.length ? dt(['ชื่อ', 'เที่ยว', 'ระยะทาง (กม.)', 'ยังไม่คืน'],
    r.byDriver.map(function (x) { return [esc(x.name), x.trips, km(x.km), x.open || '-']; }), [1, 2, 3]) : '<div class="mute" style="padding:0 12px 12px">ไม่มีการใช้รถในเดือนนี้</div>') + '</div>';
  h += '<div class="card"><h2>ไฟล์รายงาน</h2><div class="mute" style="font-size:14px">ดาวน์โหลดเป็นไฟล์ Excel มีแท็บสรุปต่อคัน ต่อคนขับ รายการใช้รถ ค่าใช้จ่าย และซ่อมบำรุง</div>' +
    '<button class="ghost" data-act="export">ดาวน์โหลด Excel</button></div></div>';
  return h;
}

/* ---------- จัดการคนขับ ---------- */
function drvState(d) {
  if (d.active === 'N') return 'off';
  var n = licDays(d);
  return n === null ? 'na' : n < 0 ? 'bad' : n <= 30 ? 'warn' : 'ok';
}
var DRV_FILTERS = [['all', 'ใช้งานอยู่', ''], ['warn', 'ใบขับขี่ใกล้หมด', 'warn'], ['bad', 'ใบขับขี่หมดอายุ', 'bad'], ['na', 'ยังไม่ระบุวันหมดอายุ', ''], ['off', 'ปิดใช้งาน', '']];
function drvCards(list) {
  return '<div class="ccards dcards">' + list.map(function (d) {
    var st = drvState(d), trip = S.open.filter(function (t) { return t.name === d.name; })[0];
    var pill = st === 'off' ? '<span class="spill off"><i></i>ปิดใช้งาน</span>' : trip ? '<span class="spill busy"><i></i>กำลังใช้รถ ' + esc(trip.plate) + '</span>' : '<span class="spill free"><i></i>ว่าง</span>';
    return '<div class="ccard dcard st-' + st + (d.name === S.drvEdit && S.drvForm ? ' sel' : '') + '">' +
      '<div class="cc-top"><div class="mcell"><span class="av lg">' + esc(String(d.name).trim().charAt(0)) + '</span><div class="cc-nm"><b>' + esc(d.name) + '</b><div class="dpill">' + pill + '</div></div></div></div>' +
      '<div class="dinfo"><div class="drow">' + ic('phone', 16) + '<span class="dl">เบอร์โทร</span>' + (d.phone ? '<a class="dv" href="tel:' + esc(d.phone) + '">' + esc(d.phone) + '</a>' : '<span class="dv mute">ไม่ระบุ</span>') + '</div>' +
      '<div class="drow">' + ic('idcard', 16) + '<span class="dl">ใบขับขี่หมดอายุ</span><span class="dv">' + (d.licenseExp ? thDate(d.licenseExp) : '<span class="mute">ไม่ระบุ</span>') + '</span></div>' +
      '<div class="drow">' + ic('clock', 16) + '<span class="dl">อัปเดตล่าสุด</span><span class="dv mute">' + (d.updated ? thDate(d.updated) : '-') + '</span></div></div>' +
      '<div class="due-tile ' + st + ' wide">' + (function () {
        var n = licDays(d);
        if (st === 'off') return '<span class="dl">สถานะใบขับขี่</span><b>ไม่ได้ใช้งาน</b>';
        if (n === null) return '<span class="dl">ใบขับขี่</span><b>ยังไม่ระบุวันหมดอายุ</b>';
        return '<span class="dl">ใบขับขี่</span><b>' + (n < 0 ? 'หมดอายุแล้ว ' + (-n) + ' วัน' : n === 0 ? 'หมดอายุวันนี้' : 'เหลือ ' + n + ' วัน') + '</b>';
      })() + '</div>' +
      '<div class="cc-act"><button class="small" data-act="editdrv" data-n="' + esc(d.name) + '">' + ic('edit', 15) + 'แก้ไขข้อมูล</button>' +
      (d.active === 'N' ? '<button class="small ghost" data-act="drvactive" data-v="Y" data-n="' + esc(d.name) + '">เปิดใช้งาน</button>' : '<button class="small line" data-act="drvactive" data-v="N" data-n="' + esc(d.name) + '">' + ic('power', 15) + 'ปิดใช้งาน</button>') + '</div></div>';
  }).join('') + '</div>';
}
function driverForm() {
  var e = (S.dlist || []).filter(function (d) { return d.name === S.drvEdit; })[0] || {}, editing = !!e.name;
  return '<form class="card noprint" id="fDriver"><div class="dhead"><h2>' + (editing ? 'แก้ไขคนขับ' : 'เพิ่มคนขับ') + '</h2><button type="button" class="dclose" data-act="closecar" aria-label="ปิด">✕</button></div>' +
    '<input type="hidden" name="oldName" value="' + esc(e.name || '') + '">' +
    '<div class="fgrid"><div class="full"><label>ชื่อคนขับ</label><input name="dname" required maxlength="60" autocomplete="off"' + (editing ? ' readonly' : '') + ' value="' + esc(e.name || '') + '" placeholder="ชื่อที่คนขับใช้ตอนเบิกรถ">' +
    '<div class="mute" style="font-size:13px;margin-top:4px">' + (editing ? 'แก้ชื่อไม่ได้ เพราะประวัติการใช้รถอ้างอิงด้วยชื่อ ถ้าต้องการเปลี่ยน ให้เพิ่มคนขับใหม่แล้วปิดใช้งานชื่อเดิม' : 'พิมพ์ให้ตรงกับชื่อที่คนขับใช้เบิกรถ ถ้าพิมพ์ต่างกัน ระบบจะนับเป็นคนละคน') + '</div></div>' +
    '<div><label>เบอร์โทร</label><input name="phone" type="tel" inputmode="tel" maxlength="12" autocomplete="off" value="' + esc(e.phone || '') + '" placeholder="เช่น 0812345678"></div>' +
    '<div><label>ใบขับขี่หมดอายุ</label><input name="licenseExp" type="date" value="' + esc(e.licenseExp || '') + '"></div></div>' +
    '<button type="submit">' + (editing ? 'บันทึกการแก้ไข' : 'เพิ่มคนขับ') + '</button><button type="button" class="ghost" data-act="closecar">ยกเลิก</button></form>';
}
function admDrivers() {
  ensureDlist();
  if (!S.dlist) return '<div class="card center mute">กำลังโหลดรายชื่อคนขับ...</div>';
  var f = S.df || (S.df = { st: 'all', q: '' });
  var inner = S.drvForm ? driverForm() : '';
  if (!S.dlist.length) return withDrawer(emptyState('user', 'ยังไม่มีรายชื่อคนขับ', 'กด "+ เพิ่มคนขับ" ด้านบน หรือรอให้คนขับเบิกรถครั้งแรก ชื่อจะขึ้นที่นี่เอง'), inner);
  var cnt = { all: 0, warn: 0, bad: 0, na: 0, off: 0 };
  S.dlist.forEach(function (d) { var st = drvState(d); if (st === 'ok') cnt.all++; else { cnt[st]++; if (st !== 'off') cnt.all++; } });
  var busyNames = {}; S.open.forEach(function (t) { busyNames[t.name] = 1; });
  var using = S.dlist.filter(function (d) { return d.active !== 'N' && busyNames[d.name]; }).length;
  var q = f.q.trim().toLowerCase();
  var rows = S.dlist.filter(function (d) {
    var st = drvState(d);
    if (f.st === 'all' ? st === 'off' : st !== f.st) return false;
    return !q || String(d.name).toLowerCase().indexOf(q) >= 0 || String(d.phone || '').indexOf(q) >= 0;
  });
  var kpis = '<div class="kpis">' + kpi('คนขับที่ใช้งานอยู่', cnt.all, 'ปิดใช้งาน ' + cnt.off + ' คน', 'info', 'user') + kpi('กำลังใช้รถอยู่', using, 'ยังไม่คืนรถ', 'ok', 'car') +
    kpi('ใบขับขี่ใกล้หมด', cnt.warn, 'ภายใน 30 วัน', 'warn', 'clock') + kpi('ใบขับขี่หมดอายุ', cnt.bad, 'ไม่ควรให้ขับ', 'bad', 'shield') + '</div>';
  var chips = '<div class="fchips">' + DRV_FILTERS.map(function (x) {
    return '<button class="fchip ' + x[2] + (f.st === x[0] ? ' on' : '') + '" data-act="dfst" data-s="' + x[0] + '">' + x[1] + ' <b>' + cnt[x[0]] + '</b></button>';
  }).join('') + '</div>';
  var tools = '<div class="ftools"><label class="fsearch">' + ic('search', 16) + '<input id="dq" type="search" placeholder="ค้นหาชื่อ / เบอร์โทร" value="' + esc(f.q) + '"></label><span class="mute fcount">พบ ' + rows.length + ' คน</span></div>';
  var body = rows.length ? drvCards(rows) : '<div class="card mute" style="padding:18px">ไม่พบคนขับตามตัวกรอง</div>';
  var foot = '<div class="mute" style="font-size:13px;margin-top:14px">คนขับใหม่จะถูกเพิ่มอัตโนมัติเมื่อเบิกรถครั้งแรก · คนขับที่ปิดใช้งานจะเบิกรถไม่ได้ แต่ประวัติทั้งหมดยังอยู่ และคืนรถที่ค้างอยู่ได้ตามปกติ</div>';
  return withDrawer('<div>' + kpis + chips + tools + body + foot + '</div>', inner);
}

/* ---------- ฟอร์มและปุ่ม ---------- */
var pendingImages = [], pendingReg = null, pendingLogo = '';
function bindForms() {
  pendingImages = []; pendingReg = null;
  var inp = $('#imgs');
  if (inp) inp.addEventListener('change', async function () {
    var files = Array.prototype.slice.call(inp.files, 0, 5);
    if (inp.files.length > 5) toast('เลือกได้ไม่เกิน 5 รูป ใช้ 5 รูปแรก', 'err');
    try {
      pendingImages = await Promise.all(files.map(shrink));
      $('#thumbs').innerHTML = pendingImages.map(function (d) { return '<img src="' + d + '">'; }).join('');
    } catch (e) { toast(e.message, 'err'); }
  });
  var lf = $('#logoFile');
  if (lf) lf.addEventListener('change', async function () {
    var file = lf.files[0]; pendingLogo = ''; if (!file) return;
    try { pendingLogo = await shrinkLogo(file); $('#logoPreview').innerHTML = '<img src="' + pendingLogo + '" alt="ตัวอย่างโลโก้">'; }
    catch (e) { toast(e.message, 'err'); }
  });
  hook('#fSettings', 'saveSettings', function (d) { return { company: d.company, logo: pendingLogo, pin: S.pin }; }, 'บันทึกการตั้งค่าแล้ว', function () { pendingLogo = ''; });
  var fcar = $('#fCar');
  if (fcar) fcar.elements['vtype'].addEventListener('change', function () {
    var pc = plateColorFor(this.value), cur = fcar.elements['plateColor'];
    if (pc && cur.value !== 'red') cur.value = pc; // ป้ายแดงเป็นกรณีพิเศษ ไม่แตะ
  });
  var of = $('#ocrFile');
  if (of) of.addEventListener('change', async function () {
    var file = of.files[0]; if (!file) return;
    var setMsg = function (h) { var m = $('#ocrMsg'); if (m) m.innerHTML = h; }; // หาจากหน้าปัจจุบันทุกครั้ง
    setMsg('<span class="mute">กำลังอ่านสำเนาทะเบียน อาจใช้เวลา 10-20 วินาที...</span>');
    try {
      var data = file.type === 'application/pdf' ? await readDataUrl(file) : await shrinkTo(file, 2200, 0.9);
      if (file.type === 'application/pdf' && file.size > 4 * 1024 * 1024) throw new Error('ไฟล์ PDF ใหญ่เกิน 4 MB');
      pendingReg = data; // เก็บเป็นสำเนาทะเบียนเมื่อกดบันทึก
      var r = await call('ocrRegDoc', { file: data, pin: S.pin });
      r.fields = parseRegText(r.text);
      var form = $('#fCar'); if (!form) return;
      var E = form.elements, editing = !!E['id'].value, got = [];
      if (r.fields.plateColor && !editing) E['plateColor'].value = r.fields.plateColor;
      Object.keys(OCR_LABELS).forEach(function (k) {
        var v = r.fields[k];
        if (!v || (editing && E[k].value)) return;
        E[k].value = v; E[k].classList.add('filled'); got.push(OCR_LABELS[k]);
      });
      setMsg(got.length
        ? '<span class="cd-ok">กรอกให้ ' + got.length + ' ช่อง (' + got.join(', ') + ') ช่องสีเขียวคือค่าที่อ่านได้ กรุณาตรวจก่อนบันทึก</span>'
        : '<span class="cd-warn">อ่านข้อมูลไม่ได้ ลองถ่ายให้ตรง ชัด และไม่มีแสงสะท้อน หรือพิมพ์เอง</span>');
    } catch (e) { setMsg('<span class="cd-bad">' + esc(e.message) + '</span>'); }
  });
  var rf = $('#regFile');
  if (rf) rf.addEventListener('change', async function () {
    var f = rf.files[0]; pendingReg = null; if (!f) return;
    try {
      if (f.type === 'application/pdf') {
        if (f.size > 4 * 1024 * 1024) { rf.value = ''; return toast('ไฟล์ PDF ใหญ่เกิน 4 MB', 'err'); }
        pendingReg = await readDataUrl(f);
      } else pendingReg = await shrink(f);
    } catch (e) { toast(e.message, 'err'); }
  });
  var after = function (tab, sub) { return function () { S.hist = {}; S.tab = tab; S.sub = sub || ''; S.lastSheet = ''; try { if (history.state && history.state.sheet) history.replaceState(null, ''); } catch (e) {} }; };
  hook('#fCheckout', 'checkout', function (d) { var mode = $('#drvExtra').dataset.mode; return { name: d.name, phone: mode === 'new' ? d.phone : '', licenseExp: mode ? d.licenseExp : '', plate: d.plate, odoStart: d.odoStart, purpose: d.purpose, dest: d.dest, images: pendingImages }; }, 'เบิกรถเรียบร้อย', after('home'), function (d) {
    var w = [], car = curCar(), last = car.lastOdo, v = Number(d.odoStart);
    var lic = $('#drvExtra').dataset.mode ? d.licenseExp : (S.drvLic[String(d.name).trim()] || '');
    var ln = daysLeft(lic);
    if (ln !== null && ln < 0) w.push('ใบขับขี่หมดอายุแล้ว ' + (-ln) + ' วัน (' + thDate(lic) + ') ไม่ควรขับรถจนกว่าจะต่ออายุ');
    if (last !== '' && last != null) {
      if (v < Number(last)) w.push('เลขไมล์ที่กรอก (' + km(v) + ') น้อยกว่าไมล์ล่าสุดของรถ (' + km(last) + ') กรุณาตรวจสอบหน้าปัดอีกครั้ง');
      else if (v - Number(last) > ODO_GAP) w.push('เลขไมล์ห่างจากครั้งล่าสุด (' + km(last) + ') ถึง ' + km(v - Number(last)) + ' กม. อาจกรอกผิด หรือมีการใช้รถที่ไม่ได้บันทึก');
    }
    return w.join('\n\n');
  });
  hook('#fReturn', 'returnCar', function (d) { var t = openTripOf(S.plate); return { name: S.name || (t && t.name) || 'ไม่ระบุ', id: d.id, odoEnd: d.odoEnd, images: pendingImages }; }, 'คืนรถเรียบร้อย', after('home'), function (d) {
    var t = openTripOf(S.plate); if (!t) return '';
    var dist = Number(d.odoEnd) - Number(t.odoStart);
    return dist > TRIP_MAX ? 'ระยะทางเที่ยวนี้ ' + km(dist) + ' กม. มากผิดปกติ กรุณาตรวจสอบเลขไมล์อีกครั้ง' : '';
  });
  hook('#fMaint', 'addMaintenance', function (d) {
    return { name: d.name, plate: S.plate, date: d.date, type: d.type, detail: d.detail, odo: d.odo, shop: d.shop, cost: d.cost, nextDate: d.nextDate, nextOdo: d.nextOdo, images: pendingImages };
  }, 'บันทึกประวัติซ่อมบำรุงแล้ว', function () { S.hist = {}; S.tab = 'car'; S.sub = 'maint'; S.mopen = false; S.mdef = ''; });
  hook('#fExpense', 'addExpense', function (d) { return { name: d.name, plate: d.plate, date: d.date, type: d.type, amount: d.amount, note: d.note, images: pendingImages }; }, null, after('home'));
  var fnd = $('#fNewDriver');
  if (fnd) fnd.elements['licenseExp'].addEventListener('change', function () { $('#regLicNote').innerHTML = licNote(fnd.elements['licenseExp'].value); });
  hook('#fNewDriver', 'registerDriver', function (d) { return { name: d.name, phone: d.phone, licenseExp: d.licenseExp }; },
    'เพิ่มชื่อเรียบร้อย กรอกข้อมูลเบิกรถต่อได้เลย', function () { S.sub = 'trip'; S.lastSheet = ''; S.newName = ''; S.drvLic = {}; });
  hook('#fCar', 'saveCar', function (d) {
    var o = {}; ['id','plate','province','vtype','plateColor','model','year','color','fuel','vin','engineNo','actExp','taxExp','insExp','insurer'].forEach(function (k) { o[k] = d[k]; });
    o.pin = S.pin; if (pendingReg) o.regDoc = pendingReg; return o;
  }, 'บันทึกข้อมูลรถแล้ว', function () { S.edit = ''; S.carForm = false; S.hist = {}; });
  hook('#fDriver', 'saveDriver', function (d) { return { oldName: d.oldName, name: d.dname, phone: d.phone, licenseExp: d.licenseExp, pin: S.pin }; },
    'บันทึกข้อมูลคนขับแล้ว', function () { S.drvForm = false; S.drvEdit = ''; S.dlist = null; });
  var pinTry = '';
  hook('#fPin', 'checkPin', function (d) { pinTry = d.pin; return { pin: d.pin }; }, 'เข้าโหมดแอดมินแล้ว',
    function () { S.pin = pinTry; sset('sessionStorage', 'adminPin', pinTry); S.dlist = null; });

  var fc = $('#fCheckout');
  if (fc) {
    var EC = fc.elements, tmr = null;
    var onName = function () {
      var pf = profile(EC['name'].value.trim());
      if (pf.phone && !EC['phone'].value) EC['phone'].value = pf.phone;
      if (pf.lic && !EC['licenseExp'].value) EC['licenseExp'].value = pf.lic;
      updateDriverUI();
    };
    EC['name'].addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(onName, 350); });
    EC['name'].addEventListener('change', onName);
    EC['licenseExp'].addEventListener('change', function () { put($('#licNote'), licNote(EC['licenseExp'].value)); });
    // ปุ่มในการ์ดเตือนใบขับขี่ถูกสร้างทีหลัง จึงรับการกดผ่านฟอร์ม
    fc.addEventListener('click', function (e) {
      if (e.target.closest('[data-act=editlic]')) { e.preventDefault(); showDriverExtra('lic'); EC['licenseExp'].focus(); }
      else if (e.target.closest('[data-act=newdriver]')) { e.preventDefault(); S.newName = EC['name'].value.trim(); S.sub = 'newdriver'; S.lastSheet = ''; render(); window.scrollTo(0, 0); }
    });
    fc.addEventListener('input', function (e) { if (e.target !== EC['name']) updateSteps(); });
    // กด Enter ระหว่างทาง = ไปช่องถัดไป (ไม่ส่งฟอร์มก่อนครบทุกขั้น)
    fc.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'file') return;
      var st = Number(fc.dataset.stage || 1); if (st >= 4 && e.target.name === 'dest') return;
      e.preventDefault(); updateSteps(true);
      var ins = [].slice.call(fc.querySelectorAll('.step:not(.hide) input:not([type=hidden]):not([type=file])')), i = ins.indexOf(e.target);
      if (ins[i + 1]) ins[i + 1].focus();
    });
    updateDriverUI();
  }
  document.querySelectorAll('.qchips').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var c = e.target.closest('.qchip'); if (!c) return;
      var f = g.closest('form'), inp = f && f.elements[g.dataset.field]; if (!inp) return;
      if (f.id === 'fCheckout') S.stepFocus = true; // แตะปุ่มลัดแล้วเลื่อนโฟกัสไปช่องของขั้นถัดไปให้เลย
      inp.value = c.dataset.v; g.querySelectorAll('.qchip').forEach(function (x) { x.classList.toggle('on', x === c); });
      if (g.dataset.field === 'name') { var pf = profile(inp.value); if (pf.phone) f.elements['phone'].value = pf.phone; if (pf.lic) f.elements['licenseExp'].value = pf.lic; updateDriverUI(); }
      if (f.id === 'fCheckout') updateSteps(true);
    });
  });
  var fr = $('#fReturn');
  if (fr) fr.elements['odoEnd'].addEventListener('input', function () {
    var t = openTripOf(S.plate), v = Number(fr.elements['odoEnd'].value);
    $('#tripKm').innerHTML = t && fr.elements['odoEnd'].value ? (v >= Number(t.odoStart) ? 'ระยะทางเที่ยวนี้ ' + km(v - Number(t.odoStart)) + ' กม.' : '<span class="cd-bad">น้อยกว่าไมล์ก่อนออก</span>') : '';
  });
  var fm = $('#fMaint');
  if (fm) {
    var touched = false, E = fm.elements;
    ['nextDate', 'nextOdo'].forEach(function (n) { E[n].addEventListener('input', function () { touched = true; }); });
    var fill = function () {
      if (touched || E['type'].value !== SERVICE) return;
      var o = Number(E['odo'].value); if (o) E['nextOdo'].value = o + 10000;
      if (E['date'].value) {
        var x = new Date(E['date'].value + 'T00:00:00'); x.setMonth(x.getMonth() + 6);
        var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
        E['nextDate'].value = x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate());
      }
    };
    ['type', 'odo', 'date'].forEach(function (n) { E[n].addEventListener('change', fill); });
    fill();
  }
  var cq = $('#cfq'); if (cq) cq.addEventListener('input', function () {
    S.cf.q = cq.value; var pos = cq.selectionStart; render();
    var n = $('#cfq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
  });
  var dq = $('#dq'); if (dq) dq.addEventListener('input', function () {
    S.df.q = dq.value; var pos = dq.selectionStart; render();
    var n = $('#dq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
  });
  var pc = $('#pickCar'); if (pc) pc.addEventListener('change', function () { S.plate = pc.value; render(); });
  document.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var a = b.dataset.act;
      if (a === 'sub') openSheet(b.dataset.s);
      else if (a === 'closesheet') closeSheet();
      else if (a === 'reg') showReg();
      else if (a === 'cfst') { S.cf.st = b.dataset.s; render(); }
      else if (a === 'cfvt') { S.cf.vt = b.dataset.s; render(); }
      else if (a === 'cfsort') { if (S.cf.sort === b.dataset.s) S.cf.dir = -S.cf.dir; else { S.cf.sort = b.dataset.s; S.cf.dir = 1; } render(); }
      else if (a === 'carcsv') carCsv();
      else if (a === 'timeline') { S.tl = b.dataset.id; S.tlf = 'all'; S.carForm = false; S.edit = ''; render(); }
      else if (a === 'tlf') { S.tlf = b.dataset.s; render(); var dr = document.querySelector('.drawer'); if (dr) dr.scrollTop = 0; }
      else if (a === 'asub') { S.asub = b.dataset.s; S.drvForm = false; S.drvEdit = ''; if (S.asub === 'drivers') S.dlist = null; render(); window.scrollTo(0, 0); }
      else if (a === 'newdrv') { S.drvEdit = ''; S.drvForm = true; S.asub = 'drivers'; render(); focusDrvForm(); }
      else if (a === 'editdrv') { S.drvEdit = b.dataset.n; S.drvForm = true; render(); focusDrvForm(); }
      else if (a === 'drvactive') setDriverActive(b.dataset.n, b.dataset.v);
      else if (a === 'dfst') { S.df.st = b.dataset.s; render(); }
      else if (a === 'print') window.print();
      else if (a === 'uselast') { var fo = b.closest('form'); fo.elements['odoStart'].value = b.dataset.v; fo.elements['odoStart'].dispatchEvent(new Event('input', { bubbles: true })); updateSteps(true); }
      else if (a === 'install' && FS.prompt) { FS.prompt.prompt(); FS.prompt.userChoice.then(function () { FS.prompt = null; render(); }); }
      else if (a === 'installhide') { sset('localStorage', 'installHide', '1'); render(); }
      else if (a === 'removelogo') {
        askConfirm('ลบโลโก้ออกจากแอป?', 'ลบโลโก้').then(function (ok) {
          if (!ok) return;
          call('saveSettings', { removeLogo: true, pin: S.pin }).then(function () { toast('ลบโลโก้แล้ว', 'ok'); return load(); }).then(render).catch(function (e) { toast(e.message, 'err'); });
        });
      }
      else if (a === 'cancel') cancelTrip(b.dataset.id);
      else if (a === 'runreport') runReport(b);
      else if (a === 'export') exportReport(b);
      else if (a === 'logout') { S.pin = ''; S.edit = ''; S.dlist = null; sset('sessionStorage', 'adminPin', ''); showWho(); render(); }
      else if (a === 'opencar') { S.plate = b.dataset.p; S.sub = ''; S.tab = 'car'; render(); window.scrollTo(0, 0); }
      else if (a === 'editcar') { S.edit = b.dataset.id; S.carForm = true; render(); focusCarForm(); }
      else if (a === 'newcar') { S.edit = ''; S.carForm = true; S.asub = 'cars'; render(); focusCarForm(); }
      else if (a === 'closecar') { S.edit = ''; S.carForm = false; S.tl = ''; S.drvForm = false; S.drvEdit = ''; render(); }
      else if (a === 'removecar') setCarActive(b.dataset.id, 'N');
      else if (a === 'restorecar') setCarActive(b.dataset.id, 'Y');
      else if (a === 'addservice') { S.mopen = true; S.mdef = SERVICE; render(); var f = $('#fMaint'); if (f) f.scrollIntoView(); }
    });
  });
}
async function busyCall(btn, action, payload) {
  var txt = btn.textContent; btn.disabled = true; btn.textContent = 'กำลังทำงาน...';
  try { return await call(action, payload); }
  finally { btn.disabled = false; btn.textContent = txt; }
}
function focusCarForm() {
  var f = $('#fCar'); if (!f) return;
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(function () { f.elements['plate'].focus({ preventScroll: true }); }, 300);
}
function focusDrvForm() {
  var f = $('#fDriver'); if (!f) return;
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(function () { (f.elements['dname'].readOnly ? f.elements['phone'] : f.elements['dname']).focus({ preventScroll: true }); }, 300);
}
async function setDriverActive(name, active) {
  if (active === 'N' && !(await askConfirm('ปิดใช้งานคนขับ "' + name + '"?\nประวัติทั้งหมดยังอยู่ แต่จะเบิกรถไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง', 'ปิดใช้งาน'))) return;
  try {
    await call('setDriverActive', { name: name, active: active, pin: S.pin });
    if (S.drvEdit === name) { S.drvEdit = ''; S.drvForm = false; }
    toast(active === 'N' ? 'ปิดใช้งาน ' + name + ' แล้ว' : 'เปิดใช้งาน ' + name + ' แล้ว', 'ok');
    S.dlist = null; await load(); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function setCarActive(id, active) {
  var c = S.cars.concat(S.removed).filter(function (x) { return x.id === id; })[0]; if (!c) return;
  if (active === 'N' && !(await askConfirm('นำรถ ' + c.plate + ' ออกจากระบบ?\nประวัติทั้งหมดยังอยู่ แต่จะเบิกรถคันนี้ไม่ได้ และ QR ของคันนี้จะใช้ไม่ได้ นำกลับมาใช้ได้ภายหลัง', 'นำออก'))) return;
  try {
    await call('setCarActive', { id: id, active: active, pin: S.pin });
    if (S.edit === id) { S.edit = ''; S.carForm = false; }
    toast(active === 'N' ? 'นำรถ ' + c.plate + ' ออกแล้ว' : 'นำรถ ' + c.plate + ' กลับมาใช้แล้ว', 'ok');
    await load(); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('คัดลอกลิงก์แล้ว', 'ok'); }
  catch (e) {
    $('#modal').style.display = 'block';
    $('#modalBody').innerHTML = '<h2>คัดลอกลิงก์</h2><div class="mute" style="font-size:14px">กดค้างที่ลิงก์แล้วเลือกคัดลอก</div><input id="copyBox" readonly value="' + esc(text) + '">';
    $('#copyBox').select();
  }
}
async function cancelTrip(id) {
  var t = S.open.filter(function (x) { return x.id === id; })[0]; if (!t) return;
  var reason = await askConfirm('ยกเลิกการเบิก ' + t.plate + ' ของ ' + t.name + ' (' + thTime(t.ts) + ') รายการนี้จะไม่ถูกนับในรายงาน', 'ยืนยันยกเลิก', true);
  if (!reason) return;
  try { await call('cancelTrip', { id: id, reason: reason, pin: S.pin }); toast('ยกเลิกรายการแล้ว', 'ok'); S.hist = {}; await load(); render(); }
  catch (e) { toast(e.message, 'err'); }
}
async function runReport(btn) {
  var m = ($('#rMonth').value || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m)) return toast('กรุณาเลือกเดือน', 'err');
  S.rmonth = m;
  try { S.reportData = await busyCall(btn, 'monthData', { month: m, pin: S.pin }); S.report = buildReport(m, S.reportData); render(); }
  catch (e) { toast(e.message, 'err'); }
}

// สรุปรายงานรายเดือนจากข้อมูลดิบของเดือนนั้น (ไม่นับรายการที่ยกเลิก)
function buildReport(month, d) {
  var cars = {}, drivers = {};
  var car = function (pl) { return cars[pl] || (cars[pl] = { plate: pl, trips: 0, km: 0, fuel: 0, other: 0, maint: 0 }); };
  var drv = function (n) { return drivers[n] || (drivers[n] = { name: n, trips: 0, km: 0, open: 0 }); };
  d.usage.forEach(function (u) {
    if (u.status === 'cancelled') return;
    var k = u.status === 'closed' && u.odoEnd !== '' ? Number(u.odoEnd) - Number(u.odoStart) : 0;
    var c = car(u.plate); c.trips++; c.km += k;
    var r = drv(u.name || '(ไม่ระบุ)'); r.trips++; r.km += k; if (u.status === 'open') r.open++;
  });
  d.expenses.forEach(function (e) { var c = car(e.plate); if (e.type === 'น้ำมัน') c.fuel += Number(e.amount) || 0; else c.other += Number(e.amount) || 0; });
  d.maint.forEach(function (m) { car(m.plate).maint += Number(m.cost) || 0; });
  var byCar = Object.keys(cars).sort().map(function (k) { var c = cars[k]; c.total = c.fuel + c.other + c.maint; c.perKm = c.km > 0 ? c.total / c.km : null; return c; });
  var totals = byCar.reduce(function (t, c) { ['trips', 'km', 'fuel', 'other', 'maint', 'total'].forEach(function (k) { t[k] += c[k]; }); return t; }, { trips: 0, km: 0, fuel: 0, other: 0, maint: 0, total: 0 });
  totals.perKm = totals.km > 0 ? totals.total / totals.km : null;
  return { month: month, byCar: byCar, byDriver: Object.keys(drivers).map(function (k) { return drivers[k]; }).sort(function (a, b) { return b.km - a.km; }), totals: totals };
}

// ดาวน์โหลดรายงานเป็น Excel (โหลดตัวสร้างไฟล์เมื่อกดเท่านั้น)
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  return new Promise(function (resolve, reject) {
    var sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload = function () { resolve(); }; sc.onerror = function () { reject(new Error('โหลดตัวสร้างไฟล์ Excel ไม่ได้')); };
    document.head.appendChild(sc);
  });
}
async function exportReport(btn) {
  var r = S.report, d = S.reportData; if (!r || !d) return;
  var txt = btn.textContent; btn.disabled = true; btn.textContent = 'กำลังสร้างไฟล์...';
  try {
    await loadXlsx();
    var n2 = function (v) { return v == null ? '' : Math.round(v * 100) / 100; };
    var wb = XLSX.utils.book_new();
    var add = function (name, rows) { var ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = rows[0].map(function () { return { wch: 16 }; }); XLSX.utils.book_append_sheet(wb, ws, name); };
    add('สรุปต่อคัน', [['ทะเบียน', 'จำนวนเที่ยว', 'ระยะทาง (กม.)', 'ค่าน้ำมัน', 'ค่าใช้จ่ายอื่น', 'ค่าซ่อมบำรุง', 'รวม', 'ต้นทุนต่อ กม.']]
      .concat(r.byCar.map(function (c) { return [c.plate, c.trips, c.km, n2(c.fuel), n2(c.other), n2(c.maint), n2(c.total), n2(c.perKm)]; }))
      .concat([['รวม', r.totals.trips, r.totals.km, n2(r.totals.fuel), n2(r.totals.other), n2(r.totals.maint), n2(r.totals.total), n2(r.totals.perKm)]]));
    add('สรุปต่อคนขับ', [['ชื่อ', 'จำนวนเที่ยว', 'ระยะทาง (กม.)', 'ยังไม่คืนรถ']].concat(r.byDriver.map(function (x) { return [x.name, x.trips, x.km, x.open]; })));
    add('รายการใช้รถ', [['เวลาเบิก', 'ทะเบียน', 'ผู้เบิก', 'วัตถุประสงค์', 'ปลายทาง', 'ไมล์ก่อน', 'ไมล์หลัง', 'ระยะทาง', 'เวลาคืน', 'ผู้คืน', 'สถานะ']]
      .concat(d.usage.map(function (u) {
        return [u.ts, u.plate, u.name, u.purpose, u.dest || '', u.odoStart, u.odoEnd, u.odoEnd !== '' ? Number(u.odoEnd) - Number(u.odoStart) : '', u.returnTs, u.returnName,
          u.status === 'open' ? 'ยังไม่คืน' : u.status === 'cancelled' ? 'ยกเลิก' : 'คืนแล้ว'];
      })));
    add('ค่าใช้จ่าย', [['วันที่', 'ทะเบียน', 'ประเภท', 'จำนวนเงิน', 'หมายเหตุ', 'ผู้บันทึก']].concat(d.expenses.map(function (e) { return [e.date, e.plate, e.type, Number(e.amount) || 0, e.note, e.name]; })));
    add('ซ่อมบำรุง', [['วันที่', 'ทะเบียน', 'ประเภท', 'รายละเอียด', 'อู่/ร้าน', 'เลขไมล์', 'ค่าใช้จ่าย', 'ผู้บันทึก']].concat(d.maint.map(function (m) { return [m.date, m.plate, m.type, m.detail, m.shop, m.odo, m.cost, m.name]; })));
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    var url = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'Sirikul-car-report-' + (Number(r.month.slice(0, 4)) + 543) + '-' + r.month.slice(5, 7) + '.xlsx'; // ชื่อไฟล์ภาษาอังกฤษ ดาวน์โหลดได้ทุกเบราว์เซอร์
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    toast('ดาวน์โหลดไฟล์ Excel แล้ว', 'ok');
  } catch (e) { toast(e.message, 'err'); }
  btn.disabled = false; btn.textContent = txt;
}

function hook(sel, action, build, okMsg, after, check) {
  var f = $(sel); if (!f) return;
  f.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (S.busy) return;
    var btn = f.querySelector('button[type=submit]'), orig = btn.textContent;
    var d = {}; new FormData(f).forEach(function (v, k) { if (typeof v === 'string') d[k] = v; });
    var warn = check ? check(d) : '';
    if (warn && !(await askConfirm(warn, 'ถูกต้อง บันทึกต่อ'))) return;
    S.busy = true; btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    try {
      await call(action, build(d));
      if (d.name) { S.name = d.name.trim(); sset('localStorage', 'driverName', S.name); }
      if (d.name && d.phone && d.licenseExp) saveProfile(S.name, d.phone.trim(), d.licenseExp);
      if (action === 'checkout') { S.forceExtra = false; S.drvLic = {}; }
      toast(okMsg || 'บันทึกเรียบร้อย', 'ok');
      after(); await load(); render(); window.scrollTo(0, 0);
    } catch (e) {
      if (action === 'checkout' && /เบอร์โทร|ใบขับขี่/.test(e.message)) { S.forceExtra = true; showDriverExtra('new'); put($('#drvNote'), ''); }
      if (/PIN/.test(e.message)) { S.pin = ''; sset('sessionStorage', 'adminPin', ''); }
      toast(e.message, 'err'); btn.disabled = false; btn.textContent = orig;
    }
    S.busy = false;
  });
}

function carUrl(c) { return PUBLIC_URL + '?car=' + encodeURIComponent(c.id); }
function drawQr() {
  var g = $('#qrgrid'); if (!g || !window.QRCode || !S.appUrl) return;
  S.cars.forEach(function (c) {
    var cell = document.createElement('div'); cell.className = 'qrcell';
    cell.insertAdjacentHTML('beforeend', (S.logo ? logoImg('qlogo') : '') + '<span class="qco">' + esc(S.company) + '</span>');
    var q = document.createElement('div'); q.className = 'q';
    cell.appendChild(q);
    cell.insertAdjacentHTML('beforeend', '<b>' + esc(c.plate) + '</b><small>สแกนเพื่อเบิก/คืนรถ</small>');
    var btn = document.createElement('button');
    btn.className = 'small ghost noprint'; btn.style.marginTop = '8px'; btn.textContent = 'คัดลอกลิงก์';
    btn.addEventListener('click', function () { copyText(carUrl(c)); });
    cell.appendChild(btn);
    g.appendChild(cell);
    new QRCode(q, { text: carUrl(c), width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M });
  });
}

// โหลดข้อมูลดิบ แล้วคำนวณสถานะรถ เลขไมล์ล่าสุด แจ้งเตือน และรายการล่าสุดบนหน้าเว็บ
async function load() {
  var d = await call('data');
  S.company = (d.settings && d.settings.company) || ''; S.logo = (d.settings && d.settings.logo) || '';
  S.pinRequired = !!d.pinRequired; if (!S.pinRequired) S.pin = '';
  S.types = d.expenseTypes; S.mtypes = d.maintTypes;
  S.allUsage = d.usage; S.maint = d.maintenance;
  var last = {};
  d.usage.forEach(function (u) { if (u.status !== 'cancelled') last[u.plate] = u.odoEnd !== '' ? u.odoEnd : u.odoStart; });
  S.cars = d.cars.filter(function (c) { return c.active !== 'N'; }).map(function (c) { c.lastOdo = last[c.plate] == null ? '' : last[c.plate]; return c; });
  S.removed = d.cars.filter(function (c) { return c.active === 'N'; });
  S.open = d.usage.filter(function (u) { return u.status === 'open'; });
  S.usage = d.usage.slice().reverse().slice(0, 10);
  S.allExp = d.expenses; S.expenses = d.expenses.slice().reverse().slice(0, 10);
  S.alerts = buildAlerts(S.cars, S.maint);
  S.known = (d.driverNames || []).map(function (n) { return String(n).trim(); });
  var seen = {}; S.drivers = [];
  d.driverNames.concat(d.usage.slice(-300).map(function (u) { return u.name; })).forEach(function (n) { if (n && !seen[n]) { seen[n] = 1; S.drivers.push(String(n)); } });
  S.appUrl = PUBLIC_URL;
  showWho();
  $('#nav').classList.remove('hide');
}

// แจ้งเตือน พ.ร.บ./ภาษี/ประกัน และกำหนดซ่อมครั้งต่อไป ภายใน 30 วัน
function buildAlerts(cars, maint) {
  var t = today(), limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), out = [], plates = {};
  cars.forEach(function (c) {
    plates[c.plate] = true;
    [['พ.ร.บ.', c.actExp], ['ภาษี', c.taxExp], ['ประกัน', c.insExp]].forEach(function (p) {
      if (p[1] && p[1] <= limit) out.push({ plate: c.plate, what: p[0], date: p[1], expired: p[1] < t });
    });
  });
  var latest = {};
  maint.forEach(function (m) { var k = m.plate + '|' + m.type; if (!latest[k] || m.date >= latest[k].date) latest[k] = m; });
  Object.keys(latest).forEach(function (k) {
    var m = latest[k];
    if (plates[m.plate] && m.nextDate && m.nextDate <= limit) out.push({ plate: m.plate, what: 'ซ่อมบำรุง: ' + m.type, date: m.nextDate, expired: m.nextDate < t });
  });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

$('#palBtn').innerHTML = ic('palette', 18);
$('#palBtn').addEventListener('click', function (e) { e.stopPropagation(); togglePalette(); });
$('#themeBtn').addEventListener('click', function (e) {
  e.stopPropagation();
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
});
initFullscreen();
S.name = sget('localStorage', 'driverName');
try { S.profiles = JSON.parse(sget('localStorage', 'driverProfiles') || '{}') || {}; } catch (e) { S.profiles = {}; }
S.pin = sget('sessionStorage', 'adminPin');
paintIcons();
setTheme(document.documentElement.getAttribute('data-theme'), false);
$('#modalClose').addEventListener('click', function () { $('#modal').style.display = 'none'; });
document.querySelectorAll('nav button').forEach(function (b) {
  b.addEventListener('click', function () { S.tab = b.dataset.t; S.sub = ''; S.lastSheet = ''; render(); window.scrollTo(0, 0); });
});
load().then(function () {
  var hit = ADMIN_MODE ? null : S.cars.filter(function (c) { return (INITIAL_CAR && c.id === INITIAL_CAR) || (!INITIAL_CAR && INITIAL_PLATE && c.plate === INITIAL_PLATE); })[0];
  if (ADMIN_MODE) {}
  else if (hit) {
    S.plate = hit.plate; S.locked = hit.id; S.tab = 'car'; S.sub = '';
    // เปิดเต็มจอเองตอนโหลดไม่ได้ (เบราว์เซอร์บังคับให้ผู้ใช้แตะก่อน) จึงบอกให้แตะ 1 ครั้ง
    if (FS.supported && FS.mobile && FS.auto && !FS.standalone && !isFull()) setTimeout(function () { if (!isFull()) toast('แตะหน้าจอ 1 ครั้งเพื่อเปิดเต็มจอ', 'ok'); }, 600);
  }
  else if (INITIAL_CAR || INITIAL_PLATE) toast('ไม่พบรถคันนี้ในระบบ (อาจถูกนำออกแล้ว) เลือกรถจากหน้าแรกได้', 'err');
  render();
}).catch(function (e) {
  $('#hLeft').innerHTML = '<div class="htitle">เข้าใช้งานไม่ได้</div>';
  $('#app').innerHTML = '<div class="card"><h2>เข้าใช้งานไม่ได้</h2>' + esc(e.message) + '</div>';
});
