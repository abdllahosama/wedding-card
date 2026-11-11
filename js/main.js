(() => {
  "use strict";
  const C = window.WEDDING;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ar = (n) => Number(n).toLocaleString("ar-EG");
  const params = new URLSearchParams(location.search);
  const guest = (params.get("to") || "").trim().slice(0, 60);
  const maxGuests = Math.max(1, Math.min(20, parseInt(params.get("n"), 10) || C.maxGuestsDefault || 4));

  /* ---------- ربط النصوص من config ---------- */
  $$("[data-bind]").forEach((el) => {
    const v = C[el.dataset.bind];
    if (v != null) el.textContent = v;
  });
  $("#mono1").textContent = C.monogram[0];
  $("#mono2").textContent = C.monogram[1];
  document.title = `${C.groom} & ${C.bride} | دعوة زفاف`;

  /* ---------- اسم الضيف ---------- */
  if (guest) {
    $("#gateName").textContent = guest;
    const g = $("#heroGreet");
    g.textContent = "يسعدنا حضورك يا ";
    const b = document.createElement("b");
    b.textContent = guest;
    g.append(b, " ومشاركتنا فرحتنا");
    $("#rsvpName").value = guest;
  }

  /* ---------- الموسيقى ---------- */
  const audio = $("#music");
  const musicBtn = $("#musicBtn");
  let hasMusic = false;
  if (C.music) {
    audio.preload = "metadata";
    audio.src = C.music;
    audio.addEventListener("loadedmetadata", () => {
      hasMusic = true;
      if (document.body.classList.contains("opened")) musicBtn.hidden = false;
    }, { once: true });
  }
  const setPlaying = (on) => musicBtn.classList.toggle("playing", on);
  musicBtn.addEventListener("click", () => {
    if (audio.paused) audio.play().then(() => setPlaying(true)).catch(() => {});
    else { audio.pause(); setPlaying(false); }
  });

  /* ---------- فتح الظرف ---------- */
  const gate = $("#gate");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const steps = reduce ? [0, 0, 0, 0] : [0, 450, 1350, 2700];
  let opened = false;

  function openEnvelope() {
    if (opened) return;
    opened = true;
    if (C.music) {
      audio.volume = 0;
      audio.play().then(() => {
        setPlaying(true);
        let v = 0;
        const fade = setInterval(() => { v = Math.min(0.45, v + 0.03); audio.volume = v; if (v >= 0.45) clearInterval(fade); }, 120);
      }).catch(() => {});
    }
    ["s1", "s2", "s3", "s4"].forEach((cls, i) => setTimeout(() => gate.classList.add(cls), steps[i]));
    setTimeout(() => {
      document.body.classList.remove("locked");
      document.body.classList.add("opened");
      if (hasMusic) musicBtn.hidden = false;
      $$(".hero .reveal").forEach((el) => el.classList.add("in"));
    }, steps[3]);
    setTimeout(() => { gate.remove(); }, steps[3] + 1200);
  }
  $("#seal").addEventListener("click", openEnvelope);
  $("#envelope").addEventListener("click", openEnvelope);

  /* ---------- ظهور العناصر مع السكرول ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el) => { if (!el.closest(".hero")) io.observe(el); });

  /* ---------- العد التنازلي ---------- */
  const target = new Date(C.date).getTime();
  const cd = { d: $('[data-cd="d"]'), h: $('[data-cd="h"]'), m: $('[data-cd="m"]'), s: $('[data-cd="s"]') };
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      $("#countdown").hidden = true;
      $("#countdownDone").hidden = false;
      return;
    }
    const s = Math.floor(diff / 1000);
    cd.d.textContent = ar(Math.floor(s / 86400));
    cd.h.textContent = ar(Math.floor((s % 86400) / 3600));
    cd.m.textContent = ar(Math.floor((s % 3600) / 60));
    cd.s.textContent = ar(s % 60);
    setTimeout(tick, 1000);
  }
  tick();

  /* ---------- التقويم والخريطة ---------- */
  const start = new Date(C.date);
  const end = new Date(start.getTime() + (C.durationHours || 4) * 3600e3);
  const utc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = `فرح ${C.groom} و${C.bride}`;
  const where = [C.venueName, C.venueAddress].filter(Boolean).join(" — ");
  const details = `يسعدنا حضورك 🤍\n${C.mapsUrl || ""}`;

  $("#gcalBtn").href = "https://calendar.google.com/calendar/render?" + new URLSearchParams({
    action: "TEMPLATE", text: title, dates: `${utc(start)}/${utc(end)}`, location: where, details,
  });
  $("#icsBtn").addEventListener("click", () => {
    const esc = (t) => String(t).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//wedding//invite//AR", "BEGIN:VEVENT",
      `UID:${utc(start)}-wedding@invite`, `DTSTAMP:${utc(new Date())}`,
      `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`,
      `SUMMARY:${esc(title)}`, `LOCATION:${esc(where)}`, `DESCRIPTION:${esc(details)}`,
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = "wedding.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("#mapsBtn").href = C.mapsUrl || "#";
  if (C.mapEmbedUrl) {
    $("#mapFrame").src = C.mapEmbedUrl;
    $("#mapWrap").hidden = false;
  }

  /* ---------- رسمة القاعة والعداد ---------- */
  const CAP = C.capacity || 450;
  const API = C.rsvpEndpoint;
  const NS = "http://www.w3.org/2000/svg";
  const svg = $("#hallSvg");
  const seats = [];
  (function drawHall() {
    const el = (tag, attrs, parent = svg) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      parent.append(n);
      return n;
    };
    el("rect", { x: 131, y: 6, width: 130, height: 30, rx: 15, class: "stage" });
    const t = el("text", { x: 196, y: 26, class: "stage-label", "text-anchor": "middle" });
    t.textContent = "الكوشة";
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const skip = new Set(["0-2", "0-3", "0-4", "6-3"]);   // ساحة الرقص قدام الكوشة + المدخل
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (skip.has(`${r}-${c}`)) continue;
        const cx = 28 + c * 56, cy = 82 + r * 56;
        el("circle", { cx, cy, r: 10.5, class: "table" });
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          const d = el("circle", { cx: (cx + Math.cos(a) * 18.5).toFixed(1), cy: (cy + Math.sin(a) * 18.5).toFixed(1), r: 3.6, class: "seat" });
          seats.push({ d, order: r * 10 + rnd() * 9 });   // بتتملي من قدام لورا
        }
      }
    }
    seats.sort((a, b) => a.order - b.order);
  })();

  let reserved = 0;
  const dotsFor = (n) => Math.min(seats.length, Math.round((n / CAP) * seats.length));
  function renderSeats() {
    const on = dotsFor(reserved);
    seats.forEach((s, i) => s.d.classList.toggle("on", i < on));
    if (!API) return;
    const left = Math.max(0, CAP - reserved);
    $("#seatsMeter").hidden = false;
    $("#meterFill").style.width = `${Math.min(100, (reserved / CAP) * 100)}%`;
    $("#seatsCap").textContent = ar(CAP);
    $("#seatsLeft").textContent = ar(left);
    $("#seatsMeter").classList.toggle("almost", left / CAP < 0.15);
    if (left === 0) $("#seatsMeter p").textContent = "الأماكن اكتملت 🤍";
  }
  function lightMine(n) {
    const from = dotsFor(reserved);
    reserved += n;
    const to = Math.max(from + 1, dotsFor(reserved));
    renderSeats();
    seats.slice(from, to).forEach((s, i) => {
      s.d.classList.add("on");
      setTimeout(() => s.d.classList.add("mine"), 120 * i);
    });
    $("#hall").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------- البيانات من Google Sheet ---------- */
  let wishes = [];
  let wishShown = 12;
  async function loadStats() {
    if (!API) return;
    try {
      const res = await fetch(API, { cache: "no-store" });
      const data = await res.json();
      reserved = Number(data.reserved) || 0;
      wishes = Array.isArray(data.wishes) ? data.wishes : [];
      renderSeats();
      renderWishes();
    } catch (_) {}
  }
  const post = (data) => fetch(API, { method: "POST", mode: "no-cors", body: new URLSearchParams(data) });

  /* ---------- تأكيد الحضور ---------- */
  const form = $("#rsvpForm");
  const countOut = $("#guestCount");
  const countField = $("#countField");
  const KEY = "rsvp:" + (guest || "_");
  let count = 1;
  const renderCount = () => { countOut.textContent = ar(count); };
  renderCount();
  $$(".stepper button").forEach((b) => b.addEventListener("click", () => {
    count = Math.max(1, Math.min(maxGuests, count + Number(b.dataset.step)));
    renderCount();
  }));
  form.addEventListener("change", (e) => {
    if (e.target.name === "attending") countField.hidden = e.target.value === "no";
  });

  function showDone(data) {
    form.hidden = true;
    $("#rsvpDone").hidden = false;
    if (data.attending === "yes") {
      $("#rsvpDoneTitle").textContent = "اتحجزلك مكان 🤍";
      $("#rsvpDoneText").textContent = `أكدنا حضور ${ar(data.count)} ${data.count > 1 ? "أفراد" : "فرد"} — منورنا من دلوقتي`;
    } else {
      $("#rsvpDoneTitle").textContent = "هنفتقدك";
      $("#rsvpDoneText").textContent = "شكرا إنك عرفتنا ودعواتك توصلنا 🤍";
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) showDone(saved);
  } catch (_) {}

  $("#rsvpEdit").addEventListener("click", () => {
    $("#rsvpDone").hidden = true;
    form.hidden = false;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#rsvpError");
    err.hidden = true;
    const fd = new FormData(form);
    const data = {
      type: "rsvp",
      name: String(fd.get("name") || "").trim(),
      attending: fd.get("attending"),
      count: fd.get("attending") === "yes" ? count : 0,
      message: String(fd.get("message") || "").trim(),
      invitedAs: guest,
      website: String(fd.get("website") || ""),
    };
    if (!data.name) {
      err.textContent = "اكتب اسمك الأول";
      err.hidden = false;
      $("#rsvpName").focus();
      return;
    }

    const btn = $("#rsvpSubmit");
    btn.disabled = true;
    btn.textContent = "بنحجز…";
    try {
      let prev = null;
      try { prev = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
      if (API) {
        await post(data);
      } else {
        const msg = data.attending === "yes"
          ? `السلام عليكم 🤍\nأنا ${data.name} وإن شاء الله هحضر الفرح\nعدد الأفراد: ${data.count}${data.message ? `\n\n${data.message}` : ""}`
          : `السلام عليكم 🤍\nأنا ${data.name} وللأسف مش هقدر أحضر الفرح${data.message ? `\n\n${data.message}` : ""}`;
        window.open(`https://wa.me/${C.whatsappNumber}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      }
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {}
      showDone(data);
      const delta = data.count - (prev ? prev.count || 0 : 0);
      if (delta > 0) lightMine(delta);
      else { reserved = Math.max(0, reserved + delta); renderSeats(); }
      if (data.message && API) {
        wishes.unshift({ name: data.name, message: data.message, time: Date.now() });
        renderWishes();
      }
      setTimeout(loadStats, 2500);
    } catch (_) {
      err.textContent = "حصلت مشكلة في الإرسال، جرب تاني";
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "احجز مكانك";
    }
  });

  /* ---------- دفتر التهاني ---------- */
  const wishList = $("#wishList");
  const rtf = new Intl.RelativeTimeFormat("ar-EG", { numeric: "auto" });
  function ago(t) {
    const s = (t - Date.now()) / 1000;
    const units = [["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u);
    return "دلوقتي";
  }
  function renderWishes() {
    wishList.textContent = "";
    wishes.slice(0, wishShown).forEach((w) => {
      const card = document.createElement("article");
      card.className = "wish";
      const p = document.createElement("p");
      p.textContent = w.message;
      const foot = document.createElement("footer");
      const b = document.createElement("b");
      b.textContent = w.name;
      const time = document.createElement("time");
      time.textContent = ago(w.time);
      foot.append(b, time);
      card.append(p, foot);
      wishList.append(card);
    });
    $("#wishMore").hidden = wishes.length <= wishShown;
  }
  $("#wishMore").addEventListener("click", () => { wishShown += 12; renderWishes(); });

  if (API) {
    $("#wishes").hidden = false;
    if (guest) $("#wishName").value = guest;
    const msgEl = $("#wishMsg");
    msgEl.addEventListener("input", () => { $("#wishCount").textContent = `${ar(msgEl.value.length)} / ٤٠٠`; });
    $("#wishForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#wishError");
      err.hidden = true;
      const name = $("#wishName").value.trim();
      const message = msgEl.value.trim();
      if (!name || !message) {
        err.textContent = !name ? "اكتب اسمك" : "اكتب التهنئة";
        err.hidden = false;
        return;
      }
      const btn = $("#wishSubmit");
      btn.disabled = true;
      try {
        await post({ type: "wish", name, message, invitedAs: guest, website: $("#wishForm [name=website]").value });
        wishes.unshift({ name, message, time: Date.now() });
        renderWishes();
        msgEl.value = "";
        $("#wishCount").textContent = "٠ / ٤٠٠";
        wishList.firstElementChild?.classList.add("fresh");
      } catch (_) {
        err.textContent = "حصلت مشكلة، جرب تاني";
        err.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
  }

  renderSeats();
  loadStats();

  /* ---------- معرض الصور ---------- */
  const gallery = $("#gallery");
  const pics = Array.from({ length: 12 }, (_, i) => `images/gallery/${String(i + 1).padStart(2, "0")}.jpg`);
  pics.forEach((src, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "reveal";
    b.setAttribute("aria-label", `صورة ${i + 1}`);
    b.style.transitionDelay = `${(i % 3) * 0.08}s`;
    const img = new Image();
    img.src = src; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
    img.width = 867; img.height = 1300;   // يمنع اهتزاز الصفحة وقت تحميل الصور
    b.append(img);
    b.addEventListener("click", () => openLb(i));
    gallery.append(b);
    io.observe(b);
  });

  const lb = $("#lightbox");
  const lbImg = $("img", lb);
  let lbIndex = 0;
  function openLb(i) { lbIndex = i; lbImg.src = pics[i]; lb.hidden = false; document.body.style.overflow = "hidden"; }
  function closeLb() { lb.hidden = true; document.body.style.overflow = ""; }
  function step(d) { lbIndex = (lbIndex + d + pics.length) % pics.length; lbImg.src = pics[lbIndex]; }
  $(".lb-close", lb).addEventListener("click", closeLb);
  $(".lb-prev", lb).addEventListener("click", () => step(-1));
  $(".lb-next", lb).addEventListener("click", () => step(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") step(1);
    if (e.key === "ArrowRight") step(-1);
  });
  let tx = 0;
  lb.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) step(dx > 0 ? 1 : -1);
  });
})();
