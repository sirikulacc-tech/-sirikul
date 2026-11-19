/**
 * ระบบบันทึกรถส่วนกลางศิริกุล
 * - ข้อมูลเก็บใน Google Sheet (สร้างอัตโนมัติด้วย setup())
 * - ใน Drive มีโฟลเดอร์ "รถส่วนกลางศิริกุล" เก็บ Sheet และโฟลเดอร์ย่อย "รูปภาพ" (แยกรายเดือน)
 * - ใครมีลิงก์ก็ใช้ได้ (ไม่ต้องล็อกอิน) คนขับกรอกชื่อเอง
 * - หน้าแอดมิน (จัดการรถ, QR, ค้างเบิก, รายงาน) ยังไม่ต้องใส่รหัส จนกว่าจะรัน enableAdminPin()
 *   รหัสเก็บใน Script Properties: ADMIN_PIN (ไม่มีค่า = ไม่ต้องใส่รหัส)
 */

const TZ = 'Asia/Bangkok';
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ต่อรูป หลัง decode
const MAINT_TYPES = ['เปลี่ยนน้ำมันเครื่อง', 'ยาง', 'แบตเตอรี่', 'เบรก', 'ตรวจเช็คตามระยะ', 'ซ่อมทั่วไป', 'ตรวจสภาพ', 'อื่นๆ'];
const MAX_DOC_BYTES = 6 * 1024 * 1024;
// ค่าซ่อมบำรุงบันทึกที่เมนูซ่อมบำรุง ไม่ซ้ำกับค่าใช้จ่ายทั่วไป
const EXPENSE_TYPES = ['น้ำมัน', 'ล้างรถ', 'ทางด่วน/ที่จอด', 'ภาษี/พ.ร.บ.', 'ประกัน', 'อื่นๆ'];

// ชื่อแท็บ + คอลัมน์ (key ใช้ในโค้ด, h คือหัวตารางที่เห็นใน Sheet)
const SCHEMA = {
  cars: {
    title: 'รถ',
    cols: [
      ['id', 'รหัส'], ['plate', 'ทะเบียน'], ['model', 'ยี่ห้อ/รุ่น'], ['year', 'ปี'], ['color', 'สี'], ['fuel', 'เชื้อเพลิง'],
      ['vin', 'เลขตัวถัง'], ['engineNo', 'เลขเครื่อง'],
      ['actExp', 'พ.ร.บ.หมดอายุ'], ['taxExp', 'ภาษีหมดอายุ'], ['insExp', 'ประกันหมดอายุ'], ['active', 'ใช้งาน'],
      ['regDocId', 'ไฟล์สำเนาทะเบียน (Drive ID)'], ['regDocMime', 'ชนิดไฟล์สำเนาทะเบียน'], ['province', 'จังหวัด'], ['insurer', 'บริษัทประกันภัย']
    ],
    textCols: ['year', 'vin', 'engineNo', 'actExp', 'taxExp', 'insExp']
  },
  usage: {
    title: 'การใช้รถ',
    cols: [
      ['id', 'รหัส'], ['ts', 'เวลาเบิก'], ['plate', 'ทะเบียน'], ['email', 'อีเมล'], ['name', 'ชื่อผู้ใช้'],
      ['odoStart', 'ไมล์ก่อน'], ['odoEnd', 'ไมล์หลัง'], ['purpose', 'วัตถุประสงค์/ปลายทาง'], ['images', 'ลิงก์รูปตอนเบิก'],
      ['returnTs', 'เวลาคืน'], ['returnImages', 'ลิงก์รูปตอนคืน'], ['status', 'สถานะ'], ['returnName', 'ผู้คืนรถ']
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
  maintenance: {
    title: 'ซ่อมบำรุง',
    cols: [
      ['id', 'รหัส'], ['date', 'วันที่'], ['plate', 'ทะเบียน'], ['odo', 'เลขไมล์'], ['type', 'ประเภท'], ['detail', 'รายละเอียด'],
      ['shop', 'อู่/ร้าน'], ['cost', 'ค่าใช้จ่าย'], ['nextDate', 'ครบกำหนดครั้งต่อไป (วันที่)'], ['nextOdo', 'ครบกำหนดครั้งต่อไป (ไมล์)'],
      ['images', 'ลิงก์รูป'], ['email', 'อีเมลผู้บันทึก'], ['name', 'ชื่อผู้บันทึก']
    ],
    textCols: ['date', 'nextDate']
  },
  drivers: {
    title: 'รายชื่อคนขับ',
    cols: [['name', 'ชื่อ'], ['active', 'ใช้งาน (Y/N)'], ['phone', 'เบอร์โทร'], ['licenseExp', 'ใบขับขี่หมดอายุ'], ['updated', 'อัปเดตล่าสุด']],
    textCols: ['phone', 'licenseExp', 'updated']
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
  Logger.log(props.getProperty('ADMIN_PIN')
    ? 'รหัสแอดมิน: เปิดใช้อยู่'
    : 'รหัสแอดมิน: ยังไม่เปิดใช้ (หน้าแอดมินเข้าได้ทุกคน) เมื่อพร้อมใช้งานจริงให้รัน enableAdminPin()');
  Logger.log('Sheet: ' + ss.getUrl());
  Logger.log('Folder: ' + DriveApp.getFolderById(props.getProperty('FOLDER_ID')).getUrl());
}

/* ---------- รหัสแอดมิน (รันมือจากตัวแก้ไข Apps Script) ---------- */
// เปิดใช้รหัสแอดมิน: สร้างรหัส 6 หลักแล้วแสดงใน "บันทึกการดำเนินการ"
// อยากตั้งรหัสเอง: การตั้งค่าโปรเจกต์ → คุณสมบัติของสคริปต์ → แก้ค่า ADMIN_PIN
function enableAdminPin() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PIN')) {
    props.setProperty('ADMIN_PIN', String(Math.floor(100000 + Math.random() * 900000)));
  }
  Logger.log('เปิดใช้รหัสแอดมินแล้ว รหัสคือ: ' + props.getProperty('ADMIN_PIN'));
}

// ปิดรหัสแอดมิน (หน้าแอดมินเข้าได้ทุกคนอีกครั้ง)
function disableAdminPin() {
  PropertiesService.getScriptProperties().deleteProperty('ADMIN_PIN');
  Logger.log('ปิดรหัสแอดมินแล้ว');
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
    payload = payload || {};
    switch (action) {
      case 'bootstrap': return ok_(bootstrap_());
      case 'checkout': return ok_(checkout_(payload));
      case 'returnCar': return ok_(returnCar_(payload));
      case 'addExpense': return ok_(addExpense_(payload));
      case 'carHistory': return ok_(carHistory_(payload));
      case 'addMaintenance': return ok_(addMaintenance_(payload));
      case 'getRegDoc': return ok_(getRegDoc_(payload));
      case 'checkPin': requirePin_(payload.pin); return ok_(true);
      case 'saveCar': requirePin_(payload.pin); return ok_(saveCar_(payload));
      case 'cancelTrip': requirePin_(payload.pin); return ok_(cancelTrip_(payload));
      case 'report': requirePin_(payload.pin); return ok_(report_(payload));
      case 'exportReport': requirePin_(payload.pin); return ok_(exportReport_(payload));
      case 'listDrivers': requirePin_(payload.pin); return ok_(listDrivers_());
      default: throw new Error('ไม่รู้จักคำสั่ง');
    }
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function ok_(data) { return { ok: true, data: data }; }

/* ---------- สิทธิ์ ---------- */
// งานแอดมินเท่านั้นที่ต้องใช้ PIN การใช้งานทั่วไปไม่ต้องล็อกอิน
function requirePin_(pin) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!real) return; // ยังไม่เปิดใช้รหัสแอดมิน
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pinFails') || 0);
  if (fails >= 10) throw new Error('ใส่ PIN ผิดหลายครั้ง กรุณารอ 10 นาที');
  if (String(pin || '') !== real) {
    cache.put('pinFails', String(fails + 1), 600);
    throw new Error('PIN ไม่ถูกต้อง');
  }
}

// ชื่อคนขับที่กรอกมาจากฟอร์ม
function name_(v) {
  const n = str_(v, 60);
  if (!n) throw new Error('กรุณากรอกชื่อผู้ใช้รถ');
  return n;
}

/* ---------- เริ่มต้น ---------- */
function bootstrap_() {
  const usage = readRows_('usage');
  const last = {};
  usage.forEach(function (u) { if (u.status !== 'cancelled') last[u.plate] = u.odoEnd !== '' ? u.odoEnd : u.odoStart; });
  const cars = readRows_('cars').filter(function (c) { return c.active !== 'N'; }).map(function (c) {
    c.lastOdo = last[c.plate] == null ? '' : last[c.plate];
    return c;
  });
  const open = usage.filter(function (u) { return u.status === 'open'; }).map(function (u) {
    return { id: u.id, plate: u.plate, name: u.name, ts: u.ts, odoStart: u.odoStart, purpose: u.purpose };
  });
  return {
    drivers: driverNames_(usage),
    pinRequired: !!PropertiesService.getScriptProperties().getProperty('ADMIN_PIN'),
    cars: cars,
    openTrips: open,
    appUrl: ScriptApp.getService().getUrl(),
    expenseTypes: EXPENSE_TYPES,
    maintTypes: MAINT_TYPES,
    alerts: buildAlerts_(cars, readRows_('maintenance')),
    recentUsage: listUsage_({ limit: 10 }),
    recentExpenses: listExpenses_({ limit: 10 })
  };
}

// รายชื่อให้เลือก: จากแท็บ "รายชื่อคนขับ" + ชื่อที่เคยเบิกรถ
function driverNames_(usage) {
  const seen = {};
  const out = [];
  readRows_('drivers').forEach(function (d) { if (d.active !== 'N' && d.name && !seen[d.name]) { seen[d.name] = 1; out.push(String(d.name)); } });
  usage.slice(-300).forEach(function (u) { if (u.name && !seen[u.name]) { seen[u.name] = 1; out.push(String(u.name)); } });
  return out;
}

function buildAlerts_(cars, maint) {
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const limit = Utilities.formatDate(new Date(Date.now() + 30 * 86400000), TZ, 'yyyy-MM-dd');
  const out = [];
  const plates = {};
  cars.forEach(function (c) {
    plates[c.plate] = true;
    [['พ.ร.บ.', c.actExp], ['ภาษี', c.taxExp], ['ประกัน', c.insExp]].forEach(function (p) {
      if (p[1] && p[1] <= limit) {
        out.push({ plate: c.plate, what: p[0], date: p[1], expired: p[1] < today });
      }
    });
  });
  // ซ่อมบำรุง: ดูเฉพาะรายการล่าสุดของแต่ละทะเบียน+ประเภท
  const latest = {};
  maint.forEach(function (m) {
    const k = m.plate + '|' + m.type;
    if (!latest[k] || m.date >= latest[k].date) latest[k] = m;
  });
  Object.keys(latest).forEach(function (k) {
    const m = latest[k];
    if (plates[m.plate] && m.nextDate && m.nextDate <= limit) {
      out.push({ plate: m.plate, what: 'ซ่อมบำรุง: ' + m.type, date: m.nextDate, expired: m.nextDate < today });
    }
  });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

/* ---------- เบิกรถ / คืนรถ ---------- */
function checkout_(p) {
  const car = findCar_(p.plate);
  const name = name_(p.name);
  const phone = String(p.phone || '').replace(/[^\d]/g, '');
  if (phone.length < 9 || phone.length > 10) throw new Error('กรุณากรอกเบอร์โทร 9-10 หลัก');
  const licenseExp = dateStr_(p.licenseExp);
  const odoStart = num_(p.odoStart, 'ไมล์ก่อน');
  const purpose = str_(p.purpose, 200);
  if (!purpose) throw new Error('กรุณากรอกปลายทาง/วัตถุประสงค์');
  const links = saveImages_(p.images, car.plate, 'เบิกรถ');
  return lock_(function () {
    const held = readRows_('usage').filter(function (u) { return u.plate === car.plate && u.status === 'open'; })[0];
    if (held) throw new Error('รถคันนี้ถูกเบิกโดย ' + held.name + ' เมื่อ ' + String(held.ts).slice(0, 16) + ' ยังไม่ได้คืน');
    const row = {
      id: Utilities.getUuid(), ts: now_(), plate: car.plate, email: '', name: name,
      odoStart: odoStart, odoEnd: '', purpose: purpose, images: links.join('\n'),
      returnTs: '', returnImages: '', status: 'open', returnName: ''
    };
    appendRow_('usage', row);
    upsertDriver_(name, phone, licenseExp);
    return { id: row.id };
  });
}

// เก็บ/อัปเดตเบอร์โทรและวันหมดอายุใบขับขี่ในแท็บ "รายชื่อคนขับ" (เรียกภายใน lock)
function upsertDriver_(name, phone, licenseExp) {
  const d = readRows_('drivers').filter(function (r) { return String(r.name) === name; })[0];
  const rec = { name: name, active: d && d.active === 'N' ? 'N' : 'Y', phone: phone, licenseExp: licenseExp, updated: now_() };
  if (d) writeRow_(sheet_('drivers'), d._row, 'drivers', rec); else appendRow_('drivers', rec);
}

// สำหรับหน้าแอดมินเท่านั้น (มีเบอร์โทร)
function listDrivers_() {
  return readRows_('drivers').map(function (d) {
    return { name: d.name, phone: d.phone, licenseExp: d.licenseExp, active: d.active, updated: d.updated };
  }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'th'); });
}

function returnCar_(p) {
  const name = name_(p.name);
  const odoEnd = num_(p.odoEnd, 'ไมล์หลัง');
  const rows = readRows_('usage');
  const t = rows.filter(function (u) { return u.id === p.id; })[0];
  if (!t) throw new Error('ไม่พบรายการเบิกรถ');
  if (t.status !== 'open') throw new Error('รายการนี้คืนรถไปแล้ว');
  if (odoEnd < Number(t.odoStart)) throw new Error('ไมล์หลังต้องไม่น้อยกว่าไมล์ก่อน (' + t.odoStart + ')');
  const links = saveImages_(p.images, t.plate, 'คืนรถ');
  return lock_(function () {
    const fresh = readRows_('usage').filter(function (u) { return u.id === p.id; })[0];
    if (!fresh || fresh.status !== 'open') throw new Error('รายการนี้คืนรถไปแล้ว');
    fresh.odoEnd = odoEnd;
    fresh.returnTs = now_();
    fresh.returnImages = links.join('\n');
    fresh.status = 'closed';
    fresh.returnName = name;
    writeRow_(sheet_('usage'), fresh._row, 'usage', fresh);
    return { id: fresh.id, km: odoEnd - Number(fresh.odoStart) };
  });
}

function listUsage_(p) {
  const rows = readRows_('usage');
  return rows.reverse().slice(0, Math.min(Number(p.limit) || 50, 200));
}

/* ---------- ค่าใช้จ่าย ---------- */
function addExpense_(p) {
  const car = findCar_(p.plate);
  const name = name_(p.name);
  if (EXPENSE_TYPES.indexOf(p.type) < 0) throw new Error('ประเภทค่าใช้จ่ายไม่ถูกต้อง');
  const amount = num_(p.amount, 'จำนวนเงิน');
  if (amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0');
  const date = dateStr_(p.date);
  const links = saveImages_(p.images, car.plate, 'ค่าใช้จ่าย');
  return lock_(function () {
    const row = {
      id: Utilities.getUuid(), date: date, plate: car.plate, type: p.type, amount: amount,
      note: str_(p.note, 300), images: links.join('\n'), email: '', name: name
    };
    appendRow_('expenses', row);
    return { id: row.id };
  });
}

function listExpenses_(p) {
  const rows = readRows_('expenses');
  return rows.reverse().slice(0, Math.min(Number(p.limit) || 50, 200));
}

/* ---------- จัดการรถ (admin) ---------- */
function saveCar_(p) {
  const plate = str_(p.plate, 20);
  if (!plate) throw new Error('กรุณากรอกทะเบียน');
  const reg = p.regDoc ? saveRegDoc_(p.regDoc, plate) : null;
  return lock_(function () {
    const old = readRows_('cars').filter(function (r) { return r.plate === plate; })[0];
    const rec = old ? Object.assign({}, old) : { id: Utilities.getUuid(), regDocId: '', regDocMime: '' };
    rec.plate = plate;
    rec.province = str_(p.province, 40);
    rec.insurer = str_(p.insurer, 60);
    rec.model = str_(p.model, 80); rec.year = str_(p.year, 4); rec.color = str_(p.color, 30);
    rec.fuel = str_(p.fuel, 30); rec.vin = str_(p.vin, 30); rec.engineNo = str_(p.engineNo, 30);
    rec.actExp = p.actExp ? dateStr_(p.actExp) : '';
    rec.taxExp = p.taxExp ? dateStr_(p.taxExp) : '';
    rec.insExp = p.insExp ? dateStr_(p.insExp) : '';
    rec.active = p.active === 'N' ? 'N' : 'Y';
    if (reg) {
      if (old && old.regDocId) {
        try { DriveApp.getFileById(old.regDocId).setTrashed(true); } catch (e) { /* ไฟล์เดิมอาจถูกลบไปแล้ว */ }
      }
      rec.regDocId = reg.id; rec.regDocMime = reg.mime;
    }
    if (old) writeRow_(sheet_('cars'), old._row, 'cars', rec); else appendRow_('cars', rec);
    return { id: rec.id };
  });
}

/* ---------- สำเนาทะเบียนรถ ---------- */
function saveRegDoc_(dataUrl, plate) {
  const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/.exec(String(dataUrl));
  if (!m) throw new Error('สำเนาทะเบียนต้องเป็นรูปภาพหรือ PDF');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > MAX_DOC_BYTES) throw new Error('ไฟล์สำเนาทะเบียนใหญ่เกิน 6 MB');
  const main = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('MAIN_FOLDER_ID'));
  const dir = getOrCreateFolder_(main, 'เอกสารรถ');
  const ext = m[1] === 'application/pdf' ? 'pdf' : (m[1] === 'image/jpeg' ? 'jpg' : m[1].split('/')[1]);
  const file = dir.createFile(Utilities.newBlob(bytes, m[1], 'สำเนาทะเบียน_' + plate.replace(/[^\wก-๙-]/g, '') + '.' + ext));
  return { id: file.getId(), mime: m[1] };
}

// ทุกคนที่มีลิงก์ดูได้ (คนขับต้องใช้เมื่อถูกตรวจ) รูปส่งผ่านแอป ไม่ต้องแชร์ไฟล์ใน Drive
function getRegDoc_(p) {
  const car = findCar_(p.plate);
  if (!car.regDocId) throw new Error('ยังไม่มีสำเนาทะเบียนของรถคันนี้ ให้แอดมินอัปโหลดในแท็บ "จัดการ"');
  const file = DriveApp.getFileById(car.regDocId);
  const mime = car.regDocMime || file.getMimeType();
  if (mime === 'application/pdf') return { mime: mime, url: file.getUrl() };
  return { mime: mime, dataUrl: 'data:' + mime + ';base64,' + Utilities.base64Encode(file.getBlob().getBytes()) };
}

/* ---------- ยกเลิกรายการเบิกที่ผิด (แอดมิน) ---------- */
function cancelTrip_(p) {
  const reason = str_(p.reason, 150);
  if (!reason) throw new Error('กรุณาระบุเหตุผลที่ยกเลิก');
  return lock_(function () {
    const t = readRows_('usage').filter(function (u) { return u.id === p.id; })[0];
    if (!t) throw new Error('ไม่พบรายการ');
    if (t.status !== 'open') throw new Error('ยกเลิกได้เฉพาะรายการที่ยังไม่คืนรถ');
    t.status = 'cancelled';
    t.returnTs = now_();
    t.returnName = 'ยกเลิก: ' + reason;
    writeRow_(sheet_('usage'), t._row, 'usage', t);
    return { id: t.id };
  });
}

/* ---------- รายงานรายเดือน (แอดมิน) ---------- */
function monthData_(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) throw new Error('เดือนไม่ถูกต้อง');
  const inM = function (v) { return String(v || '').slice(0, 7) === month; };
  return {
    usage: readRows_('usage').filter(function (u) { return inM(u.ts) && u.status !== 'cancelled'; }),
    expenses: readRows_('expenses').filter(function (e) { return inM(e.date); }),
    maint: readRows_('maintenance').filter(function (m) { return inM(m.date); })
  };
}

function report_(p) {
  const d = monthData_(p.month);
  const cars = {}, drivers = {};
  const car = function (pl) { return cars[pl] || (cars[pl] = { plate: pl, trips: 0, km: 0, fuel: 0, other: 0, maint: 0 }); };
  const drv = function (n) { return drivers[n] || (drivers[n] = { name: n, trips: 0, km: 0, open: 0 }); };
  d.usage.forEach(function (u) {
    const km = u.status === 'closed' && u.odoEnd !== '' ? Number(u.odoEnd) - Number(u.odoStart) : 0;
    const c = car(u.plate); c.trips++; c.km += km;
    const r = drv(u.name || '(ไม่ระบุ)'); r.trips++; r.km += km; if (u.status === 'open') r.open++;
  });
  d.expenses.forEach(function (e) {
    const c = car(e.plate);
    if (e.type === 'น้ำมัน') c.fuel += Number(e.amount) || 0; else c.other += Number(e.amount) || 0;
  });
  d.maint.forEach(function (m) { car(m.plate).maint += Number(m.cost) || 0; });
  const byCar = Object.keys(cars).sort().map(function (k) {
    const c = cars[k];
    c.total = c.fuel + c.other + c.maint;
    c.perKm = c.km > 0 ? c.total / c.km : null;
    return c;
  });
  const byDriver = Object.keys(drivers).map(function (k) { return drivers[k]; })
    .sort(function (a, b) { return b.km - a.km; });
  const totals = byCar.reduce(function (t, c) {
    ['trips', 'km', 'fuel', 'other', 'maint', 'total'].forEach(function (k) { t[k] += c[k]; });
    return t;
  }, { trips: 0, km: 0, fuel: 0, other: 0, maint: 0, total: 0 });
  totals.perKm = totals.km > 0 ? totals.total / totals.km : null;
  return { month: p.month, byCar: byCar, byDriver: byDriver, totals: totals };
}

// สร้างไฟล์ Google Sheet รายงานในโฟลเดอร์ "รายงาน" (เปิดแล้วดาวน์โหลดเป็น Excel ได้)
function exportReport_(p) {
  const r = report_(p);
  const d = monthData_(p.month);
  const main = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('MAIN_FOLDER_ID'));
  const dir = getOrCreateFolder_(main, 'รายงาน');
  const name = 'รายงานรถส่วนกลาง ' + (Number(p.month.slice(0, 4)) + 543) + '-' + p.month.slice(5, 7);
  const old = dir.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  const ss = SpreadsheetApp.create(name);
  DriveApp.getFileById(ss.getId()).moveTo(dir);
  const n2 = function (v) { return v == null ? '' : Math.round(v * 100) / 100; };
  writeTable_(ss.getSheets()[0], 'สรุปต่อคัน',
    ['ทะเบียน', 'จำนวนเที่ยว', 'ระยะทาง (กม.)', 'ค่าน้ำมัน', 'ค่าใช้จ่ายอื่น', 'ค่าซ่อมบำรุง', 'รวม', 'ต้นทุนต่อ กม.'],
    r.byCar.map(function (c) { return [c.plate, c.trips, c.km, n2(c.fuel), n2(c.other), n2(c.maint), n2(c.total), n2(c.perKm)]; })
      .concat([['รวม', r.totals.trips, r.totals.km, n2(r.totals.fuel), n2(r.totals.other), n2(r.totals.maint), n2(r.totals.total), n2(r.totals.perKm)]]));
  writeTable_(ss.insertSheet(), 'สรุปต่อคนขับ', ['ชื่อ', 'จำนวนเที่ยว', 'ระยะทาง (กม.)', 'ยังไม่คืนรถ'],
    r.byDriver.map(function (x) { return [x.name, x.trips, x.km, x.open]; }));
  writeTable_(ss.insertSheet(), 'รายการใช้รถ', ['เวลาเบิก', 'ทะเบียน', 'ผู้เบิก', 'ไปที่ไหน/ทำอะไร', 'ไมล์ก่อน', 'ไมล์หลัง', 'ระยะทาง', 'เวลาคืน', 'ผู้คืน', 'สถานะ'],
    d.usage.map(function (u) {
      return [u.ts, u.plate, u.name, u.purpose, u.odoStart, u.odoEnd, u.odoEnd !== '' ? Number(u.odoEnd) - Number(u.odoStart) : '',
        u.returnTs, u.returnName, u.status === 'open' ? 'ยังไม่คืน' : 'คืนแล้ว'];
    }));
  writeTable_(ss.insertSheet(), 'ค่าใช้จ่าย', ['วันที่', 'ทะเบียน', 'ประเภท', 'จำนวนเงิน', 'หมายเหตุ', 'ผู้บันทึก'],
    d.expenses.map(function (e) { return [e.date, e.plate, e.type, Number(e.amount) || 0, e.note, e.name]; }));
  writeTable_(ss.insertSheet(), 'ซ่อมบำรุง', ['วันที่', 'ทะเบียน', 'ประเภท', 'รายละเอียด', 'อู่/ร้าน', 'เลขไมล์', 'ค่าใช้จ่าย', 'ผู้บันทึก'],
    d.maint.map(function (m) { return [m.date, m.plate, m.type, m.detail, m.shop, m.odo, m.cost, m.name]; }));
  return { url: ss.getUrl(), name: name };
}

function writeTable_(sh, title, header, rows) {
  sh.setName(title);
  const all = [header].concat(rows);
  sh.getRange(1, 1, all.length, header.length).setValues(all);
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#e8f0fe');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
}

/* ---------- ประวัติรถ / ซ่อมบำรุง ---------- */
// ทุกคนที่มีลิงก์ดูประวัติการใช้และซ่อมบำรุงของรถแต่ละคันได้
function carHistory_(p) {
  const car = findCar_(p.plate);
  const usage = readRows_('usage').filter(function (u) { return u.plate === car.plate; }).reverse().slice(0, 100)
    .map(function (u) {
      return { ts: u.ts, name: u.name, odoStart: u.odoStart, odoEnd: u.odoEnd, purpose: u.purpose,
        returnTs: u.returnTs, status: u.status, images: u.images, returnImages: u.returnImages, returnName: u.returnName };
    });
  const maint = readRows_('maintenance').filter(function (m) { return m.plate === car.plate; })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 100)
    .map(function (m) {
      return { date: m.date, odo: m.odo, type: m.type, detail: m.detail, shop: m.shop, cost: m.cost,
        nextDate: m.nextDate, nextOdo: m.nextOdo, images: m.images, name: m.name };
    });
  return { usage: usage, maint: maint };
}

function addMaintenance_(p) {
  const car = findCar_(p.plate);
  const name = name_(p.name);
  if (MAINT_TYPES.indexOf(p.type) < 0) throw new Error('ประเภทไม่ถูกต้อง');
  const detail = str_(p.detail, 300);
  if (!detail) throw new Error('กรุณากรอกรายละเอียด');
  const links = saveImages_(p.images, car.plate, 'ซ่อมบำรุง');
  return lock_(function () {
    const row = {
      id: Utilities.getUuid(), date: dateStr_(p.date), plate: car.plate,
      odo: p.odo === '' || p.odo == null ? '' : num_(p.odo, 'เลขไมล์'),
      type: p.type, detail: detail, shop: str_(p.shop, 100),
      cost: p.cost === '' || p.cost == null ? '' : num_(p.cost, 'ค่าใช้จ่าย'),
      nextDate: p.nextDate ? dateStr_(p.nextDate) : '',
      nextOdo: p.nextOdo === '' || p.nextOdo == null ? '' : num_(p.nextOdo, 'ไมล์ครั้งต่อไป'),
      images: links.join('\n'), email: '', name: name
    };
    appendRow_('maintenance', row);
    return { id: row.id };
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
