// ตัวช่วยให้ติดตั้งเป็นแอปได้: ใช้ไฟล์ล่าสุดจากเน็ตก่อนเสมอ (ถ้าเน็ตหลุดค่อยใช้ไฟล์ที่เคยโหลด)
// ไม่แตะคำขอข้อมูลที่ส่งไป Google (ข้อมูลไม่ถูกเก็บในเครื่อง)
const CACHE = 'rot-shell-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
    return res;
  }).catch(() => caches.match(req)));
});
