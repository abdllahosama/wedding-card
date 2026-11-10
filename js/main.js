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

  /* ---------- تأكيد الحضور ---------- */
  const form = $("#rsvpForm");
  const countOut = $("#guestCount");
  const countField = $("#countField");
  const KEY = "rsvp:" + (guest || "_");
  let count = 1;
  const renderCount = () => { countOut.textContent = ar(count); countOut.value = count; };
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
      $("#rsvpDoneTitle").textContent = "منورنا من دلوقتي";
      $("#rsvpDoneText").textContent = `أكدنا حضور ${ar(data.count)} ${data.count > 1 ? "أفراد" : "فرد"} — مستنيينك 🤍`;
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
      name: String(fd.get("name") || "").trim(),
      attending: fd.get("attending"),
      count: fd.get("attending") === "yes" ? count : 0,
      message: String(fd.get("message") || "").trim(),
      invitedAs: guest,
      submittedAt: new Date().toISOString(),
    };
    if (!data.name) {
      err.textContent = "اكتب اسمك الأول";
      err.hidden = false;
      $("#rsvpName").focus();
      return;
    }

    const btn = $("#rsvpSubmit");
    btn.disabled = true;
    btn.textContent = "بنبعت…";
    try {
      if (C.rsvpEndpoint) {
        await fetch(C.rsvpEndpoint, { method: "POST", mode: "no-cors", body: new URLSearchParams(data) });
      } else {
        const msg = data.attending === "yes"
          ? `السلام عليكم 🤍\nأنا ${data.name} وإن شاء الله هحضر الفرح\nعدد الأفراد: ${data.count}${data.message ? `\n\n${data.message}` : ""}`
          : `السلام عليكم 🤍\nأنا ${data.name} وللأسف مش هقدر أحضر الفرح${data.message ? `\n\n${data.message}` : ""}`;
        window.open(`https://wa.me/${C.whatsappNumber}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      }
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {}
      showDone(data);
    } catch (_) {
      err.textContent = "حصلت مشكلة في الإرسال، جرب تاني";
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "ابعت الرد";
    }
  });

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
