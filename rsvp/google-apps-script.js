/**
 * تأكيد الحضور ← Google Sheet
 *
 * 1) اعمل Google Sheet جديد
 * 2) Extensions → Apps Script ← امسح الموجود والصق الكود ده ← Save
 * 3) Deploy → New deployment → Type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 4) انسخ لينك الـ Web app وحطه في js/config.js في rsvpEndpoint
 */
const HEADERS = ["الوقت", "الاسم", "الحضور", "عدد الأفراد", "الرسالة", "اسم الدعوة"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.setRightToLeft(true);
    }
    const p = e.parameter;
    sheet.appendRow([
      new Date(),
      p.name || "",
      p.attending === "yes" ? "جاي ✅" : "مش جاي ❌",
      Number(p.count || 0),
      p.message || "",
      p.invitedAs || "",
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
