/* Aufgaben – was Daniel sieht: Details als Stichpunkte (aus dem Diktat, eine Zeile = ein Punkt) plus verlinkte Unterlagen
   und in einfacher Sprache, wovon die Aufgabe abhängt bzw. auf wen sie wartet.
   Die Logik dahinter (Weg, Mail-Gespräch, Kette) bleibt in der Datenbank und wird nicht gezeigt.
   Genutzt von projekte-crm.js und aufgaben-board.js.
     AufgabenDetails.html(a)        → Stichpunkte zum Aufklappen oder ""
     AufgabenDetails.lage(a, alle)  → immer sichtbare Zeilen: „Hängt ab von …“, „Wartet auf Rückmeldung von …“, Hinweis */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  function html(a) {
    var punkte = String(a.beschreibung || "").split("\n").map(function (x) { return x.replace(/^[-•·]\s*/, "").trim(); }).filter(Boolean);
    var links = (a.unterlagen || []).filter(function (u) { return u && u.url; }).map(function (u) {
      return '<li class="ad-link"><a href="' + esc(u.url) + '" target="_blank" rel="noopener">' + esc(u.titel || "Link") + "</a></li>"; });
    var li = punkte.map(function (x) { return "<li>" + esc(x) + "</li>"; }).concat(links);
    return li.length ? '<ul class="ad-punkte">' + li.join("") + "</ul>" : "";
  }

  function lage(a, alle) {
    if (a.status !== "offen") return "";
    var offenVor = (a.vorgaenger || []).map(function (id) { return (alle || []).filter(function (x) { return x.id === +id && x.status !== "erledigt"; })[0]; }).filter(Boolean);
    var h = offenVor.length ? '<p class="pr-wartet">Hängt ab von: ' + offenVor.map(function (v) {
      return '<button type="button" class="ad-kette" data-zu-aufgabe="' + v.id + '">' + esc(v.titel) + "</button>"; }).join(", ") + "</p>" : "";
    if (a.hinweis) h += '<p class="pr-hinweis">' + esc(a.hinweis) + "</p>";
    return h;
  }

  // Klick auf „Hängt ab von …“: zur Aufgabe springen
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-zu-aufgabe]"); if (!b) return;
    var ziel = document.querySelector('[data-a="' + b.getAttribute("data-zu-aufgabe") + '"]'); if (!ziel) return;
    ziel.scrollIntoView({ behavior: "smooth", block: "center" });
    ziel.classList.add("ad-blink"); setTimeout(function () { ziel.classList.remove("ad-blink"); }, 1200);
  });

  window.AufgabenDetails = { html: html, lage: lage };
})();
