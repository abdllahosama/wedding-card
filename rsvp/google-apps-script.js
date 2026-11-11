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
 * ⚠️ لو عدلت الكود: Deploy → Manage deployments → ✏️ → Version: New version → Deploy (اللينك بيفضل زي ما هو)
 *
 * إخفاء تهنئة: علّم على خانة "إخفاء" في نفس الصف، وهتختفي من الموقع خلال دقيقة
 */
const SHEET = "الردود";
const HEADERS = ["الوقت", "النوع", "الاسم", "الحضور", "عدد الأفراد", "الرسالة", "اسم الدعوة", "إخفاء", "الكراسي"];
const COL = { time: 1, type: 2, name: 3, attending: 4, count: 5, message: 6, invitedAs: 7, hidden: 8, seats: 9 };
const TABLES = 45, PER_TABLE = 10;   // لازم يطابقوا رسمة القاعة في الموقع

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
  if (sh.getRange(1, COL.seats).getValue() !== HEADERS[COL.seats - 1]) {
    sh.getRange(1, COL.seats).setValue(HEADERS[COL.seats - 1]).setFontWeight("bold");
  }
  return sh;
}

const clean_ = (v, max) => String(v || "").replace(/[<>]/g, "").trim().slice(0, max);
const json_ = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

const keyOf_ = (r) => String(r[COL.invitedAs - 1] || r[COL.name - 1]).trim();
const validSeat_ = (id) => /^t(\d+)-(\d)$/.test(id) && Number(id.split("-")[0].slice(1)) < TABLES;

// آخر رد حضور لكل ضيف ← { key: {count, seats[]} }
function latest_(rows) {
  const latest = {};
  rows.forEach((r) => {
    if (r[COL.type - 1] !== "حضور") return;
    latest[keyOf_(r)] = {
      count: Number(r[COL.count - 1]) || 0,
      seats: String(r[COL.seats - 1] || "").split(",").filter(validSeat_),
    };
  });
  return latest;
}

// لو حد سبق على كرسي، نختار بداله أقرب كرسي فاضي (نفس الترابيزة الأول)
function assignSeats_(wanted, count, taken) {
  const out = [];
  const used = new Set(taken);
  wanted.forEach((id) => { if (out.length < count && validSeat_(id) && !used.has(id)) { out.push(id); used.add(id); } });
  const prefer = wanted.length ? Number(wanted[0].split("-")[0].slice(1)) : 0;
  const order = [prefer].concat([...Array(TABLES).keys()].filter((t) => t !== prefer));
  for (const t of order) {
    for (let k = 0; k < PER_TABLE && out.length < count; k++) {
      const id = `t${t}-${k}`;
      if (!used.has(id)) { out.push(id); used.add(id); }
    }
    if (out.length >= count) break;
  }
  return out;
}

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
    const isYes = type === "rsvp" && p.attending === "yes";
    const count = isYes ? Math.max(1, Math.min(20, Number(p.count) || 1)) : 0;
    let seats = [];
    if (isYes) {
      const all = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).getValues() : [];
      const latest = latest_(all);
      const me = clean_(p.invitedAs, 60) || name;
      const taken = [];
      Object.keys(latest).forEach((k) => { if (k !== me) taken.push(...latest[k].seats); });
      seats = assignSeats_(String(p.seats || "").split(",").filter(Boolean), count, taken);
    }
    sh.appendRow([
      new Date(),
      type === "wish" ? "تهنئة" : "حضور",
      name,
      type === "rsvp" ? (p.attending === "yes" ? "جاي ✅" : "مش جاي ❌") : "",
      count,
      message,
      clean_(p.invitedAs, 60),
      false,
      seats.join(","),
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
  const latest = latest_(rows);
  const wishes = [];
  rows.forEach((r) => {
    const name = String(r[COL.name - 1]);
    const msg = String(r[COL.message - 1] || "").trim();
    if (msg && r[COL.hidden - 1] !== true) {
      wishes.push({ name, message: msg, time: new Date(r[COL.time - 1]).getTime() });
    }
  });
  const reserved = Object.values(latest).reduce((a, b) => a + b.count, 0);
  const taken = [].concat(...Object.values(latest).map((x) => x.seats));
  wishes.sort((a, b) => b.time - a.time);

  const out = JSON.stringify({ reserved, taken, wishes: wishes.slice(0, 200) });
  cache.put("stats", out, 60);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}
