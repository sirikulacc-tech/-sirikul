/**
 * ระบบรถส่วนกลางศิริกุล — ส่วนหลังบ้าน (ประตูเก็บข้อมูล)
 * - หน้าเว็บและการคำนวณทั้งหมดอยู่บน GitHub Pages: https://sirikulacc-tech.github.io/-sirikul/
 * - ไฟล์นี้ทำหน้าที่: อ่าน/เขียน Google Sheet, เก็บรูปลง Drive, และตรวจกฎที่เลี่ยงไม่ได้
 *   (กันเบิกซ้อน, รหัสแอดมิน, ตรวจข้อมูลก่อนบันทึก, ไม่มีคำสั่งลบข้อมูล)
 * - ข้อมูลเก็บใน Google Sheet (สร้างอัตโนมัติด้วย setup())
 * - ใน Drive มีโฟลเดอร์ "รถส่วนกลางศิริกุล" เก็บ Sheet และโฟลเดอร์ย่อย "รูปภาพ" (แยกรายเดือน)
 * - ใครมีลิงก์ก็ใช้ได้ (ไม่ต้องล็อกอิน) คนขับกรอกชื่อเอง
 * - หน้าแอดมิน (จัดการรถ, QR, ค้างเบิก, รายงาน) ยังไม่ต้องใส่รหัส จนกว่าจะรัน enableAdminPin()
 *   รหัสเก็บใน Script Properties: ADMIN_PIN (ไม่มีค่า = ไม่ต้องใส่รหัส)
 */

const TZ = 'Asia/Bangkok';
const PUBLIC_URL = 'https://sirikulacc-tech.github.io/-sirikul/'; // ที่อยู่หน้าเว็บของระบบ
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ต่อรูป หลัง decode
const MAINT_TYPES = ['เปลี่ยนน้ำมันเครื่อง', 'ยาง', 'แบตเตอรี่', 'เบรก', 'ตรวจเช็คตามระยะ', 'ซ่อมทั่วไป', 'ตรวจสภาพ', 'อื่นๆ'];
const MAX_DOC_BYTES = 6 * 1024 * 1024;
// ค่าซ่อมบำรุงบันทึกที่เมนูซ่อมบำรุง ไม่ซ้ำกับค่าใช้จ่ายทั่วไป
const PLATE_COLORS = ['black', 'green', 'blue', 'red']; // ขาว-ดำ / ขาว-เขียว / ขาว-น้ำเงิน / ป้ายแดง
const EXPENSE_TYPES = ['น้ำมัน', 'ล้างรถ', 'ทางด่วน/ที่จอด', 'ภาษี/พ.ร.บ.', 'ประกัน', 'อื่นๆ'];

// ชื่อแท็บ + คอลัมน์ (key ใช้ในโค้ด, h คือหัวตารางที่เห็นใน Sheet)
const SCHEMA = {
  cars: {
    title: 'รถ',
    cols: [
      ['id', 'รหัส'], ['plate', 'ทะเบียน'], ['model', 'ยี่ห้อ/รุ่น'], ['year', 'ปี'], ['color', 'สี'], ['fuel', 'เชื้อเพลิง'],
      ['vin', 'เลขตัวถัง'], ['engineNo', 'เลขเครื่อง'],
      ['actExp', 'พ.ร.บ.หมดอายุ'], ['taxExp', 'ภาษีหมดอายุ'], ['insExp', 'ประกันหมดอายุ'], ['active', 'ใช้งาน'],
      ['regDocId', 'ไฟล์สำเนาทะเบียน (Drive ID)'], ['regDocMime', 'ชนิดไฟล์สำเนาทะเบียน'], ['province', 'จังหวัด'], ['insurer', 'บริษัทประกันภัย'], ['vtype', 'ประเภทรถ'], ['plateColor', 'สีป้ายทะเบียน'],
      ['insClass', 'ประเภท/ชั้นประกันภัย'], ['insPolicyNo', 'เลขกรมธรรม์'], ['insStart', 'ประกันเริ่มคุ้มครอง'], ['insSum', 'ทุนประกัน'], ['insPremium', 'เบี้ยประกันรวม'],
      ['insDeduct', 'ค่าเสียหายส่วนแรก'], ['insRepair', 'ซ่อมห้าง/ซ่อมอู่'], ['insAgent', 'ตัวแทน/นายหน้า'], ['insPhone', 'เบอร์แจ้งเหตุ/ตัวแทน'], ['insNote', 'หมายเหตุประกันภัย'],
      ['insDocId', 'ไฟล์กรมธรรม์ (Drive ID)'], ['insDocMime', 'ชนิดไฟล์กรมธรรม์'], ['useMode', 'การเบิกใช้ (pool/exec/free)']
    ],
    textCols: ['year', 'vin', 'engineNo', 'actExp', 'taxExp', 'insExp', 'insPolicyNo', 'insStart', 'insPhone']
  },
  usage: {
    title: 'การใช้รถ',
    cols: [
      ['id', 'รหัส'], ['ts', 'เวลาเบิก'], ['plate', 'ทะเบียน'], ['email', 'อีเมล'], ['name', 'ชื่อผู้ใช้'],
      ['odoStart', 'ไมล์ก่อน'], ['odoEnd', 'ไมล์หลัง'], ['purpose', 'วัตถุประสงค์/ปลายทาง'], ['images', 'ลิงก์รูปตอนเบิก'],
      ['returnTs', 'เวลาคืน'], ['returnImages', 'ลิงก์รูปตอนคืน'], ['status', 'สถานะ'], ['returnName', 'ผู้คืนรถ'], ['dest', 'ปลายทาง']
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
      .setFontWeight('bold').setBackground('#e8f6de');
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
  // หน้าเว็บย้ายไป GitHub Pages แล้ว ลิงก์นี้พาไปหน้าใหม่ (ส่งต่อ ?car= / ?admin= ให้ด้วย)
  const q = (e && e.parameter) || {};
  const qs = ['car', 'plate', 'admin'].filter(function (k) { return q[k]; })
    .map(function (k) { return k + '=' + encodeURIComponent(String(q[k]).slice(0, 40)); }).join('&');
  const url = PUBLIC_URL + (qs ? '?' + qs : '');
  return HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;text-align:center;padding:40px 16px">' +
    '<h2>ระบบรถส่วนกลางศิริกุลย้ายไปที่ลิงก์ใหม่</h2>' +
    '<p><a href="' + url + '" target="_top" style="font-size:20px">กดที่นี่เพื่อเปิดระบบ</a></p></div>')
    .setTitle('รถส่วนกลางศิริกุล')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// หน้าเว็บบน GitHub Pages เรียกผ่าน POST (ส่งแบบ text/plain ไม่ต้องใช้บัญชี Google)
// body: {"action": "...", "payload": {...}}  ตอบกลับเป็น JSON {ok, data|error}
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = api(String(req.action || ''), req.payload || {});
  } catch (err) {
    out = { ok: false, error: 'คำขอไม่ถูกต้อง' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// จุดเรียกเดียวจากหน้าเว็บ: google.script.run.api(action, payload) หรือ doPost
function api(action, payload) {
  try {
    payload = payload || {};
    switch (action) {
      // อ่านข้อมูล (หน้าเว็บนำไปคำนวณเอง)
      case 'data': return ok_(data_());
      case 'getRegDoc': return ok_(getRegDoc_(payload));
      case 'getPolicyDoc': return ok_(getPolicyDoc_(payload));
      case 'driverCheck': return ok_(driverCheck_(payload));
      case 'dataVer': return ok_({ ver: dataVer_() });
      case 'registerDriver': return ok_(registerDriver_(payload));
      // บันทึกของคนขับ
      case 'checkout': return ok_(checkout_(payload));
      case 'returnCar': return ok_(returnCar_(payload));
      case 'addExpense': return ok_(addExpense_(payload));
      case 'addMaintenance': return ok_(addMaintenance_(payload));
      // งานแอดมิน (ต้องผ่านรหัสแอดมินเมื่อเปิดใช้)
      case 'checkPin': requirePin_(payload.pin); return ok_(true);
      case 'monthData': requirePin_(payload.pin); return ok_(monthDataClean_(payload.month));
      case 'listDrivers': requirePin_(payload.pin); return ok_(listDrivers_());
      case 'saveDriver': requirePin_(payload.pin); return ok_(saveDriver_(payload));
      case 'setDriverActive': requirePin_(payload.pin); return ok_(setDriverActive_(payload));
      case 'saveCar': requirePin_(payload.pin); return ok_(saveCar_(payload));
      case 'carPrivate': requirePin_(payload.pin); return ok_(carPrivate_());
      case 'setCarActive': requirePin_(payload.pin); return ok_(setCarActive_(payload));
      case 'setCarModes': requirePin_(payload.pin); return ok_(setCarModes_(payload));
      case 'cancelTrip': requirePin_(payload.pin); return ok_(cancelTrip_(payload));
      case 'saveSettings': requirePin_(payload.pin); return ok_(saveSettings_(payload));
      case 'ocrRegDoc': requirePin_(payload.pin); return ok_(ocrRegDoc_(payload));
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

/* ---------- อ่านข้อมูลให้หน้าเว็บ ---------- */
// ส่งข้อมูลดิบ: รถทุกคัน, การใช้รถ 12 เดือนล่าสุด (+ รายการที่ยังไม่คืน + รายการล่าสุดของแต่ละคันเพื่อหาเลขไมล์),
// ค่าใช้จ่าย 12 เดือน, ซ่อมบำรุงทั้งหมด, รายชื่อคนขับ (ชื่ออย่างเดียว ไม่มีเบอร์โทร), ตั้งค่า
function data_() {
  const since = Utilities.formatDate(new Date(Date.now() - 365 * 86400000), TZ, 'yyyy-MM-dd');
  const usage = readRows_('usage');
  const latest = {};
  usage.forEach(function (u, i) { latest[u.plate] = i; });
  return {
    cars: readRows_('cars').map(cleanCar_),
    usage: usage.filter(function (u, i) { return String(u.ts).slice(0, 10) >= since || u.status === 'open' || latest[u.plate] === i; }).map(clean_),
    expenses: readRows_('expenses').filter(function (e) { return String(e.date) >= since; }).map(clean_),
    maintenance: readRows_('maintenance').map(clean_),
    driverNames: readRows_('drivers').filter(function (d) { return d.active !== 'N' && d.name; }).map(function (d) { return String(d.name); }),
    ver: dataVer_(),
    settings: settings_(),
    pinRequired: !!PropertiesService.getScriptProperties().getProperty('ADMIN_PIN'),
    expenseTypes: EXPENSE_TYPES,
    maintTypes: MAINT_TYPES
  };
}

// ข้อมูลรถที่ส่งให้ทุกคน: ตัด "เบี้ยประกัน" ออก (ตัวเลขเงิน ดูได้เฉพาะแอดมินผ่าน carPrivate)
function cleanCar_(r) { const o = clean_(r); delete o.insPremium; return o; }

// ตัดข้อมูลภายในที่หน้าเว็บไม่ต้องใช้
function clean_(r) {
  const o = Object.assign({}, r);
  delete o._row;
  delete o.email;
  return o;
}

function monthDataClean_(month) {
  const d = monthData_(month);
  return { usage: d.usage.map(clean_), expenses: d.expenses.map(clean_), maint: d.maint.map(clean_) };
}




/* ---------- เบิกรถ / คืนรถ ---------- */
// การเบิกใช้ของรถ: เบิกผ่านระบบได้เฉพาะ pool (ยังไม่ตั้งค่า = ตามประเภทรถ จักรยานยนต์ไม่ต้องเบิก ที่เหลือเบิกได้)
function carMode_(c) { return c.useMode || (c.vtype === 'รถจักรยานยนต์' ? 'free' : 'pool'); }

function checkout_(p) {
  const car = findCar_(p.plate);
  if (carMode_(car) !== 'pool') throw new Error('รถคันนี้' + (carMode_(car) === 'exec' ? 'เป็นรถกรรมการ ไม่เปิดให้เบิกผ่านระบบ' : 'ไม่ต้องเบิกผ่านระบบ'));
  const name = name_(p.name);
  // คนขับที่มีชื่อในระบบแล้วไม่ต้องกรอกเบอร์โทร/วันหมดอายุใบขับขี่ซ้ำ คนขับใหม่ต้องกรอก
  const phone = String(p.phone || '').replace(/[^\d]/g, '');
  const licenseExp = p.licenseExp ? dateStr_(p.licenseExp) : '';
  const known = readRows_('drivers').some(function (r) { return String(r.name) === name; });
  if (readRows_('drivers').some(function (r) { return String(r.name) === name && r.active === 'N'; })) throw new Error('คนขับ "' + name + '" ถูกปิดใช้งาน กรุณาติดต่อแอดมิน');
  if (!known && (!phone || !licenseExp)) throw new Error('คนขับใหม่ กรุณากรอกเบอร์โทรและวันหมดอายุใบขับขี่');
  if (phone && (phone.length < 9 || phone.length > 10)) throw new Error('กรุณากรอกเบอร์โทร 9-10 หลัก');
  const odoStart = num_(p.odoStart, 'ไมล์ก่อน');
  const purpose = str_(p.purpose, 200);
  if (!purpose) throw new Error('กรุณากรอกปลายทาง/วัตถุประสงค์');
  const links = saveImages_(p.images, car.plate, 'เบิกรถ');
  return lock_(function () {
    const held = readRows_('usage').filter(function (u) { return u.plate === car.plate && u.status === 'open'; })[0];
    if (held) throw new Error('รถคันนี้ถูกเบิกโดย ' + held.name + ' เมื่อ ' + String(held.ts).slice(0, 16) + ' ยังไม่ได้คืน');
    const row = {
      id: Utilities.getUuid(), ts: now_(), plate: car.plate, email: '', name: name,
      odoStart: odoStart, odoEnd: '', purpose: purpose, dest: str_(p.dest, 120), images: links.join('\n'),
      returnTs: '', returnImages: '', status: 'open', returnName: ''
    };
    appendRow_('usage', row);
    if (phone || licenseExp) upsertDriver_(name, phone, licenseExp);
    return { id: row.id };
  });
}

// เก็บ/อัปเดตเบอร์โทรและวันหมดอายุใบขับขี่ในแท็บ "รายชื่อคนขับ" (เรียกภายใน lock)
function upsertDriver_(name, phone, licenseExp) {
  const d = readRows_('drivers').filter(function (r) { return String(r.name) === name; })[0];
  const rec = { name: name, active: d && d.active === 'N' ? 'N' : 'Y', phone: phone || (d ? d.phone : ''), licenseExp: licenseExp || (d ? d.licenseExp : ''), updated: now_() };
  if (d) writeRow_(sheet_('drivers'), d._row, 'drivers', rec); else appendRow_('drivers', rec);
}

// เช็กว่ามีชื่อคนขับนี้ในระบบหรือยัง (ส่งกลับแค่วันหมดอายุใบขับขี่ เพื่อเตือนตอนเบิกรถ ไม่ส่งเบอร์โทร)
function driverCheck_(p) {
  const n = str_(p.name, 60);
  const d = readRows_('drivers').filter(function (r) { return String(r.name) === n && r.active !== 'N'; })[0];
  return d ? { exists: true, licenseExp: d.licenseExp || '' } : { exists: false };
}

// คนขับเพิ่มชื่อตัวเองก่อนเบิกรถครั้งแรก (ไม่ต้องใช้ PIN เหมือนการเบิกรถ) ต้องมีเบอร์โทรและวันหมดอายุใบขับขี่
// ชื่อที่มีอยู่แล้วจะไม่ถูกเขียนทับ (กันคนอื่นพิมพ์ชื่อเดียวกันมาแก้เบอร์) ชื่อที่แอดมินปิดใช้งานต้องติดต่อแอดมิน
function registerDriver_(p) {
  const name = name_(p.name);
  const phone = String(p.phone || '').replace(/[^\d]/g, '');
  if (phone.length < 9 || phone.length > 10) throw new Error('กรุณากรอกเบอร์โทร 9-10 หลัก');
  if (!p.licenseExp) throw new Error('กรุณากรอกวันหมดอายุใบขับขี่');
  const licenseExp = dateStr_(p.licenseExp);
  return lock_(function () {
    const d = readRows_('drivers').filter(function (r) { return String(r.name) === name; })[0];
    if (d) throw new Error(d.active === 'N' ? 'ชื่อนี้ถูกปิดใช้งาน กรุณาติดต่อแอดมิน' : 'ชื่อนี้มีในระบบแล้ว เลือกชื่อจากรายการแล้วเบิกรถได้เลย');
    appendRow_('drivers', { name: name, active: 'Y', phone: phone, licenseExp: licenseExp, updated: now_() });
    return { name: name };
  });
}

// สำหรับหน้าแอดมินเท่านั้น (มีเบอร์โทร)
function listDrivers_() {
  return readRows_('drivers').map(function (d) {
    return { name: d.name, phone: d.phone, licenseExp: d.licenseExp, active: d.active, updated: d.updated };
  }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'th'); });
}

// เพิ่ม/แก้ไขคนขับโดยแอดมิน (แก้ไขอ้างอิงด้วย oldName และไม่เปลี่ยนชื่อ เพราะประวัติการใช้รถอ้างอิงด้วยชื่อ)
function saveDriver_(p) {
  const name = name_(p.name);
  const oldName = str_(p.oldName, 60);
  const phone = String(p.phone || '').replace(/[^\d]/g, '');
  if (phone && (phone.length < 9 || phone.length > 10)) throw new Error('กรุณากรอกเบอร์โทร 9-10 หลัก');
  const licenseExp = p.licenseExp ? dateStr_(p.licenseExp) : '';
  return lock_(function () {
    const rows = readRows_('drivers');
    if (oldName) {
      const d = rows.filter(function (r) { return String(r.name) === oldName; })[0];
      if (!d) throw new Error('ไม่พบคนขับ');
      writeRow_(sheet_('drivers'), d._row, 'drivers', { name: d.name, active: d.active === 'N' ? 'N' : 'Y', phone: phone, licenseExp: licenseExp, updated: now_() });
      return { name: d.name };
    }
    const dup = rows.filter(function (r) { return String(r.name) === name; })[0];
    if (dup) throw new Error(dup.active === 'N' ? 'ชื่อนี้มีอยู่แล้วแต่ถูกปิดใช้งาน ให้กด "เปิดใช้งาน" ที่รายการเดิม' : 'ชื่อนี้มีในระบบแล้ว');
    appendRow_('drivers', { name: name, active: 'Y', phone: phone, licenseExp: licenseExp, updated: now_() });
    return { name: name };
  });
}

// ปิดใช้งาน (N) หรือเปิดใช้งาน (Y) คนขับ ประวัติไม่ถูกลบ คนขับที่ปิดใช้งานเบิกรถไม่ได้ แต่คืนรถที่ค้างอยู่ได้
function setDriverActive_(p) {
  const name = name_(p.name);
  const active = p.active === 'N' ? 'N' : 'Y';
  return lock_(function () {
    const d = readRows_('drivers').filter(function (r) { return String(r.name) === name; })[0];
    if (!d) throw new Error('ไม่พบคนขับ');
    writeRow_(sheet_('drivers'), d._row, 'drivers', { name: d.name, active: active, phone: d.phone, licenseExp: d.licenseExp, updated: now_() });
    return { name: d.name, active: active };
  });
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


/* ---------- จัดการรถ (admin) ---------- */
// แก้ไขอ้างอิงด้วยรหัสประจำรถ (id) จึงแก้เลขทะเบียนได้ โดย QR/ลิงก์เดิมยังใช้ได้
function saveCar_(p) {
  const plate = str_(p.plate, 20);
  if (!plate) throw new Error('กรุณากรอกทะเบียน');
  const reg = p.regDoc ? saveRegDoc_(p.regDoc, plate) : null;
  const pol = p.policyDoc ? saveDoc_(p.policyDoc, plate, 'กรมธรรม์', 'ไฟล์กรมธรรม์') : null;
  return lock_(function () {
    const cars = readRows_('cars');
    const old = p.id ? cars.filter(function (r) { return r.id === p.id; })[0] : null;
    if (p.id && !old) throw new Error('ไม่พบรถที่จะแก้ไข');
    const dup = cars.filter(function (r) { return r.plate === plate && (!old || r.id !== old.id); })[0];
    if (dup) throw new Error('ทะเบียน ' + plate + ' มีอยู่แล้วในระบบ' + (dup.active === 'N' ? ' (อยู่ในรายการรถที่นำออก กด "นำกลับมาใช้" แทน)' : ''));
    const rec = old ? Object.assign({}, old) : { id: newCarId_(cars), regDocId: '', regDocMime: '', insDocId: '', insDocMime: '', active: 'Y' };
    rec.plate = plate;
    rec.province = str_(p.province, 40);
    rec.vtype = str_(p.vtype, 30);
    rec.plateColor = PLATE_COLORS.indexOf(p.plateColor) >= 0 ? p.plateColor : 'black';
    rec.insurer = str_(p.insurer, 60);
    rec.model = str_(p.model, 80); rec.year = str_(p.year, 4); rec.color = str_(p.color, 30);
    rec.fuel = str_(p.fuel, 30); rec.vin = str_(p.vin, 30); rec.engineNo = str_(p.engineNo, 30);
    rec.actExp = p.actExp ? dateStr_(p.actExp) : '';
    rec.taxExp = p.taxExp ? dateStr_(p.taxExp) : '';
    rec.insExp = p.insExp ? dateStr_(p.insExp) : '';
    // ข้อมูลกรมธรรม์ประกันภัยรถยนต์ (ใบกรมธรรม์ / ตารางกรมธรรม์)
    rec.insClass = str_(p.insClass, 30); rec.insPolicyNo = str_(p.insPolicyNo, 40);
    rec.insStart = p.insStart ? dateStr_(p.insStart) : '';
    rec.insSum = money_(p.insSum, 'ทุนประกัน'); rec.insDeduct = money_(p.insDeduct, 'ค่าเสียหายส่วนแรก');
    if (p.insPremium !== undefined) rec.insPremium = money_(p.insPremium, 'เบี้ยประกัน'); // ไม่ส่งมา = ไม่แตะค่าเดิม (หน้าเว็บส่งเฉพาะเมื่อโหลดค่าเดิมมาแล้ว)
    rec.insRepair = ['ซ่อมห้าง', 'ซ่อมอู่'].indexOf(p.insRepair) >= 0 ? p.insRepair : '';
    if (p.useMode !== undefined) rec.useMode = ['pool', 'exec', 'free'].indexOf(p.useMode) >= 0 ? p.useMode : ''; // pool = รถส่วนกลางเบิกได้ · exec = รถกรรมการ · free = ไม่ต้องเบิก
    rec.insAgent = str_(p.insAgent, 80); rec.insPhone = String(p.insPhone || '').replace(/[^\d+\-\s]/g, '').trim().slice(0, 20); rec.insNote = str_(p.insNote, 500);
    if (reg) {
      if (old && old.regDocId) {
        try { DriveApp.getFileById(old.regDocId).setTrashed(true); } catch (e) { /* ไฟล์เดิมอาจถูกลบไปแล้ว */ }
      }
      rec.regDocId = reg.id; rec.regDocMime = reg.mime;
    }
    if (pol) {
      if (old && old.insDocId) {
        try { DriveApp.getFileById(old.insDocId).setTrashed(true); } catch (e) { /* ไฟล์เดิมอาจถูกลบไปแล้ว */ }
      }
      rec.insDocId = pol.id; rec.insDocMime = pol.mime;
    }
    if (old) writeRow_(sheet_('cars'), old._row, 'cars', rec); else appendRow_('cars', rec);
    if (old && old.plate !== plate) renamePlate_(old.plate, plate);
    return { id: rec.id, renamed: !!(old && old.plate !== plate) };
  });
}

// ย้ายประวัติทั้งหมดไปอยู่ใต้ทะเบียนใหม่ (เรียกภายใน lock)
function renamePlate_(from, to) {
  ['usage', 'expenses', 'maintenance'].forEach(function (k) {
    const sh = sheet_(k);
    const last = sh.getLastRow();
    if (last < 2) return;
    const col = SCHEMA[k].cols.map(function (c) { return c[0]; }).indexOf('plate') + 1;
    const rng = sh.getRange(2, col, last - 1, 1);
    const vals = rng.getValues();
    let changed = false;
    vals.forEach(function (r) { if (String(r[0]) === from) { r[0] = to; changed = true; } });
    if (changed) { rng.setValues(vals); touch_(); }
  });
}

// รหัสประจำรถแบบสั้น 8 ตัว (ใช้ใน QR)
function newCarId_(cars) {
  let id;
  do { id = Utilities.getUuid().replace(/-/g, '').slice(0, 8); }
  while (cars.some(function (c) { return c.id === id; }));
  return id;
}

// ตั้ง "การเบิกใช้" (pool / exec / free) ของรถหลายคันในครั้งเดียว: modes = [{ id, useMode }]
function setCarModes_(p) {
  const list = Array.isArray(p.modes) ? p.modes : [];
  return lock_(function () {
    const cars = readRows_('cars');
    let changed = 0;
    list.forEach(function (m) {
      const car = cars.filter(function (c) { return c.id === m.id; })[0];
      if (!car) return;
      const v = ['pool', 'exec', 'free'].indexOf(m.useMode) >= 0 ? m.useMode : '';
      if (String(car.useMode || '') !== v) { car.useMode = v; writeRow_(sheet_('cars'), car._row, 'cars', car); changed++; }
    });
    return { changed: changed };
  });
}

// นำรถออก (active = N) หรือนำกลับมาใช้ (Y) ประวัติไม่ถูกลบ
function setCarActive_(p) {
  const active = p.active === 'N' ? 'N' : 'Y';
  return lock_(function () {
    const car = readRows_('cars').filter(function (c) { return c.id === p.id; })[0];
    if (!car) throw new Error('ไม่พบรถ');
    if (active === 'N' && readRows_('usage').some(function (u) { return u.plate === car.plate && u.status === 'open'; })) {
      throw new Error('รถ ' + car.plate + ' ยังถูกเบิกอยู่ ให้คืนรถหรือยกเลิกรายการก่อน');
    }
    car.active = active;
    writeRow_(sheet_('cars'), car._row, 'cars', car);
    return { id: car.id };
  });
}

/* ---------- ตั้งค่า: โลโก้และชื่อบริษัท (เก็บโลโก้ใน Drive โฟลเดอร์ "โลโก้") ---------- */
const DEFAULT_COMPANY = 'Sirikul Accounting';

function settings_() {
  const pr = PropertiesService.getScriptProperties();
  return { company: pr.getProperty('COMPANY_NAME') || DEFAULT_COMPANY, logo: logoData_() };
}

function logoData_() {
  const id = PropertiesService.getScriptProperties().getProperty('LOGO_ID');
  if (!id) return '';
  const cache = CacheService.getScriptCache();
  const hit = cache.get('logo_' + id);
  if (hit) return hit;
  try {
    const f = DriveApp.getFileById(id);
    const d = 'data:' + f.getMimeType() + ';base64,' + Utilities.base64Encode(f.getBlob().getBytes());
    if (d.length < 95000) cache.put('logo_' + id, d, 21600);
    return d;
  } catch (e) {
    return '';
  }
}

function saveSettings_(p) {
  const pr = PropertiesService.getScriptProperties();
  if (p.company !== undefined) {
    const c = str_(p.company, 60);
    if (!c) throw new Error('กรุณากรอกชื่อบริษัท');
    pr.setProperty('COMPANY_NAME', c);
  }
  const oldId = pr.getProperty('LOGO_ID');
  const trashOld = function () { if (oldId) { try { DriveApp.getFileById(oldId).setTrashed(true); } catch (e) { /* ไฟล์เดิมอาจถูกลบแล้ว */ } } };
  if (p.removeLogo) {
    trashOld();
    pr.deleteProperty('LOGO_ID');
  } else if (p.logo) {
    const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(String(p.logo));
    if (!m) throw new Error('โลโก้ต้องเป็นรูปภาพ PNG, JPG หรือ WEBP');
    const bytes = Utilities.base64Decode(m[2]);
    if (bytes.length > 500 * 1024) throw new Error('ไฟล์โลโก้ใหญ่เกิน 500 KB');
    const main = DriveApp.getFolderById(pr.getProperty('MAIN_FOLDER_ID'));
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const file = getOrCreateFolder_(main, 'โลโก้').createFile(Utilities.newBlob(bytes, 'image/' + m[1], 'โลโก้.' + ext));
    trashOld();
    pr.setProperty('LOGO_ID', file.getId());
  }
  return settings_();
}

/* ---------- อ่านสำเนาทะเบียนด้วย OCR ของ Google Drive (ฟรี) — ส่งข้อความกลับ หน้าเว็บแยกข้อมูลเอง ---------- */
// ต้องเปิดบริการ Drive API (v3) ในโปรเจกต์ (appsscript.json เปิดไว้ให้แล้ว)

function ocrRegDoc_(p) {
  const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/.exec(String(p.file || ''));
  if (!m) throw new Error('ไฟล์ต้องเป็นรูปภาพหรือ PDF');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > MAX_DOC_BYTES) throw new Error('ไฟล์ใหญ่เกิน 6 MB');
  if (typeof Drive === 'undefined') throw new Error('ยังไม่ได้เปิดบริการ Drive API ในโปรเจกต์ Apps Script (ดู README)');
  let docId = '';
  try {
    // อัปโหลดเป็น Google Docs พร้อม OCR ภาษาไทย แล้วอ่านข้อความ
    const f = Drive.Files.create({ name: 'ocr-ชั่วคราว-รถส่วนกลาง', mimeType: 'application/vnd.google-apps.document' },
      Utilities.newBlob(bytes, m[1], 'ocr'), { ocrLanguage: 'th' });
    docId = f.id;
    const text = DocumentApp.openById(docId).getBody().getText();
    return { text: text.slice(0, 5000) };
  } finally {
    if (docId) { try { DriveApp.getFileById(docId).setTrashed(true); } catch (e) { /* ลบไฟล์ชั่วคราวไม่สำเร็จ ไม่กระทบผล */ } }
  }
}


/* ---------- สำเนาทะเบียนรถ ---------- */
function saveRegDoc_(dataUrl, plate) { return saveDoc_(dataUrl, plate, 'สำเนาทะเบียน', 'สำเนาทะเบียน'); }

// เก็บไฟล์เอกสารรถ (รูปหรือ PDF) ในโฟลเดอร์ "เอกสารรถ" prefix = คำนำหน้าชื่อไฟล์ label = ชื่อเรียกในข้อความผิดพลาด
function saveDoc_(dataUrl, plate, prefix, label) {
  const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/.exec(String(dataUrl));
  if (!m) throw new Error(label + 'ต้องเป็นรูปภาพหรือ PDF');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > MAX_DOC_BYTES) throw new Error(label + 'ใหญ่เกิน 6 MB');
  const main = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('MAIN_FOLDER_ID'));
  const dir = getOrCreateFolder_(main, 'เอกสารรถ');
  const ext = m[1] === 'application/pdf' ? 'pdf' : (m[1] === 'image/jpeg' ? 'jpg' : m[1].split('/')[1]);
  const file = dir.createFile(Utilities.newBlob(bytes, m[1], prefix + '_' + plate.replace(/[^\wก-๙-]/g, '') + '.' + ext));
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

// ดูไฟล์กรมธรรม์ประกันภัย (เหมือนสำเนาทะเบียน: คนขับดูได้เมื่อเกิดเหตุ)
function getPolicyDoc_(p) {
  const car = findCar_(p.plate);
  if (!car.insDocId) throw new Error('ยังไม่มีไฟล์กรมธรรม์ของรถคันนี้ ให้แอดมินอัปโหลดในหน้าจัดการรถ');
  const file = DriveApp.getFileById(car.insDocId);
  const mime = car.insDocMime || file.getMimeType();
  if (mime === 'application/pdf') return { mime: mime, url: file.getUrl() };
  return { mime: mime, dataUrl: 'data:' + mime + ';base64,' + Utilities.base64Encode(file.getBlob().getBytes()) };
}

// เบี้ยประกัน (ตัวเลขเงิน) ของทุกคัน ให้หน้าแอดมินเท่านั้น (ต้องผ่าน PIN)
function carPrivate_() {
  return readRows_('cars').map(function (c) { return { id: c.id, insPremium: c.insPremium }; });
}

// จำนวนเงิน: ว่างได้ ไม่ติดลบ (รับ "1,234.50")
function money_(v, label) {
  const s = String(v == null ? '' : v).replace(/[,\s]/g, '');
  if (s === '') return '';
  const n = Number(s);
  if (!isFinite(n) || n < 0) throw new Error(label + ' ไม่ถูกต้อง');
  return Math.round(n * 100) / 100;
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

/* ---------- ข้อมูลรายเดือน (แอดมิน ใช้ทำรายงานบนหน้าเว็บ) ---------- */
function monthData_(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) throw new Error('เดือนไม่ถูกต้อง');
  const inM = function (v) { return String(v || '').slice(0, 7) === month; };
  return {
    usage: readRows_('usage').filter(function (u) { return inM(u.ts) && u.status !== 'cancelled'; }),
    expenses: readRows_('expenses').filter(function (e) { return inM(e.date); }),
    maint: readRows_('maintenance').filter(function (m) { return inM(m.date); })
  };
}




/* ---------- ประวัติรถ / ซ่อมบำรุง ---------- */

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
/* ---------- ลบข้อมูลตัวอย่าง (รันมือจากตัวแก้ไข Apps Script ครั้งเดียวก่อนใช้งานจริง) ----------
   ลบเฉพาะแถวที่เป็นข้อมูลตัวอย่างเท่านั้น คือ
   - รถที่เลขตัวถังขึ้นต้นด้วย "ตัวอย่าง-" พร้อมประวัติการใช้รถ ซ่อมบำรุง ค่าใช้จ่ายของรถเหล่านั้น
   - คนขับ/ผู้ใช้ที่ชื่อมี "(ตัวอย่าง)"
   ข้อมูลจริงที่เพิ่มเองจะไม่ถูกแตะ  ดูก่อนได้ด้วย previewSampleData() */
const SAMPLE_VIN_PREFIX = 'ตัวอย่าง-';
const SAMPLE_NAME_TAG = '(ตัวอย่าง)';
function sampleTargets_() {
  const cars = readRows_('cars').filter(function (c) { return String(c.vin).indexOf(SAMPLE_VIN_PREFIX) === 0; });
  const plates = cars.map(function (c) { return c.plate; });
  const byPlate = function (r) { return plates.indexOf(r.plate) >= 0; };
  const byName = function (r) { return String(r.name).indexOf(SAMPLE_NAME_TAG) >= 0; };
  return {
    cars: cars,
    usage: readRows_('usage').filter(function (r) { return byPlate(r) || byName(r); }),
    expenses: readRows_('expenses').filter(function (r) { return byPlate(r) || byName(r); }),
    maintenance: readRows_('maintenance').filter(function (r) { return byPlate(r) || byName(r); }),
    drivers: readRows_('drivers').filter(byName)
  };
}
function sampleSummary_(t) {
  return Object.keys(t).map(function (k) { return SCHEMA[k].title + ' ' + t[k].length + ' แถว'; }).join(' | ');
}
function previewSampleData() {
  const t = sampleTargets_();
  Logger.log('จะลบ: ' + sampleSummary_(t));
  t.cars.forEach(function (c) { Logger.log('  รถ ' + c.plate + ' ' + c.model); });
  Logger.log('ยังไม่ได้ลบอะไร ถ้าถูกต้องให้รัน clearSampleData()');
}
function clearSampleData() {
  lock_(function () {
    const t = sampleTargets_();
    Object.keys(t).forEach(function (k) {
      const sh = sheet_(k), cols = SCHEMA[k].cols.length;
      t[k].map(function (r) { return r._row; }).sort(function (a, b) { return b - a; }).forEach(function (row) {
        try { sh.deleteRow(row); } catch (e) { sh.getRange(row, 1, 1, cols).clearContent(); }
      });
    });
    Logger.log('ลบข้อมูลตัวอย่างแล้ว: ' + sampleSummary_(t));
  });
}

// เลขเวอร์ชันของข้อมูล: เพิ่มทุกครั้งที่แอปเขียน Sheet หน้าแอดมินถามค่านี้เป็นระยะ (เบามาก) แล้วโหลดข้อมูลใหม่เมื่อเลขเปลี่ยน
// หมายเหตุ: ถ้าแก้ Sheet ด้วยมือ เลขนี้ไม่เปลี่ยน หน้าแอดมินจะรีเฟรชเองทุก 5 นาทีแทน
function dataVer_() { return PropertiesService.getScriptProperties().getProperty('DATA_VER') || '0'; }
function touch_() { PropertiesService.getScriptProperties().setProperty('DATA_VER', String(Date.now())); }

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('ยังไม่ได้รัน setup()');
  return SpreadsheetApp.openById(id);
}

function sheet_(key) {
  const sh = ss_().getSheetByName(SCHEMA[key].title), n = SCHEMA[key].cols.length;
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns()); // Sheet ใหม่มีแค่ 26 คอลัมน์
  return sh;
}

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

// เพิ่มหัวคอลัมน์ใหม่ให้เอง เมื่อโค้ดมีคอลัมน์มากกว่าใน Sheet (ไม่ต้องรัน setup ซ้ำ)
function ensureHeader_(key, sh) {
  const cols = SCHEMA[key].cols;
  const had = sh.getLastColumn();
  if (had < cols.length) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[1]; })]);
    // คอลัมน์ใหม่ที่เป็นข้อความ (เช่น เลขกรมธรรม์) ตั้งเป็นรูปแบบข้อความ กัน Sheet แปลงเป็นตัวเลขจนศูนย์นำหน้าหาย
    cols.forEach(function (c, i) { if (i >= had && SCHEMA[key].textCols.indexOf(c[0]) >= 0) sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@'); });
  }
}

function appendRow_(key, obj) {
  const sh = sheet_(key);
  ensureHeader_(key, sh);
  const row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, SCHEMA[key].cols.length).setValues([toArray_(key, obj)]);
  touch_();
}

function writeRow_(sh, rowNo, key, obj) {
  ensureHeader_(key, sh);
  sh.getRange(rowNo, 1, 1, SCHEMA[key].cols.length).setValues([toArray_(key, obj)]);
  touch_();
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
