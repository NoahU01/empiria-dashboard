/* „Jetzt prüfen“ (Analyse, Steuerung, Marketing, Projekte, Aufgaben, Korrespondenz): legt einen Anstoß in der Tabelle anstoesse ab. Ein Wächter auf dem Always-on-Mac
   schaut jede Minute nach, gleicht Aufgaben und Noahs Analytics neu ab und startet sofort die Prüfung (Korrespondenz-Anweisungen, entschiedene Karten).
   Der Knopf zeigt den Stand und lädt die Seite neu, sobald die Prüfung fertig ist. */
(function () {
  "use strict";
  var db = window.empiriaDb, kopf = document.querySelector(".db-kopf");
  if (!db || !kopf) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var box = document.createElement("div"); box.className = "ans";
  box.innerHTML = '<button type="button" class="ans-knopf" data-ans><span aria-hidden="true">↻</span> Jetzt prüfen</button><p class="ans-stand" data-ans-stand></p>';
  kopf.appendChild(box);
  var knopf = box.querySelector("[data-ans]"), stand = box.querySelector("[data-ans-stand]"), id = null, t0 = 0;
  function zeigen(txt, laeuft) { stand.textContent = txt; knopf.disabled = !!laeuft; box.classList.toggle("ans--laeuft", !!laeuft); }
  function nachsehen() {
    db.from("anstoesse").select("id, status, ergebnis").eq("id", id).single().then(function (r) {
      var a = r.data; if (!a) return;
      var min = Math.floor((Date.now() - t0) / 60000);
      if (a.status === "fertig") { zeigen("Fertig – " + String(a.ergebnis || "").split("\n")[0].slice(0, 140)); setTimeout(function () { location.reload(); }, 2500); return; }
      zeigen(a.status === "läuft" ? "Claude arbeitet gerade die offenen Punkte ab …" : "Angefragt – startet innerhalb einer Minute" + (min ? " (" + min + " Min.)" : "") + " …", true);
      if (Date.now() - t0 < 20 * 60000) setTimeout(nachsehen, 6000); else zeigen("Dauert länger – das Ergebnis erscheint auf der Steuerung.");
    });
  }
  // Läuft schon ein Anstoß (z. B. von einem anderen Gerät)? Dann direkt den Stand zeigen
  db.auth.getSession().then(function (s) {
    if (!s.data.session) { box.hidden = true; return; }
    db.from("anstoesse").select("id, status, angelegt_am").neq("status", "fertig").order("id", { ascending: false }).limit(1).then(function (r) {
      var a = (r.data || [])[0];
      if (a && Date.now() - new Date(a.angelegt_am) < 20 * 60000) { id = a.id; t0 = +new Date(a.angelegt_am); nachsehen(); }
    });
  });
  knopf.onclick = function () {
    zeigen("Wird angefragt …", true);
    db.from("anstoesse").insert({ quelle: location.pathname.split("/").pop() }).select("id").single().then(function (r) {
      if (r.error) { zeigen("Nicht angefragt: " + r.error.message); return; }
      id = r.data.id; t0 = Date.now(); nachsehen();
    });
  };
})();
