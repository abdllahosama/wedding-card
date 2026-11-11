/**
 * تأكيد الحضور + التهاني ← Google Sheet
 *
 * الإعداد (مرة واحدة):
 * 1) اعمل Google Sheet جديد
 * 2) Extensions → Apps Script ← امسح الموجود والصق الكود ده كله ← Save
 * 3) Deploy → New deployment → اختار النوع Web app
 *      Execute as: Me
 *      Who has access: Anyone
 *    ← Deploy ← وافق على الصلاحيات
 * 4) انسخ لينك الـ Web app (بيخلص بـ /exec) وحطه في js/config.js في rsvpEndpoint
 *
 * لو عدلت الكود بعد كده: Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 *
 * إخفاء تهنئة: علّم على خانة "إخفاء" في نفس الصف، وهتختفي من الموقع خلال دقيقة
 */
const SHEET = "الردود";
const HEADERS = ["الوقت", "النوع", "الاسم", "الحضور", "عدد الأفراد", "الرسالة", "اسم الدعوة", "إخفاء"];
const COL = { time: 1, type: 2, name: 3, attending: 4, count: 5, message: 6, invitedAs: 7, hidden: 8 };

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sh;
}

const clean_ = (v, max) => String(v || "").replace(/[<>]/g, "").trim().slice(0, max);
const json_ = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function doPost(e) {
  const p = e.parameter || {};
  if (p.website) return json_({ ok: true });                 // فخ للسبام: الخانة دي مخفية عن البني آدمين
  const type = p.type === "wish" ? "wish" : "rsvp";
  const name = clean_(p.name, 60);
  const message = clean_(p.message, 400);
  if (!name || (type === "wish" && !message)) return json_({ ok: false });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    // منع التكرار: نفس الاسم ونفس الرسالة خلال آخر ٢٠ صف
    const last = sh.getLastRow();
    if (last > 1) {
      const from = Math.max(2, last - 19);
      const rows = sh.getRange(from, 1, last - from + 1, HEADERS.length).getValues();
      if (rows.some((r) => r[COL.name - 1] === name && r[COL.message - 1] === message && r[COL.type - 1] === (type === "wish" ? "تهنئة" : "حضور") && message)) {
        return json_({ ok: true, dup: true });
      }
    }
    sh.appendRow([
      new Date(),
      type === "wish" ? "تهنئة" : "حضور",
      name,
      type === "rsvp" ? (p.attending === "yes" ? "جاي ✅" : "مش جاي ❌") : "",
      type === "rsvp" && p.attending === "yes" ? Math.max(1, Math.min(20, Number(p.count) || 1)) : 0,
      message,
      clean_(p.invitedAs, 60),
      false,
    ]);
    sh.getRange(sh.getLastRow(), COL.hidden).insertCheckboxes();
    CacheService.getScriptCache().remove("stats");
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("stats");
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);

  const sh = sheet_();
  const last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];

  // عدد المحجوز: آخر رد لكل ضيف هو اللي بيتحسب (لو عدّل رده)
  const latest = {};
  const wishes = [];
  rows.forEach((r) => {
    const type = r[COL.type - 1];
    const name = String(r[COL.name - 1]);
    const key = String(r[COL.invitedAs - 1] || name).trim();
    if (type === "حضور") latest[key] = Number(r[COL.count - 1]) || 0;
    const msg = String(r[COL.message - 1] || "").trim();
    if (msg && r[COL.hidden - 1] !== true) {
      wishes.push({ name, message: msg, time: new Date(r[COL.time - 1]).getTime() });
    }
  });
  const reserved = Object.values(latest).reduce((a, b) => a + b, 0);
  wishes.sort((a, b) => b.time - a.time);

  const out = JSON.stringify({ reserved, wishes: wishes.slice(0, 200) });
  cache.put("stats", out, 60);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}
