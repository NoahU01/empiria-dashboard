/* Vorbereitung eines Termins – eine Quelle für alle Ansichten (Daniel, 09.11.2026: überall, wo der Termin auftaucht).
   Gepflegt wird sie im Projekt: projekt_punkte mit art = 'Vorbereitung' am Ereignis (projekt_ereignisse).
   Zeilen mit „datei“ sind Unterlagen im geschützten Speicher (Bucket „unterlagen“) – sie öffnen sich nur angemeldet
   über einen kurzlebigen Link. Die Terminliste findet das Ereignis über aktivitaet_extern = 'kalender:' + graph_id. */
(function () {
  var db = window.empiriaDb;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // Unterlagen (PDFs) zuerst, dann der Text – sonst verschwinden sie unten in der Detailspalte (Daniel, 09.11.2026)
  function ordnen(l) { return l.slice().sort(function (a, b) { return (b.datei ? 1 : 0) - (a.datei ? 1 : 0) || a.id - b.id; }); }

  function zeilen(punkte) {
    return ordnen(punkte).map(function (x) {
      return x.datei ? '<li><a href="#" class="pr-unterlage" data-datei="' + esc(x.datei) + '">' + esc(x.text) + "</a></li>" : "<li>" + esc(x.text) + "</li>";
    }).join("");
  }

  // Für Kalendertermine (Tabelle termine): liefert { graph_id: [punkte] }
  function fuerTermine(termine) {
    var ids = (termine || []).map(function (t) { return t.graph_id; }).filter(Boolean);
    if (!db || !ids.length) return Promise.resolve({});
    return db.from("projekt_ereignisse").select("id, aktivitaet_extern").in("aktivitaet_extern", ids.map(function (g) { return "kalender:" + g; })).then(function (r) {
      var ev = r.data || [], zuG = {};
      ev.forEach(function (e) { zuG[e.id] = e.aktivitaet_extern.slice(9); });
      if (!ev.length) return {};
      return db.from("projekt_punkte").select("id, ereignis_id, text, datei").eq("art", "Vorbereitung").in("ereignis_id", ev.map(function (e) { return e.id; })).then(function (r2) {
        var m = {};
        (r2.data || []).forEach(function (p) { var g = zuG[p.ereignis_id]; (m[g] = m[g] || []).push(p); });
        return m;
      });
    });
  }

  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest(".pr-unterlage");
    if (!a || !db) return;
    ev.preventDefault();
    var fenster = window.open("", "_blank");
    db.storage.from("unterlagen").createSignedUrl(a.getAttribute("data-datei"), 600).then(function (r) {
      if (r.error || !r.data) { if (fenster) fenster.close(); alert("Die Unterlage ließ sich nicht öffnen."); return; }
      if (fenster) fenster.location = r.data.signedUrl; else location.href = r.data.signedUrl;
    });
  });

  window.EmpiriaVorbereitung = { zeilen: zeilen, fuerTermine: fuerTermine };
})();
