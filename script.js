(function () {
  "use strict";

  /* ---------- Marquee (client logos) ---------- */
  // Desktop marquee order (VoeV after MSK, before Gartenbau). Mobile grid re-orders via CSS.
  var logos = [
    ["logo-01-sv.svg", "SV SparkassenVersicherung"],
    ["logo-02-vgh.svg", "VGH"],
    ["logo-03-devk-re.svg", "DEVK RE"],
    ["logo-04-vh.svg", "Vereinigte Hagelversicherung"],
    ["logo-05-svs.svg", "SV SparkassenVersicherung Sachsen"],
    ["logo-msk.svg", "Meyerthole Siems Kohlruss"],
    ["logo-voev.jpg", "Verband öffentlicher Versicherer"],
    ["logo-06-gartenbau.svg", "Gartenbau-Versicherung"],
    ["logo-07-sv-bav.svg", "SV bAV Consulting GmbH"],
    ["logo-08-devk-am.svg", "DEVK AM"],
    ["logo-09-oerag.svg", "ÖRAG Rechtsschutz"],
    ["logo-10-svp.svg", "SV Pensionsfonds"],
    ["logo-11-cominia.svg", "cominia"],
    ["logo-12-zeitsprung.svg", "zeitsprung"]
  ];
  // Resolve the logo folder relative to this very script's own (already-correct,
  // depth-aware) URL instead of a hardcoded "/assets/..." path. A root-relative path
  // breaks when the site is opened directly as a local file (file://) rather than
  // through a web server, since "/" then resolves to the filesystem root. Deriving
  // the base from document.currentScript.src works under file://, http(s)://, and at
  // any folder depth (root pages and /leistungen/* subpages alike).
  var scriptEl = document.currentScript;
  var logoBase = "/assets/logos/";
  if (scriptEl && scriptEl.src) {
    logoBase = scriptEl.src.replace(/script\.js(?:\?.*)?$/, "assets/logos/");
  }
  var logoHtml = "";
  for (var pass = 0; pass < 2; pass++) {
    for (var i = 0; i < logos.length; i++) {
      // eager load: marquee width must be correct up-front or the -50% loop seams
      logoHtml += '<img src="' + logoBase + logos[i][0] + '" alt="' + logos[i][1] +
        '" decoding="async" draggable="false">';
    }
  }
  // A page can have more than one marquee instance (e.g. the hero trust-bar and the
  // Kontakt-section banner) — populate every one found, not just a single #id target.
  document.querySelectorAll(".marquee-track").forEach(function (t) {
    t.innerHTML = logoHtml;
  });

  /* ---------- Marquee: native horizontal scroll + auto-advance + mouse drag ----------
     Uses viewport.scrollLeft (repaints reliably on iOS Safari, natively swipeable on
     touch) instead of a CSS/JS transform. Two identical logo copies => wrapping by one
     copy width is seamless. Scroll mode only (>640px); phones keep the static grid.
     Each ".marquee-viewport" on the page gets its own independent instance/state, so
     multiple marquees (hero trust-bar + Kontakt-section banner) run without interfering. */
  document.querySelectorAll(".marquee-viewport").forEach(function (viewport) {
    var track = viewport.querySelector(".marquee-track");
    if (!track) return;
    var GRID_BP = 640;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var half = 0, speed = 0;                 // half = one copy's width; speed in px/ms
    var running = false, lastT = 0, paused = false, resumeTimer = null;
    var expectedSL = -1;                      // last scrollLeft WE set (to ignore our own scroll events)

    function scrollMode() { return window.innerWidth > GRID_BP; }
    function measure() {
      // One copy's width = left position of the first item of the second copy.
      // (Robuster als scrollWidth/2 — unabhängig davon, wie der Browser den letzten
      //  trailing-margin oder raster-Logos in scrollWidth zählt.)
      var kids = track.children, n = kids.length;
      half = (n >= 2) ? kids[n >> 1].offsetLeft : track.scrollWidth / 2;
      speed = half > 0 ? half / 26000 : 0;    // ~26s per copy
    }
    function setSL(v) {
      // iOS Safari: das native Touch-Scroll-Layer eines Elements mit
      // -webkit-overflow-scrolling:touch synct kontinuierliche
      // scrollLeft-Zuweisungen aus rAF nicht zuverlässig, solange
      // niemand aktiv mit dem Finger berührt - dadurch "läuft" der
      // Marquee bei Nichtberührung nicht automatisch weiter, während
      // manuelles Wischen (natives Scrollen) einwandfrei funktioniert.
      // viewport.scrollTo() erzwingt bei iOS zuverlässiger ein Repaint
      // als die reine Property-Zuweisung.
      if (viewport.scrollTo) viewport.scrollTo({ left: v, behavior: "auto" });
      else viewport.scrollLeft = v;
      expectedSL = viewport.scrollLeft;
    }
    function normalize() {                    // keep scrollLeft mid-range so both dirs wrap
      if (half <= 0) return;
      var sl = viewport.scrollLeft;
      if (sl >= half * 1.5) setSL(sl - half);
      else if (sl < half * 0.5) setSL(sl + half);
    }
    function pause() { paused = true; if (resumeTimer) clearTimeout(resumeTimer); }
    function resumeSoon(delay) {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () { paused = false; }, delay || 1200);
    }

    function tick(t) {
      if (!scrollMode()) { running = false; return; }
      if (!lastT) lastT = t;
      var dt = Math.min(t - lastT, 50); lastT = t;
      if (!paused && !reduceMotion && half > 0) {
        setSL(viewport.scrollLeft + speed * dt);
        normalize();
      }
      requestAnimationFrame(tick);
    }
    function start() {
      if (running || !scrollMode()) return;
      running = true; lastT = 0;
      measure();
      setSL(half);                            // start centered so it can wrap both ways
      requestAnimationFrame(tick);
    }

    /* Pause auto while the user interacts */
    viewport.addEventListener("wheel", function () { pause(); resumeSoon(1200); }, { passive: true });

    // User scroll (touch swipe/momentum, trackpad): ignore our own programmatic scrolls
    var settleTimer = null;
    viewport.addEventListener("scroll", function () {
      if (Math.abs(viewport.scrollLeft - expectedSL) < 2) return; // our own auto-advance
      pause();
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { normalize(); resumeSoon(500); }, 150);
    }, { passive: true });

    /* Desktop mouse: click-drag to scroll (incremental so it survives wrapping) */
    var dragging = false, lastX = 0;
    viewport.addEventListener("pointerdown", function (e) {
      if (!scrollMode()) return;
      pause();
      if (e.pointerType === "mouse") {
        dragging = true; lastX = e.clientX;
        viewport.classList.add("dragging");
        e.preventDefault();
      }
    });
    window.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX; lastX = e.clientX;
      setSL(viewport.scrollLeft - dx);
      normalize();
    }, { passive: true });
    function endDrag() {
      if (dragging) { dragging = false; viewport.classList.remove("dragging"); }
      resumeSoon(900);
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { measure(); if (scrollMode() && !running) start(); }, 150);
    });

    function boot() { measure(); start(); }
    if (document.readyState === "complete") boot();
    else window.addEventListener("load", boot);
    setTimeout(function () { measure(); if (!running) start(); }, 400);
  });

  /* ---------- Header scroll state ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (window.scrollY > 12) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById("navToggle");
  var menu = document.getElementById("mobileMenu");
  if (toggle && menu) {
    // Geschlossen ist das Menue nur per translateY aus dem Bild geschoben; ohne "inert"
    // wuerde die Tab-Navigation in die unsichtbaren Links springen.
    function setMenu(open) {
      menu.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if ("inert" in menu) menu.inert = !open;
    }
    setMenu(false);
    toggle.addEventListener("click", function () { setMenu(!menu.classList.contains("open")); });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    menu.querySelectorAll(".mobile-submenu-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var group = btn.closest(".mobile-submenu-group");
        if (!group) return;
        var isOpen = group.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
    });
  }

  /* ---------- Touch: Kacheln mit Hover-Inhalt (Weitere Leistungen, Medien-Kacheln) ----------
     Auf Desktop blendet Hover die Beschreibung ein, Klick navigiert. Auf Touch gibt es
     kein Hover, der erste Tipp wuerde sofort wegnavigieren. Deshalb: erster Tipp oeffnet
     die Kachel (is-open), erst der zweite Tipp (oder "mehr erfahren") folgt dem Link.
     Tipp ausserhalb schliesst wieder. */
  (function () {
    if (!window.matchMedia || !window.matchMedia("(hover: none)").matches) return;
    var tiles = document.querySelectorAll("a.related-leistung, a.medien-tile");
    if (!tiles.length) return;
    tiles.forEach(function (tile) {
      tile.addEventListener("click", function (e) {
        if (tile.classList.contains("is-open")) return; // zweiter Tipp: navigieren
        e.preventDefault();
        tiles.forEach(function (t) { t.classList.remove("is-open"); });
        tile.classList.add("is-open");
      });
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a.related-leistung, a.medien-tile")) return;
      tiles.forEach(function (t) { t.classList.remove("is-open"); });
    });
  })();

  /* ---------- Sprint-Landingpage: Struktur-Skizze im Popup auf Mobil zuschneiden ----------
     Die SVG-Skizze traegt links und rechts Beschriftungen (viewBox 880 breit); auf einem
     Handy waere das Telefon in der Mitte nur ~95px breit. Mobil wird die viewBox auf das
     Telefon (x 300..580) zugeschnitten, dann fuellt es den Rahmen. */
  (function () {
    var svg = document.querySelector(".modal-structure-frame svg");
    if (!svg || !window.matchMedia || !window.matchMedia("(max-width: 640px)").matches) return;
    svg.setAttribute("viewBox", "290 20 300 1052");
    svg.parentNode.classList.add("is-cropped");
  })();

  /* ---------- Logo -> back to top (sticky header makes #top unreliable) ----------
     Nur auf der Startseite: dort zeigt .brand auf "#top". Auf Unterseiten zeigt
     .brand auf "/index.html" und soll ganz normal navigieren. */
  var brand = document.querySelector(".brand");
  if (brand && brand.getAttribute("href") && brand.getAttribute("href").charAt(0) === "#") {
    brand.addEventListener("click", function (e) {
      e.preventDefault();
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      if (menu) menu.classList.remove("open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    });
  }

  /* ---------- Modals (Pop-up texts) ---------- */
  var P = function () { return Array.prototype.slice.call(arguments); };
  var MODALS = {
    loesung: {
      icon: "ic-forward",
      title: "Wir übersetzen Deine Strategie in Wirkung",
      body: P(
        "Wir begleiten Dich bei der Umsetzung Deiner Fokusthemen und bei der strategischen Kommunikation nach innen und außen. Denn dort liegen oft die entscheidenden Hebel, ob ein Thema wirklich vorankommt.",
        "@Das Ergebnis:",
        "Du steuerst Deine Themen, statt auf Überraschungen zu reagieren. Die Zusammenhänge sind klar. Deine Themen kommen voran.",
        "Und irgendwann merkst Du, dass Dich auch die anderen längst als jemanden wahrnehmen, der seinen Verantwortungsbereich im Griff hat."
      )
    }
  };

  var overlay = document.getElementById("modalOverlay");
  var mTitle = document.getElementById("modalTitle");
  var mBody = document.getElementById("modalBody");
  var mIcon = document.getElementById("modalIcon");
  var lastFocus = null;

  function openModal(key) {
    var d = MODALS[key];
    if (!d) return;
    mTitle.textContent = d.title;
    mIcon.innerHTML = '<use href="#' + d.icon + '"/>';
    var frag = "";
    d.body.forEach(function (para) {
      if (para.charAt(0) === "@") {
        frag += '<p class="result-label">' + para.slice(1) + "</p>";
      } else {
        frag += "<p>" + para + "</p>";
      }
    });
    mBody.innerHTML = frag;
    lastFocus = document.activeElement;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    document.getElementById("modalClose").focus();
  }
  function closeModal() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  document.querySelectorAll("[data-modal]").forEach(function (el) {
    el.addEventListener("click", function () { openModal(el.getAttribute("data-modal")); });
  });
  if (overlay) {
    var modalCloseBtn = document.getElementById("modalClose");
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
    });
  }

  /* ---------- Leistungen-Detailseiten: Stufen-Strip (Lösung/Leistungen) ---------- */
  (function () {
    var strip = document.querySelector(".stufen-strip");
    if (!strip) return;
    var tiles = strip.querySelectorAll(".stufe-tile");
    var panels = document.querySelectorAll(".stufe-panel-inner");
    tiles.forEach(function (tile) {
      tile.addEventListener("click", function () {
        var key = tile.getAttribute("data-stufe");
        tiles.forEach(function (t) { t.setAttribute("aria-selected", t === tile ? "true" : "false"); });
        panels.forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== key; });
      });
    });
  })();

  /* ---------- Leistungen-Detailseiten: horizontale Ablauf-Timeline (Onboarding) ---------- */
  (function () {
    var steps = document.querySelectorAll(".onboarding-step[data-onboarding-step]");
    var panels = document.querySelectorAll(".onboarding-detail[data-onboarding-panel]");
    if (!steps.length || !panels.length) return;
    steps.forEach(function (step) {
      step.addEventListener("click", function () {
        var key = step.getAttribute("data-onboarding-step");
        steps.forEach(function (s) {
          var active = s === step;
          s.classList.toggle("is-active", active);
          s.setAttribute("aria-selected", active ? "true" : "false");
        });
        panels.forEach(function (p) {
          p.classList.toggle("is-active", p.getAttribute("data-onboarding-panel") === key);
        });
      });
    });
  })();

  /* ---------- Leistungen-Detailseiten: Zeitplan-Modal (horizontale Timeline) ---------- */
  (function () {
    var openers = document.querySelectorAll(".js-onboarding-open");
    var overlay = document.getElementById("onboardingModalOverlay");
    if (!openers.length || !overlay) return;
    var closeBtn = document.getElementById("onboardingModalClose");
    var lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }
    openers.forEach(function (opener) { opener.addEventListener("click", open); });
    if (closeBtn) closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });
  })();

  /* ---------- Leistungen-Detailseiten: PDF-Vorschau-Modal (Stufe 1 Download) ---------- */
  (function () {
    var openers = document.querySelectorAll(".js-pdf-open");
    var overlay = document.getElementById("pdfModalOverlay");
    if (!openers.length || !overlay) return;
    var closeBtn = document.getElementById("pdfModalClose");
    var lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }
    openers.forEach(function (opener) { opener.addEventListener("click", open); });
    if (closeBtn) closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });
  })();

  /* ---------- Sprint Landingpage: Kontaktformular-Modal ---------- */
  (function () {
    var openers = document.querySelectorAll(".js-form-open");
    var overlay = document.getElementById("formModalOverlay");
    if (!openers.length || !overlay) return;
    var closeBtn = document.getElementById("formModalClose");
    var lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      var firstField = overlay.querySelector("input");
      if (firstField) firstField.focus();
    }
    function close() {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }
    openers.forEach(function (opener) { opener.addEventListener("click", open); });
    if (closeBtn) closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });

    var form = overlay.querySelector(".contact-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = new FormData(form);
        var vorname = (data.get("vorname") || "").toString().trim();
        var name = (data.get("name") || "").toString().trim();
        var funktion = (data.get("funktion") || "").toString().trim();
        var firma = (data.get("firma") || "").toString().trim();
        var tel = (data.get("tel") || "").toString().trim();
        var termin = (data.get("termin") || "").toString().trim();

        var introEl = overlay.querySelector(".form-mail-body");
        var intro = introEl ? introEl.textContent.trim() : "";

        var lines = [intro, ""];
        lines.push("Name: " + vorname + " " + name);
        if (funktion) lines.push("Funktion: " + funktion);
        lines.push("Firma: " + firma);
        if (tel) lines.push("Tel. Nr.: " + tel);
        if (termin) lines.push("Wunschtermin für den 2-Tages-Sprint: " + termin);

        var subject = "Unverbindliches Angebot: Sprint Landingpage";
        var body = lines.join("\n");
        var mailto =
          "mailto:daniel.stroebel@empiria.de" +
          "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(body);
        window.location.href = mailto;
      });
    }
  })();

  /* ---------- Generische Vorschau-Modals (data-modal-target / data-generic) ----------
     Ermöglicht mehrere unabhängige Vorschau-Modals auf einer Seite (z.B. "Medien, die
     Ergebnisse liefern" mit je einem Modal für PowerPoint, Landingpage, Roll-up), ohne
     die bestehenden fest verdrahteten Modals (#pdfModalOverlay etc.) zu beeinflussen. */
  (function () {
    document.querySelectorAll(".modal-overlay[data-generic]").forEach(function (overlay) {
      var closeBtn = overlay.querySelector(".modal-close");
      var lastFocus = null;
      function open() {
        lastFocus = document.activeElement;
        overlay.classList.add("open");
        document.body.style.overflow = "hidden";
        if (closeBtn) closeBtn.focus();
      }
      function close() {
        overlay.classList.remove("open");
        document.body.style.overflow = "";
        if (lastFocus) lastFocus.focus();
      }
      document.querySelectorAll('[data-modal-target="' + overlay.id + '"]').forEach(function (opener) {
        opener.addEventListener("click", open);
      });
      if (closeBtn) closeBtn.addEventListener("click", close);
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) close();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && overlay.classList.contains("open")) close();
      });
    });
  })();

  /* ---------- Produktseiten: Scroll-Reveal (Fade + Slide-up via IntersectionObserver) ---------- */
  (function () {
    var els = document.querySelectorAll(".reveal");
    if (!els.length || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js-reveal-ready");
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 60 + "ms";
      io.observe(el);
    });
  })();
})();
