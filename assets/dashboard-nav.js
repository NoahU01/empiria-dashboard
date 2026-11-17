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
  var maus = window.matchMedia("(hover: hover) and (pointer: fine)");   // Öffnen per Darüberfahren nur mit echter Maus – auf dem iPad schloss der Tipp sonst sofort wieder
  var paare = [];

  function zu() {
    paare.forEach(function (p) {
      p.kinder.classList.remove("is-open"); p.sub.classList.remove("is-open"); p.b.setAttribute("aria-expanded", "false");
      if (p.platz && p.platz.parentNode) p.platz.parentNode.insertBefore(p.kinder, p.platz);   // zurück an den alten Platz in der Liste
    });
    panel.classList.remove("zeigt-kinder");
  }
  // Zweite Ebene fest am Fenster neben die Zeile setzen – bleibt sichtbar, auch wenn die Liste scrollt
  // Höhe erst nach dem Aufbau messen und nie über den Fensterrand hinaus (Daniel, 17.11.2026: Fenster ab Eintrag C abgeschnitten)
  function setzen(p) {
    var hoch = window.innerHeight;
    p.kinder.style.maxHeight = (hoch - 16) + "px";
    var z = p.sub.getBoundingClientRect(), r = panel.getBoundingClientRect(), h = Math.min(p.kinder.scrollHeight, hoch - 16);
    p.kinder.style.left = Math.round(r.right + 8) + "px";
    p.kinder.style.top = Math.round(Math.max(8, Math.min(z.top - 11, hoch - h - 8))) + "px";
  }
  window.addEventListener("resize", function () { paare.forEach(function (p) { if (p.kinder.classList.contains("is-open") && !schmal.matches) setzen(p); }); });
  panel.addEventListener("scroll", function () { paare.forEach(function (p) { if (p.kinder.classList.contains("is-open") && !schmal.matches) setzen(p); }); });
  function auf(p) {
    zu();
    /* Großer Bildschirm: die zweite Ebene hängt beim Öffnen direkt an der Seite statt im Kopfbereich.
       Der Kopfbereich ist weichgezeichnet (backdrop-filter); Safari schneidet feste Fenster darin ab
       (Daniel, 17.11.2026: nur die oberen drei Einträge sichtbar). */
    if (!schmal.matches && p.kinder.parentNode !== document.body) {
      if (!p.platz) { p.platz = document.createComment("sn-kinder"); p.kinder.parentNode.insertBefore(p.platz, p.kinder); }
      document.body.appendChild(p.kinder);
    }
    p.kinder.classList.add("is-open"); p.sub.classList.add("is-open"); p.b.setAttribute("aria-expanded", "true");
    if (!schmal.matches) { setzen(p); requestAnimationFrame(function () { requestAnimationFrame(function () { setzen(p); }); }); }
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
      el.addEventListener("mouseenter", function () { if (schmal.matches || !maus.matches) return; clearTimeout(p.t); if (!kinder.classList.contains("is-open")) auf(p); });
      el.addEventListener("mouseleave", function () { if (schmal.matches || !maus.matches) return; p.t = setTimeout(function () { if (kinder.classList.contains("is-open")) zu(); }, 250); });
    });
  });
  panel.querySelectorAll(":scope > a.sn-link").forEach(function (a) {
    a.addEventListener("mouseenter", function () { if (!schmal.matches && maus.matches) zu(); });
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
