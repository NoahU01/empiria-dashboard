/* Gesamtdashboard (Entwurf): kleine Ergänzungen zu analyse.js und steuerung.js.
   - Karten auf dem Tisch: „Details“ klappt Kern und Stichpunkte auf (sonst nur Titel, Vorschlag, Knöpfe)
   - Termine: Liste in einen eigenen Scrollbereich, damit der Kasten eine feste Höhe hat
   Beide Skripte zeichnen bei jeder Änderung neu – deshalb über einen Beobachter, nicht einmalig. */
(function () {
  "use strict";
  var auf = {};
  function nachbessern() {
    document.querySelectorAll(".st4-karte").forEach(function (k) {
      var id = k.getAttribute("data-v");
      if (auf[id]) k.classList.add("ck-auf");
      if (k.querySelector(".ck-mehr") || !k.querySelector(".st4-mitte *")) return;
      var b = document.createElement("button"); b.type = "button"; b.className = "ck-mehr";
      b.textContent = auf[id] ? "Weniger" : "Details";
      b.onclick = function () { auf[id] = !auf[id]; k.classList.toggle("ck-auf", auf[id]); b.textContent = auf[id] ? "Weniger" : "Details"; };
      k.querySelector(".st4-kopf").appendChild(b);
    });
    var t = document.getElementById("termine");
    if (t && !t.querySelector(".ck-termine-liste")) {
      var l = document.createElement("div"); l.className = "ck-termine-liste";
      Array.prototype.slice.call(t.children).forEach(function (c) { if (c.classList.contains("an-tag") || c.classList.contains("an-leer")) l.appendChild(c); });
      t.appendChild(l);
    }
  }
  var raster = document.querySelector(".ck-grid"); if (!raster) return;
  // Beobachter schaltet sich während des Nachbesserns ab – sonst würde er sich selbst auslösen
  var obs = new MutationObserver(function () { obs.disconnect(); nachbessern(); obs.observe(raster, { childList: true, subtree: true }); });
  nachbessern();   // falls beide Seiten schon gezeichnet haben, bevor dieses Skript lief
  obs.observe(raster, { childList: true, subtree: true });
})();
