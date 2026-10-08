/* Treffen vor Ort (z. B. Baden-Baden 2026) – Tabelle treffen.
   Vollansicht: strategie/treffen.html#p=<projekt>. Auf der Projektseite erscheint oben ein Kasten mit Link dorthin.
   Je Treffen: Briefing (wird auch ins CRM übernommen), Notizen und nächster Schritt; „Protokollieren“ legt die
   Notizen als Aktivität bei der Person und als Protokollpunkt im Projekt ab. */
(function () {
  "use strict";
  var db = window.empiriaDb; if (!db) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var TAG = { 0: "Sonntag", 1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag" };
  function datum(d) { var x = new Date(d); return TAG[x.getDay()] + ", " + x.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }); }
  function zeit(t) { return t.zeit_offen ? "abends" : new Date(t.beginn).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }

  /* ---------- Kasten auf der Projektseite ---------- */
  function kasten() {
    var m = location.hash.match(/^#p=(\d+)$/); if (!m || /treffen\.html/.test(location.pathname)) return;
    var pid = +m[1], ziel = document.querySelector("[data-projekte] .kt3-raster");
    if (!ziel || document.querySelector("[data-treffen-kasten]")) return;
    db.from("treffen").select("id, art, status, erledigt").eq("projekt_id", pid).then(function (r) {
      var l = (r.data || []).filter(function (t) { return t.art === "Termin" || t.art === "Begegnung"; });
      if (!l.length || document.querySelector("[data-treffen-kasten]")) return;
      var termine = l.filter(function (t) { return t.art === "Termin"; }).length, beg = l.length - termine, fertig = l.filter(function (t) { return t.erledigt; }).length;
      var s = document.createElement("section"); s.className = "kt3-box kt3-breit tr-kasten"; s.setAttribute("data-treffen-kasten", "");
      s.innerHTML = '<div><h3>Treffen vor Ort</h3><p>' + termine + " feste Termine · " + beg + " mögliche Begegnungen" + (fertig ? " · " + fertig + " erledigt" : "") + '</p></div><a class="tr-oeffnen" href="/strategie/treffen.html#p=' + pid + '">Liste öffnen <span aria-hidden="true">→</span></a>';
      ziel.insertBefore(s, ziel.firstChild);
    });
  }
  if (document.querySelector("[data-projekte]")) {
    new MutationObserver(kasten).observe(document.querySelector("[data-projekte]"), { childList: true, subtree: true });
    window.addEventListener("hashchange", kasten); kasten();
  }

  /* ---------- Vollansicht ---------- */
  var wurzel = document.querySelector("[data-treffen]"); if (!wurzel) return;
  var PID = +((location.hash.match(/p=(\d+)/) || [])[1] || 13), T = [], AUF = {};
  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname + location.hash) + '">Kontaktseite</a> anmelden.</p></div>'; return; }
    laden();
  });
  function laden() {
    Promise.all([
      db.from("treffen").select("*, kontakte(id, vorname, nachname, position, linkedin_url, kontaktwege(art, wert))").eq("projekt_id", PID).order("reihenfolge"),
      db.from("projekte").select("id, name, marke").eq("id", PID).single()
    ]).then(function (r) {
      T = r[0].data || []; var p = r[1].data;
      var k = document.querySelector("[data-tr-titel]"); if (k && p) k.innerHTML = '<a href="/strategie/projekte.html#p=' + p.id + '">← ' + esc(p.name) + "</a> · " + esc(p.marke || "");
      zeichnen();
    });
  }
  function wege(t) {
    var k = t.kontakte; if (!k) return "";
    return (k.kontaktwege || []).map(function (w) {
      var href = w.art === "E-Mail" ? "mailto:" + w.wert : "tel:" + w.wert.replace(/[^+\d]/g, "");
      return '<a href="' + esc(href) + '">' + esc(w.wert) + "</a>"; }).join(" · ") + (k.linkedin_url ? ' · <a href="' + esc(k.linkedin_url) + '" target="_blank" rel="noopener">LinkedIn</a>' : "");
  }
  function zeile(t) {
    var veranstaltung = t.art === "Veranstaltung";
    var kopf = '<button type="button" class="tr-kopf" data-auf="' + t.id + '" aria-expanded="' + !!AUF[t.id] + '">' +
      '<span class="tr-zeit">' + (t.beginn ? zeit(t) : "") + "</span>" +
      '<span class="tr-wer"><b>' + esc(t.name) + "</b><small>" + esc([t.organisation, veranstaltung ? null : t.position].filter(Boolean).join(" · ")) + "</small>" + (t.ort ? '<small class="tr-ort">' + esc(t.ort) + "</small>" : "") + "</span>" +
      '<span class="tr-status tr-status--' + (t.erledigt ? "fertig" : t.status === "vereinbart" ? "ok" : t.status === "Bestätigung offen" ? "offen" : "leise") + '">' + (t.erledigt ? "✓ erledigt" : esc(t.status)) + "</span></button>";
    if (veranstaltung && !t.naechster_schritt) return '<li class="tr-z tr-z--veranstaltung' + (t.erledigt ? " tr-z--fertig" : "") + '" data-t="' + t.id + '">' + kopf + "</li>";
    var det = !AUF[t.id] ? "" : '<div class="tr-det">' +
      (t.vermittelt_ueber ? '<p class="tr-meta">Vermittelt über: ' + esc(t.vermittelt_ueber) + "</p>" : "") +
      (wege(t) ? '<p class="tr-meta">' + wege(t) + "</p>" : "") +
      (veranstaltung ? '<p class="tr-hinweis">' + esc(t.naechster_schritt) + "</p>" :
      '<label>Briefing <small>Hintergrund – wird auch beim Kontakt im CRM gespeichert</small><textarea data-f="briefing" rows="4">' + esc(t.briefing) + "</textarea></label>" +
      '<label>Notizen vom Gespräch<textarea data-f="notizen" rows="4" placeholder="Was wurde besprochen? – tippen oder diktieren (Mikrofon auf der Tastatur)">' + esc(t.notizen) + "</textarea></label>" +
      '<label>Nächster Schritt<input data-f="naechster_schritt" value="' + esc(t.naechster_schritt) + '"></label>' +
      '<div class="tr-knoepfe"><button type="button" class="tr-ja" data-speichern>Speichern</button>' +
      (t.kontakt_id ? '<button type="button" data-protokoll>' + (t.protokolliert_am ? "Erneut protokollieren" : "Protokollieren") + "</button>" : "") +
      '<button type="button" data-erledigt>' + (t.erledigt ? "Wieder öffnen" : "Erledigt") + "</button>" +
      (t.protokolliert_am ? '<span class="tr-ok">Protokolliert am ' + new Date(t.protokolliert_am).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) + "</span>" : "") +
      (t.kontakt_id ? '<a class="tr-crm" href="/strategie/kontakte.html#k=' + t.kontakt_id + '">Im CRM öffnen</a>' : "") + "</div>") + "</div>";
    return '<li class="tr-z' + (t.erledigt ? " tr-z--fertig" : "") + (AUF[t.id] ? " tr-z--auf" : "") + '" data-t="' + t.id + '">' + kopf + det + "</li>";
  }
  function zeichnen() {
    var tage = {}, h = "";
    T.filter(function (t) { return t.beginn && t.art !== "Kein Treffen" && t.art !== "Begegnung"; }).forEach(function (t) { var k = new Date(t.beginn).toDateString(); (tage[k] = tage[k] || []).push(t); });
    Object.keys(tage).sort(function (a, b) { return new Date(a) - new Date(b); }).forEach(function (k) {
      h += '<section class="tr-tag"><h2>' + datum(k) + '</h2><ul class="tr-liste">' + tage[k].sort(function (a, b) { return new Date(a.beginn) - new Date(b.beginn); }).map(zeile).join("") + "</ul></section>";
    });
    var beg = T.filter(function (t) { return t.art === "Begegnung"; }), kein = T.filter(function (t) { return t.art === "Kein Treffen"; });
    if (beg.length) h += '<section class="tr-tag"><h2>Ohne festen Termin – unterwegs ansprechen</h2><ul class="tr-liste">' + beg.map(zeile).join("") + "</ul></section>";
    if (kein.length) h += '<details class="tr-kein"><summary>Kein Treffen in Baden-Baden (' + kein.length + ")</summary><ul>" + kein.map(function (t) {
      return "<li><b>" + esc(t.name) + "</b> · " + esc(t.organisation) + (t.position ? " · " + esc(t.position) : "") + '<small>' + esc(t.status) + (t.naechster_schritt ? " – " + esc(t.naechster_schritt) : "") + "</small></li>"; }).join("") + "</ul></details>";
    wurzel.innerHTML = h; verdrahten();
  }
  function finde(id) { return T.filter(function (t) { return t.id === id; })[0]; }
  function felder(li) { var f = {}; li.querySelectorAll("[data-f]").forEach(function (x) { f[x.getAttribute("data-f")] = x.value.trim() || null; }); return f; }
  function speichern(t, f, danach) {
    f.geaendert_am = new Date().toISOString();
    db.from("treffen").update(f).eq("id", t.id).then(function (r) {
      if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; }
      for (var k in f) t[k] = f[k];
      var crm = t.kontakt_id && "briefing" in f ? db.from("kontakte").update({ kontaktbriefing: f.briefing }).eq("id", t.kontakt_id) : Promise.resolve();
      Promise.resolve(crm).then(function () { if (danach) danach(); else zeichnen(); });
    });
  }
  function verdrahten() {
    wurzel.querySelectorAll("[data-auf]").forEach(function (b) { b.onclick = function () { var id = +b.getAttribute("data-auf"); AUF[id] = !AUF[id]; zeichnen(); }; });
    wurzel.querySelectorAll(".tr-z").forEach(function (li) {
      var t = finde(+li.getAttribute("data-t")); if (!t) return;
      var sp = li.querySelector("[data-speichern]"), pr = li.querySelector("[data-protokoll]"), er = li.querySelector("[data-erledigt]");
      if (sp) sp.onclick = function () { speichern(t, felder(li)); };
      if (er) er.onclick = function () { var f = felder(li); f.erledigt = !t.erledigt; speichern(t, f); };
      if (pr) pr.onclick = function () {
        var f = felder(li); if (!f.notizen) { alert("Bitte zuerst Notizen eintragen."); return; }
        pr.disabled = true;
        speichern(t, f, function () {
          var wann = t.beginn || new Date().toISOString(), titel = "Baden-Baden 2026 – " + t.name + " (" + t.organisation + ")";
          Promise.all([
            db.from("aktivitaeten").insert({ kontakt_id: t.kontakt_id, datum: wann, kanal: "Treffen", richtung: "beidseitig", anlass: titel, inhalt: t.notizen, naechster_schritt: t.naechster_schritt, quelle: "Dashboard Treffen vor Ort", teilnehmer: [t.name], ort: t.ort }),
            db.from("projekt_punkte").insert({ projekt_id: PID, art: "Protokoll", kontakt_id: t.kontakt_id, text: titel + ": " + t.notizen + (t.naechster_schritt ? " – Nächster Schritt: " + t.naechster_schritt : "") }),
            db.from("treffen").update({ protokolliert_am: new Date().toISOString(), erledigt: true }).eq("id", t.id)
          ]).then(function (r) {
            var fehler = r.filter(function (x) { return x.error; })[0];
            if (fehler) { alert("Protokoll unvollständig: " + fehler.error.message); pr.disabled = false; return; }
            t.protokolliert_am = new Date().toISOString(); t.erledigt = true; zeichnen();
          });
        });
      };
    });
  }
})();
