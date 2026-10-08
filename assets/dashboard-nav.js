/* Seitenauswahl neben dem Logo: oeffnet und schliesst per Klick,
   schliesst ausserdem bei Klick daneben und mit Escape. */
(function () {
  "use strict";
  var dd = document.querySelector("[data-sn-dd]");
  if (!dd) return;
  var btn = dd.querySelector(".sn-toggle");

  function set(open) {
    dd.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    set(!dd.classList.contains("is-open"));
  });
  document.addEventListener("click", function (e) {
    if (!dd.contains(e.target)) set(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && dd.classList.contains("is-open")) { set(false); btn.focus(); }
  });
})();

/* Unterseiten: Klick auf das Dreieck (oder Zeigen mit der Maus) öffnet die
   zweite Ebene rechts neben der Liste. Auf dem Telefon ersetzt sie die Liste,
   mit „Zurück“ geht es wieder nach oben. */
(function () {
  "use strict";
  var panel = document.getElementById("snPanel");
  if (!panel) return;
  var schmal = window.matchMedia("(max-width: 900px)");
  var paare = [];

  function zu() {
    paare.forEach(function (p) { p.kinder.classList.remove("is-open"); p.sub.classList.remove("is-open"); p.b.setAttribute("aria-expanded", "false"); });
    panel.classList.remove("zeigt-kinder");
  }
  function auf(p) {
    zu();
    if (!schmal.matches) p.kinder.style.top = Math.max(0, p.sub.offsetTop - 11) + "px";
    p.kinder.classList.add("is-open"); p.sub.classList.add("is-open"); p.b.setAttribute("aria-expanded", "true");
    if (schmal.matches) { panel.classList.add("zeigt-kinder"); panel.scrollTop = 0; }
  }

  panel.querySelectorAll(".sn-sub-toggle").forEach(function (b) {
    var kinder = document.getElementById(b.getAttribute("aria-controls"));
    if (!kinder) return;
    var p = { b: b, sub: b.parentNode, kinder: kinder, t: null };
    paare.push(p);
    if (kinder.querySelector('[aria-current="page"]')) p.sub.classList.add("hat-aktuelle");

    var titel = p.sub.querySelector(".sn-txt b").textContent;
    var zurueck = document.createElement("button");
    zurueck.type = "button"; zurueck.className = "sn-zurueck";
    zurueck.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Zur\u00fcck \u00b7 ' + titel;
    zurueck.addEventListener("click", function (e) { e.stopPropagation(); zu(); });
    kinder.insertBefore(zurueck, kinder.firstChild);

    b.addEventListener("click", function (e) {
      e.stopPropagation();
      if (kinder.classList.contains("is-open")) zu(); else auf(p);
    });
    // Desktop: mit der Maus über die Zeile öffnen, kurz verzögert schließen
    [p.sub, kinder].forEach(function (el) {
      el.addEventListener("mouseenter", function () { if (schmal.matches) return; clearTimeout(p.t); if (!kinder.classList.contains("is-open")) auf(p); });
      el.addEventListener("mouseleave", function () { if (schmal.matches) return; p.t = setTimeout(function () { if (kinder.classList.contains("is-open")) zu(); }, 250); });
    });
  });
  panel.querySelectorAll(":scope > a.sn-link").forEach(function (a) {
    a.addEventListener("mouseenter", function () { if (!schmal.matches) zu(); });
  });
  // Menü geschlossen → zweite Ebene auch zu
  var dd = document.querySelector("[data-sn-dd]");
  if (dd) new MutationObserver(function () { if (!dd.classList.contains("is-open")) zu(); }).observe(dd, { attributes: true, attributeFilter: ["class"] });
})();

/* Hauptseiten-Leiste: auf schmalen Geräten die aktuelle Seite ins Bild rücken */
(function () {
  var hn = document.querySelector(".hn"), a = hn && hn.querySelector('[aria-current="page"]');
  function zeigen() { if (a && hn.scrollWidth > hn.clientWidth) hn.scrollLeft = Math.max(0, a.offsetLeft - hn.offsetLeft - 16); }
  zeigen(); window.addEventListener("load", function () { zeigen(); rand(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { zeigen(); rand(); });
  // Verlauf am rechten Rand nur, solange rechts noch etwas kommt
  function rand() { if (hn) hn.classList.toggle("hn--mehr", hn.scrollLeft + hn.clientWidth < hn.scrollWidth - 4); }
  if (hn) { hn.addEventListener("scroll", rand, { passive: true }); window.addEventListener("resize", rand); rand(); }
})();
