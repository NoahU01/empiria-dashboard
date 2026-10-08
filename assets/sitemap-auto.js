/* Sitemap: automatische Seitenliste aus assets/seiten.json (täglich 6:30 vom Mac erzeugt, siehe ~/AlwaysOn/pruefung/sitemap.py)
   und Knopf „Jetzt aktualisieren“ (Anstoß art='sitemap' → Wächter auf dem Mac → Skript → Veröffentlichung → Seite lädt neu). */
(function () {
  "use strict";
  var ziel = document.querySelector("[data-sitemap-auto]"); if (!ziel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  fetch("/assets/seiten.json?" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
    var gruppen = [], nachGruppe = {};
    d.seiten.forEach(function (s) { if (!nachGruppe[s.gruppe]) { nachGruppe[s.gruppe] = []; gruppen.push(s.gruppe); } nachGruppe[s.gruppe].push(s); });
    var fehlen = d.seiten.filter(function (s) { return !s.im_diagramm; });
    function eintrag(s) {
      var kinder = d.seiten.filter(function (k) { return k.eltern === s.datei; });
      return '<li><a href="/strategie/' + esc(s.datei) + '">' + esc(s.titel) + "</a>" + (s.kurz ? " <small>" + esc(s.kurz) + "</small>" : "") +
        (s.im_diagramm ? "" : ' <span class="sma-neu">noch nicht im Diagramm</span>') +
        (kinder.length ? "<ul>" + kinder.map(eintrag).join("") + "</ul>" : "") + "</li>";
    }
    ziel.innerHTML = '<div class="sma-kopf"><h2 class="sm-h2">Alle Seiten – automatisch</h2><div class="sma-rechts"><button type="button" class="ans-knopf" data-sma><span aria-hidden="true">↻</span> Jetzt aktualisieren</button><p class="ans-stand" data-sma-stand>Stand ' + esc(d.stand || "") + "</p></div></div>" +
      (fehlen.length ? '<p class="sma-hinweis">Im Diagramm unten fehlen noch: ' + fehlen.map(function (s) { return esc(s.titel); }).join(", ") + "</p>" : "") +
      '<div class="sma-gruppen">' + gruppen.map(function (g) {
        return '<div><p class="sm-tag">' + esc(g) + "</p><ul>" + nachGruppe[g].filter(function (s) { return !s.eltern || !d.seiten.some(function (x) { return x.datei === s.eltern; }); }).map(eintrag).join("") + "</ul></div>";
      }).join("") + "</div>";
    verdrahten();
  }).catch(function () { ziel.innerHTML = ""; });
  function verdrahten() {
    var db = window.empiriaDb, b = ziel.querySelector("[data-sma]"), st = ziel.querySelector("[data-sma-stand]");
    if (!db) { b.hidden = true; return; }
    b.onclick = function () {
      b.disabled = true; st.textContent = "Wird angefragt …";
      db.from("anstoesse").insert({ quelle: "sitemap", art: "sitemap" }).select("id").single().then(function (r) {
        if (r.error) { st.textContent = "Nicht angefragt: " + r.error.message + " – bitte einmal auf der Kontaktseite anmelden."; b.disabled = false; return; }
        var id = r.data.id, t0 = Date.now();
        (function nachsehen() {
          db.from("anstoesse").select("status, ergebnis").eq("id", id).single().then(function (x) {
            var a = x.data || {};
            if (a.status === "fertig") {
              if (/unverändert/.test(a.ergebnis || "")) { st.textContent = "Keine Änderung – die Sitemap ist aktuell."; b.disabled = false; return; }
              st.textContent = "Aktualisiert – wird veröffentlicht, die Seite lädt in einer Minute neu …"; setTimeout(function () { location.reload(); }, 60000); return;
            }
            st.textContent = a.status === "läuft" ? "Der Mac liest gerade den Aufbau aus …" : "Angefragt – startet innerhalb einer Minute …";
            if (Date.now() - t0 < 10 * 60000) setTimeout(nachsehen, 5000);
          });
        })();
      });
    };
  }
})();
