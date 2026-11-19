/**
 * ระบบบันทึกรถส่วนกลางศิริกุล
 * - ข้อมูลเก็บใน Google Sheet (สร้างอัตโนมัติด้วย setup())
 * - ใน Drive มีโฟลเดอร์ "รถส่วนกลางศิริกุล" เก็บ Sheet และโฟลเดอร์ย่อย "รูปภาพ" (แยกรายเดือน)
 * - สิทธิ์: staff (บันทึก) / manager (ดูทั้งหมด) / admin (จัดการรถและผู้ใช้)
 */

const TZ = 'Asia/Bangkok';
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ต่อรูป หลัง decode
const EXPENSE_TYPES = ['น้ำมัน', 'ซ่อมบำรุง', 'ล้างรถ', 'ทางด่วน/ที่จอด', 'ภาษี/พ.ร.บ.', 'ประกัน', 'อื่นๆ'];

// ชื่อแท็บ + คอลัมน์ (key ใช้ในโค้ด, h คือหัวตารางที่เห็นใน Sheet)
const SCHEMA = {
  cars: {
    title: 'รถ',
    cols: [
      ['id', 'รหัส'], ['plate', 'ทะเบียน'], ['model', 'ยี่ห้อ/รุ่น'], ['year', 'ปี'],
      ['actExp', 'พ.ร.บ.หมดอายุ'], ['taxExp', 'ภาษีหมดอายุ'], ['insExp', 'ประกันหมดอายุ'], ['active', 'ใช้งาน']
    ],
    textCols: ['actExp', 'taxExp', 'insExp']
  },
  usage: {
    title: 'การใช้รถ',
    cols: [
      ['id', 'รหัส'], ['ts', 'เวลาเบิก'], ['plate', 'ทะเบียน'], ['email', 'อีเมล'], ['name', 'ชื่อผู้ใช้'],
      ['odoStart', 'ไมล์ก่อน'], ['odoEnd', 'ไมล์หลัง'], ['purpose', 'วัตถุประสงค์/ปลายทาง'], ['images', 'ลิงก์รูปตอนเบิก'],
      ['returnTs', 'เวลาคืน'], ['returnImages', 'ลิงก์รูปตอนคืน'], ['status', 'สถานะ']
    ],
    textCols: ['ts', 'returnTs']
  },
  expenses: {
    title: 'ค่าใช้จ่าย',
    cols: [
      ['id', 'รหัส'], ['date', 'วันที่'], ['plate', 'ทะเบียน'], ['type', 'ประเภท'], ['amount', 'จำนวนเงิน'],
      ['note', 'หมายเหตุ'], ['images', 'ลิงก์รูป'], ['email', 'อีเมลผู้บันทึก'], ['name', 'ชื่อผู้บันทึก']
    ],
    textCols: ['date']
  },
  users: {
    title: 'ผู้ใช้',
    cols: [['email', 'อีเมล'], ['name', 'ชื่อ'], ['role', 'สิทธิ์'], ['active', 'ใช้งาน']],
    textCols: []
  }
};

/* ---------- ติดตั้งครั้งแรก (รันมือครั้งเดียวจากตัวแก้ไข Apps Script) ---------- */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  if (props.getProperty('SHEET_ID')) {
    ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  } else {
    ss = SpreadsheetApp.create('รถส่วนกลางศิริกุล - ข้อมูล');
    props.setProperty('SHEET_ID', ss.getId());
  }
  Object.keys(SCHEMA).forEach(function (k) {
    const s = SCHEMA[k];
    let sh = ss.getSheetByName(s.title);
    if (!sh) sh = ss.insertSheet(s.title);
    sh.getRange(1, 1, 1, s.cols.length).setValues([s.cols.map(function (c) { return c[1]; })])
      .setFontWeight('bold').setBackground('#e8f0fe');
    sh.setFrozenRows(1);
    s.cols.forEach(function (c, i) {
      if (s.textCols.indexOf(c[0]) >= 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });
  const first = ss.getSheets()[0];
  if (first.getName() === 'Sheet1' || first.getName() === 'ชีต1') ss.deleteSheet(first);

  // โฟลเดอร์หลัก "รถส่วนกลางศิริกุล" ใน Drive เก็บทั้ง Sheet และโฟลเดอร์ย่อย "รูปภาพ"
  let main;
  if (props.getProperty('MAIN_FOLDER_ID')) {
    main = DriveApp.getFolderById(props.getProperty('MAIN_FOLDER_ID'));
  } else {
    main = DriveApp.createFolder('รถส่วนกลางศิริกุล');
    props.setProperty('MAIN_FOLDER_ID', main.getId());
  }
  if (!props.getProperty('FOLDER_ID')) {
    props.setProperty('FOLDER_ID', main.createFolder('รูปภาพ').getId());
  }
  const sheetFile = DriveApp.getFileById(ss.getId());
  if (!main.getFilesByName(sheetFile.getName()).hasNext()) sheetFile.moveTo(main);
  // ผู้ติดตั้งเป็นแอดมินคนแรก
  const me = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (me && readRows_('users').length === 0) {
    appendRow_('users', { email: me, name: 'แอดมิน', role: 'admin', active: 'Y' });
  }
  Logger.log('Sheet: ' + ss.getUrl());
  Logger.log('Folder: ' + DriveApp.getFolderById(props.getProperty('FOLDER_ID')).getUrl());
}

/* ---------- Web app ---------- */
function doGet(e) {
  // ทะเบียนจาก QR (?plate=...) กรองเหลือเฉพาะตัวอักษรที่ปลอดภัยก่อนฝังลงหน้า
  const plate = String((e && e.parameter && e.parameter.plate) || '').replace(/[^\wก-๙\- ]/g, '').slice(0, 20);
  const t = HtmlService.createTemplateFromFile('index');
  t.initialPlate = plate;
  return t.evaluate()
    .setTitle('รถส่วนกลางศิริกุล')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// จุดเรียกเดียวจากหน้าเว็บ: google.script.run.api(action, payload)
function api(action, payload) {
  try {
    const me = currentUser_();
    payload = payload || {};
    switch (action) {
      case 'bootstrap': return ok_(bootstrap_(me));
      case 'checkout': return ok_(checkout_(me, payload));
      case 'returnCar': return ok_(returnCar_(me, payload));
      case 'addExpense': return ok_(addExpense_(me, payload));
      case 'saveCar': requireRole_(me, ['admin']); return ok_(saveCar_(payload));
      case 'listUsage': return ok_(listUsage_(me, payload));
      case 'listExpenses': return ok_(listExpenses_(me, payload));
      default: throw new Error('ไม่รู้จักคำสั่ง');
    }
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function ok_(data) { return { ok: true, data: data }; }

/* ---------- สิทธิ์ ---------- */
function currentUser_() {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) throw new Error('อ่านอีเมลผู้ใช้ไม่ได้ กรุณาเข้าด้วยบัญชี Google ขององค์กร');
  const u = readRows_('users').filter(function (r) { return r.email.toLowerCase() === email && r.active !== 'N'; })[0];
  if (!u) throw new Error('บัญชี ' + email + ' ยังไม่ได้รับสิทธิ์ ติดต่อแอดมินเพื่อเพิ่มในแท็บ "ผู้ใช้"');
  return { email: email, name: u.name || email, role: u.role || 'staff' };
}

function requireRole_(me, roles) {
  if (roles.indexOf(me.role) < 0) throw new Error('ไม่มีสิทธิ์ทำรายการนี้');
}

function isManager_(me) { return me.role === 'manager' || me.role === 'admin'; }

/* ---------- เริ่มต้น ---------- */
function bootstrap_(me) {
  const usage = readRows_('usage');
  const last = {};
  usage.forEach(function (u) { last[u.plate] = u.odoEnd !== '' ? u.odoEnd : u.odoStart; });
  const cars = readRows_('cars').filter(function (c) { return c.active !== 'N'; }).map(function (c) {
    c.lastOdo = last[c.plate] == null ? '' : last[c.plate];
    return c;
  });
  const open = usage.filter(function (u) { return u.status === 'open'; }).map(function (u) {
    return { id: u.id, plate: u.plate, name: u.name, email: u.email, ts: u.ts, odoStart: u.odoStart, purpose: u.purpose };
  });
  return {
    me: me,
    cars: cars,
    openTrips: open,
    appUrl: ScriptApp.getService().getUrl(),
    expenseTypes: EXPENSE_TYPES,
    alerts: isManager_(me) ? buildAlerts_(cars) : [],
    recentUsage: listUsage_(me, { limit: 10 }),
    recentExpenses: listExpenses_(me, { limit: 10 })
  };
}

function buildAlerts_(cars) {
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const limit = Utilities.formatDate(new Date(Date.now() + 30 * 86400000), TZ, 'yyyy-MM-dd');
  const out = [];
  cars.forEach(function (c) {
    [['พ.ร.บ.', c.actExp], ['ภาษี', c.taxExp], ['ประกัน', c.insExp]].forEach(function (p) {
      if (p[1] && p[1] <= limit) {
        out.push({ plate: c.plate, what: p[0], date: p[1], expired: p[1] < today });
      }
    });
  });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

/* ---------- เบิกรถ / คืนรถ ---------- */
function checkout_(me, p) {
  const car = findCar_(p.plate);
  const odoStart = num_(p.odoStart, 'ไมล์ก่อน');
  const purpose = str_(p.purpose, 200);
  if (!purpose) throw new Error('กรุณากรอกปลายทาง/วัตถุประสงค์');
  const links = saveImages_(p.images, car.plate, 'เบิกรถ');
  return lock_(function () {
    const held = readRows_('usage').filter(function (u) { return u.plate === car.plate && u.status === 'open'; })[0];
    if (held) throw new Error('รถคันนี้ถูกเบิกโดย ' + held.name + ' เมื่อ ' + String(held.ts).slice(0, 16) + ' ยังไม่ได้คืน');
    const row = {
      id: Utilities.getUuid(), ts: now_(), plate: car.plate, email: me.email, name: me.name,
      odoStart: odoStart, odoEnd: '', purpose: purpose, images: links.join('\n'),
      returnTs: '', returnImages: '', status: 'open'
    };
    appendRow_('usage', row);
    return { id: row.id };
  });
}

function returnCar_(me, p) {
  const odoEnd = num_(p.odoEnd, 'ไมล์หลัง');
  const rows = readRows_('usage');
  const t = rows.filter(function (u) { return u.id === p.id; })[0];
  if (!t) throw new Error('ไม่พบรายการเบิกรถ');
  if (t.status !== 'open') throw new Error('รายการนี้คืนรถไปแล้ว');
  if (t.email !== me.email && !isManager_(me)) throw new Error('คืนรถได้เฉพาะผู้เบิกหรือผู้จัดการ');
  if (odoEnd < Number(t.odoStart)) throw new Error('ไมล์หลังต้องไม่น้อยกว่าไมล์ก่อน (' + t.odoStart + ')');
  const links = saveImages_(p.images, t.plate, 'คืนรถ');
  return lock_(function () {
    const fresh = readRows_('usage').filter(function (u) { return u.id === p.id; })[0];
    if (!fresh || fresh.status !== 'open') throw new Error('รายการนี้คืนรถไปแล้ว');
    fresh.odoEnd = odoEnd;
    fresh.returnTs = now_();
    fresh.returnImages = links.join('\n');
    fresh.status = 'closed';
    writeRow_(sheet_('usage'), fresh._row, 'usage', fresh);
    return { id: fresh.id, km: odoEnd - Number(fresh.odoStart) };
  });
}

function listUsage_(me, p) {
  let rows = readRows_('usage');
  if (!isManager_(me)) rows = rows.filter(function (r) { return r.email === me.email; });
  return rows.reverse().slice(0, Math.min(Number(p.limit) || 50, 200));
}

/* ---------- ค่าใช้จ่าย ---------- */
function addExpense_(me, p) {
  const car = findCar_(p.plate);
  if (EXPENSE_TYPES.indexOf(p.type) < 0) throw new Error('ประเภทค่าใช้จ่ายไม่ถูกต้อง');
  const amount = num_(p.amount, 'จำนวนเงิน');
  if (amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0');
  const date = dateStr_(p.date);
  const links = saveImages_(p.images, car.plate, 'ค่าใช้จ่าย');
  return lock_(function () {
    const row = {
      id: Utilities.getUuid(), date: date, plate: car.plate, type: p.type, amount: amount,
      note: str_(p.note, 300), images: links.join('\n'), email: me.email, name: me.name
    };
    appendRow_('expenses', row);
    return { id: row.id };
  });
}

function listExpenses_(me, p) {
  let rows = readRows_('expenses');
  if (!isManager_(me)) rows = rows.filter(function (r) { return r.email === me.email; });
  return rows.reverse().slice(0, Math.min(Number(p.limit) || 50, 200));
}

/* ---------- จัดการรถ (admin) ---------- */
function saveCar_(p) {
  const plate = str_(p.plate, 20);
  if (!plate) throw new Error('กรุณากรอกทะเบียน');
  const rec = {
    plate: plate, model: str_(p.model, 80), year: str_(p.year, 4),
    actExp: p.actExp ? dateStr_(p.actExp) : '', taxExp: p.taxExp ? dateStr_(p.taxExp) : '',
    insExp: p.insExp ? dateStr_(p.insExp) : '', active: p.active === 'N' ? 'N' : 'Y'
  };
  return lock_(function () {
    const sh = sheet_('cars');
    const rows = readRows_('cars');
    const idx = rows.findIndex(function (r) { return r.plate === plate; });
    if (idx >= 0) {
      rec.id = rows[idx].id;
      writeRow_(sh, rows[idx]._row, 'cars', rec);
    } else {
      rec.id = Utilities.getUuid();
      appendRow_('cars', rec);
    }
    return { id: rec.id };
  });
}

/* ---------- รูปภาพ ---------- */
function saveImages_(images, plate, kind) {
  images = images || [];
  if (images.length > MAX_IMAGES) throw new Error('แนบรูปได้ไม่เกิน ' + MAX_IMAGES + ' รูป');
  if (!images.length) return [];
  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
  const sub = getOrCreateFolder_(root, Utilities.formatDate(new Date(), TZ, 'yyyy-MM'));
  return images.map(function (dataUrl, i) {
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(dataUrl));
    if (!m) throw new Error('ไฟล์รูปไม่ถูกต้อง');
    const bytes = Utilities.base64Decode(m[2]);
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error('รูปที่ ' + (i + 1) + ' ใหญ่เกินไป');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const name = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmmss') + '_' + kind + '_' +
      plate.replace(/[^\wก-๙-]/g, '') + '_' + (i + 1) + '.' + ext;
    return sub.createFile(Utilities.newBlob(bytes, 'image/' + m[1], name)).getUrl();
  });
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/* ---------- ตัวช่วยเกี่ยวกับ Sheet ---------- */
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('ยังไม่ได้รัน setup()');
  return SpreadsheetApp.openById(id);
}

function sheet_(key) { return ss_().getSheetByName(SCHEMA[key].title); }

function readRows_(key) {
  const sc = SCHEMA[key];
  const sh = sheet_(key);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, sc.cols.length).getValues();
  const out = [];
  vals.forEach(function (r, n) {
    if (r[0] === '') return;
    const o = { _row: n + 2 };
    sc.cols.forEach(function (c, i) {
      const v = r[i];
      o[c[0]] = v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : v;
    });
    out.push(o);
  });
  return out;
}

function toArray_(key, obj) {
  return SCHEMA[key].cols.map(function (c) {
    const v = obj[c[0]];
    return v == null ? '' : v;
  });
}

function appendRow_(key, obj) {
  const sh = sheet_(key);
  const row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, SCHEMA[key].cols.length).setValues([toArray_(key, obj)]);
}

function writeRow_(sh, rowNo, key, obj) {
  sh.getRange(rowNo, 1, 1, SCHEMA[key].cols.length).setValues([toArray_(key, obj)]);
}

function findCar_(plate) {
  const car = readRows_('cars').filter(function (c) { return c.plate === plate && c.active !== 'N'; })[0];
  if (!car) throw new Error('ไม่พบรถทะเบียน ' + plate);
  return car;
}

function lock_(fn) {
  const l = LockService.getScriptLock();
  l.waitLock(20000);
  try { return fn(); } finally { l.releaseLock(); }
}

/* ---------- ตรวจข้อมูล ---------- */
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }

function num_(v, label) {
  const n = Number(v);
  if (v === '' || v == null || !isFinite(n) || n < 0) throw new Error(label + ' ไม่ถูกต้อง');
  return n;
}

function str_(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }

function dateStr_(v) {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s).getTime())) throw new Error('วันที่ไม่ถูกต้อง');
  return s;
}
