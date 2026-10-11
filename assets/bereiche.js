/* Aufklappbare Bereiche wie auf der Marketing-Seite (Daniel, 10.10.2026) – genutzt von Strategie und Steuerung.
     Bereiche.html(seite, key, titel, inhalt, fest)  → Kasten mit Kopfzeile zum Auf- und Zuklappen;
                                                       fest = "auf"/"zu": startet immer so, ohne sich etwas zu merken
     Bereiche.verdrahten(wurzel, seite)        → Klick schaltet um; Zustand je Seite und Bereich gemerkt (Standard: offen) */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function offen(seite, key) { try { return localStorage.getItem("bereich-" + seite + "-" + key) !== "zu"; } catch (x) { return true; } }
  var BESUCH = {};   // fest vorgegebene Bereiche: Zustand nur während dieses Seitenbesuchs (überlebt Neuzeichnen)
  function html(seite, key, titel, inhalt, fest) {
    var k = seite + "-" + key, auf = fest ? (k in BESUCH ? BESUCH[k] : fest === "auf") : offen(seite, key);
    return '<section class="kt3-box kt3-breit kg-bereich br-bereich' + (auf ? "" : " pr-zu") + '" data-bereich="' + esc(key) + '" id="' + esc(key) + '"' + (fest ? " data-fest" : "") + ">" +
      '<h3><button type="button" class="pr-klapp" aria-expanded="' + auf + '"><span>' + esc(titel) + '</span><span class="tl-dreieck" aria-hidden="true"></span></button></h3>' +
      '<div class="kg-inhalt">' + inhalt + "</div></section>";
  }
  function verdrahten(wurzel, seite) {
    wurzel.querySelectorAll(".br-bereich > h3 > .pr-klapp").forEach(function (b) {
      b.onclick = function () {
        var sek = b.closest("[data-bereich]"), auf = sek.classList.contains("pr-zu");
        sek.classList.toggle("pr-zu", !auf); b.setAttribute("aria-expanded", String(auf));
        BESUCH[seite + "-" + sek.getAttribute("data-bereich")] = auf;
        if (!sek.hasAttribute("data-fest")) try { localStorage.setItem("bereich-" + seite + "-" + sek.getAttribute("data-bereich"), auf ? "auf" : "zu"); } catch (x) {}
      };
    });
    // Sprung von außen (z. B. #termine) öffnet den Bereich
    var h = location.hash.slice(1), ziel = h && wurzel.querySelector('[data-bereich="' + h + '"]');
    if (ziel && ziel.classList.contains("pr-zu")) ziel.querySelector(".pr-klapp").click();
  }
  window.Bereiche = { html: html, verdrahten: verdrahten };
})();
