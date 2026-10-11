/* Medienkonzept (Daniel, 11.10.2026) – Marketing › Medienkonzept je Marke, beginnend mit empiria.
   Der Konzepttext steht in strategie/medienkonzept.html. Dieses Skript zeigt nur den lebenden Teil:
   Themenspeicher und Redaktionsplan aus der Tabelle beitraege (nach Anmeldung). */
(function () {
  "use strict";
  var db = window.empiriaDb, platz = document.querySelector("[data-mz-plan]");
  if (!db || !platz) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var STUFEN = [["position", "Themenspeicher", "Deine Sicht, gesichtet und einem Themenfeld zugeordnet"], ["entwurf", "Entwürfe", "Warten auf deine Freigabe"], ["freigegeben", "Freigegeben", "Werden eingeplant"], ["geplant", "Eingeplant", "Erscheinen automatisch"], ["veroeffentlicht", "Veröffentlicht", "Die letzten Beiträge"]];
  db.auth.getSession().then(function (s) {
    if (!s.data.session) { platz.innerHTML = '<p class="mz-klein">Themenspeicher und Redaktionsplan erscheinen nach der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Anmeldung</a>.</p>'; return; }
    db.from("beitraege").select("id, feld, art, kernaussage, status, geplant_am, linkedin_url").eq("marke", "empiria").neq("status", "verworfen").order("geplant_am", { ascending: true }).then(function (r) {
      var l = r.data || [];
      if (!l.length) { platz.innerHTML = '<div class="mz-plan"><p class="mz-h4">Themenspeicher und Redaktionsplan</p><p class="mz-klein">Noch leer. Er füllt sich, sobald ich deine Themensammlung gesichtet habe: je Eintrag eine Position in einem Satz, einem Themenfeld zugeordnet – du bestätigst nur, ob es noch deine Sicht ist.</p></div>'; return; }
      platz.innerHTML = '<div class="mz-plan"><p class="mz-h4">Themenspeicher und Redaktionsplan</p>' + STUFEN.map(function (st) {
        var x = l.filter(function (b) { return b.status === st[0]; });
        if (!x.length) return "";
        return '<div class="mz-plan-st"><p class="mz-n">' + st[1] + " · " + st[2] + '</p><ul class="mz-liste">' + x.map(function (b) {
          var wann = b.geplant_am ? new Date(b.geplant_am).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" }) + " · " : "";
          return "<li><b>" + esc(b.kernaussage || "") + "</b> <small>" + esc(wann + [b.feld, b.art].filter(Boolean).join(" · ")) + "</small>" + (b.linkedin_url ? ' <a href="' + esc(b.linkedin_url) + '" target="_blank" rel="noopener">ansehen ↗</a>' : "") + "</li>";
        }).join("") + "</ul></div>";
      }).join("") + "</div>";
    });
  });
})();
