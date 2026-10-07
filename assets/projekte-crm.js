/* Projekte – Steckbrief je Projekt: Thema und Überlegungen, Claude-Impuls, Entscheidungen, Aufgaben
   (mit Zuständigkeit), Timeline aus Terminen und Ereignissen mit Protokoll/Entscheidungen/Aufgaben,
   Beteiligte. Übersicht #, Projekt #p=ID. Anmeldung wie auf der Kontaktseite (Login-Link). */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-projekte]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function datum(d) { return d ? new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }) : ""; }
  function kurz(d) { return d ? new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }) : ""; }
  function name(k) { return k ? [k.vorname, k.nachname].filter(Boolean).join(" ") : ""; }
  var STATUS = { "läuft": "st-laeuft", "wartet auf dich": "st-dich", "blockiert": "st-blockiert", "pausiert": "st-pause", "abgeschlossen": "st-pause" };

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden – dann erscheinen hier die Projekte.</p></div>'; return; }
    route();
  });
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });
  function route() {
    var h = location.hash.replace("#", "");
    document.body.classList.toggle("kt3-detail", /^p=\d+$/.test(h));
    if (/^p=\d+$/.test(h)) projekt(+h.slice(2)); else liste();
  }

  /* ---------- Übersicht ---------- */
  function liste() {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("projekte").select("id, name, phase, status, thema, organisationen(id, name)").order("name"),
      db.from("projekt_ereignisse").select("projekt_id, datum, titel").gte("datum", new Date().toISOString()).order("datum"),
      db.from("aufgaben").select("projekt_id, titel, zustaendig_name").eq("status", "offen").not("projekt_id", "is", null).order("angelegt_am")
    ]).then(function (r) {
      var p = r[0].data || [], nae = {}, auf = {};
      (r[1].data || []).forEach(function (e) { if (!nae[e.projekt_id]) nae[e.projekt_id] = e; });
      (r[2].data || []).forEach(function (a) { if (!auf[a.projekt_id]) auf[a.projekt_id] = a; });
      wurzel.innerHTML = '<table class="kt3-tab pr-tab"><colgroup><col style="width:24%"><col style="width:22%"><col style="width:16%"><col style="width:20%"><col style="width:18%"></colgroup>' +
        "<thead><tr><th>Projekt</th><th>Kunde</th><th>Phase · Status</th><th>Nächste Aufgabe</th><th>Nächster Termin</th></tr></thead><tbody>" +
        p.map(function (x) {
          var a = auf[x.id], n = nae[x.id];
          return '<tr data-href="#p=' + x.id + '"><td><a class="kt3-p" href="#p=' + x.id + '">' + esc(x.name) + "</a></td><td>" + esc(x.organisationen ? x.organisationen.name : "") +
            '</td><td>' + esc(x.phase || "") + '<br><span class="pr-st ' + STATUS[x.status] + '">' + esc(x.status) + "</span></td><td>" + (a ? esc(a.titel) + (a.zustaendig_name ? ' <span class="kt3-leise">· ' + esc(a.zustaendig_name) + "</span>" : "") : '<span class="kt3-leise">–</span>') +
            "</td><td>" + (n ? kurz(n.datum) + '<br><span class="kt3-leise">' + esc(n.titel) + "</span>" : '<span class="kt3-leise">–</span>') + "</td></tr>";
        }).join("") + "</tbody></table>";
      wurzel.querySelectorAll("tr[data-href]").forEach(function (tr) { tr.onclick = function (e) { if (!e.target.closest("a")) location.hash = tr.getAttribute("data-href"); }; });
    });
  }

  /* ---------- Projekt ---------- */
  function projekt(id) {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("projekte").select("*, organisationen(id, name)").eq("id", id).single(),
      db.from("projekt_beteiligte").select("id, seite, rolle, name, kontakte(id, vorname, nachname, position)").eq("projekt_id", id),
      db.from("projekt_ereignisse").select("id, datum, art, titel, quelle, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("datum", { ascending: false }),
      db.from("projekt_punkte").select("id, ereignis_id, art, text, angelegt_am, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am", { ascending: false }),
      db.from("aufgaben").select("id, titel, status, faellig_am, ereignis_id, zustaendig_name, kontakte:zustaendig_kontakt_id(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am")
    ]).then(function (r) {
      if (r[0].error) { wurzel.innerHTML = '<p class="kb-leer">Fehler: ' + esc(r[0].error.message) + "</p>"; return; }
      zeichnen(r[0].data, r[1].data || [], r[2].data || [], r[3].data || [], r[4].data || []);
    });
  }

  function wer(a) { return a.zustaendig_name || name(a.kontakte) || ""; }
  function zeichnen(p, bet, ere, pkt, auf) {
    var h = '<a class="kb-zurueck" href="#"><span aria-hidden="true">&larr;</span> Projekte</a>';
    h += '<div class="kt3-kopf"><div><h2 class="kt3-name">' + esc(p.name) + '</h2><p class="kt3-sub">' +
      [p.organisationen ? '<a href="/strategie/kontakte.html#f=' + p.organisationen.id + '">' + esc(p.organisationen.name) + "</a>" : "", esc(p.marke || ""), esc(p.phase || ""),
       '<span class="pr-st ' + STATUS[p.status] + '">' + esc(p.status) + "</span>"].filter(Boolean).join(" · ") + "</p></div></div>";
    // Claude-Impuls ganz oben
    h += '<section class="pr-impuls"><p class="pr-impuls-kopf">Claude – was jetzt ansteht</p><p>' + (p.claude_impuls ? esc(p.claude_impuls) :
      "Noch kein Impuls. Diktiere mir, was im Projekt passiert ist – ich halte Protokoll, Entscheidungen und Aufgaben fest und sage dir, was als Nächstes dran ist.") + "</p>" +
      (p.impuls_stand ? '<p class="kt3-stand-klein">Stand ' + datum(p.impuls_stand) + "</p>" : "") + "</section>";
    h += '<div class="kt3-raster">';
    h += '<section class="kt3-box"><h3>Thema</h3><p class="kt3-t">' + esc(p.thema || "–") + '</p><h3 class="pr-h3b">Überlegungen</h3>' +
      '<textarea class="pr-ueb" data-ueb placeholder="Deine Überlegungen zum Projekt …">' + esc(p.ueberlegungen || "") + '</textarea><button type="button" class="pr-speichern" data-ueb-speichern hidden>Speichern</button></section>';
    var ent = pkt.filter(function (x) { return x.art === "Entscheidung"; });
    h += '<section class="kt3-box"><h3>Entscheidungen</h3>' + (ent.length ? '<ul class="pr-ent">' + ent.map(function (e) {
      var ev = ere.filter(function (x) { return x.id === e.ereignis_id; })[0];
      return "<li><p>" + esc(e.text) + '</p><span class="kt3-leise">' + esc([ev ? kurz(ev.datum) + " · " + ev.titel : datum(e.angelegt_am), name(e.kontakte)].filter(Boolean).join(" · ")) + "</span></li>"; }).join("") + "</ul>"
      : '<p class="kt3-leise">Noch keine Entscheidungen festgehalten.</p>') + "</section>";
    // Aufgaben mit Zuständigkeit
    var offen = auf.filter(function (a) { return a.status === "offen"; });
    var namen = ["Daniel"].concat(bet.map(function (b) { return b.name || name(b.kontakte); })).filter(function (x, i, l) { return x && l.indexOf(x) === i; });
    h += '<section class="kt3-box kt3-breit"><h3>Aufgaben</h3>' + (offen.length ? '<ul class="kt3-todo pr-auf">' + offen.map(function (a) {
      return '<li data-a="' + a.id + '"><button type="button" class="st-haken" aria-label="Erledigt"></button><span>' + esc(a.titel) + '</span><span class="pr-wer">' + esc(wer(a) || "offen") +
        (a.faellig_am ? " · bis " + kurz(a.faellig_am) : "") + "</span></li>"; }).join("") + "</ul>" : '<p class="kt3-leise">Nichts offen.</p>') +
      '<form class="kt3-neu pr-neu" data-neu><input type="text" placeholder="Neue Aufgabe …" data-titel><input type="text" list="pr-namen" placeholder="Wer?" data-wer class="pr-wer-feld">' +
      '<datalist id="pr-namen">' + namen.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + '</datalist><button type="submit">+</button></form></section>';
    // Timeline
    var jetzt = Date.now();
    h += '<section class="kt3-box kt3-breit"><h3>Timeline</h3><ol class="pr-tl">' + ere.map(function (e, i) {
      var p2 = pkt.filter(function (x) { return x.ereignis_id === e.id; }), a2 = auf.filter(function (x) { return x.ereignis_id === e.id; });
      var zuk = new Date(e.datum) > jetzt;
      return "<li" + (i >= 6 ? " hidden data-mehr" : "") + ' class="' + (zuk ? "pr-zuk" : "") + '"><span class="pr-d">' + (zuk ? "geplant · " : "") + kurz(e.datum) + "</span><div><b>" + esc(e.titel) + '</b> <span class="kt3-leise">' + esc(e.art) + (e.kontakte ? " · " + esc(name(e.kontakte)) : "") + "</span>" +
        p2.filter(function (x) { return x.art === "Protokoll"; }).map(function (x) { return '<p class="pr-prot">' + esc(x.text) + "</p>"; }).join("") +
        p2.filter(function (x) { return x.art === "Entscheidung"; }).map(function (x) { return '<p class="pr-e"><span>Entscheidung</span>' + esc(x.text) + "</p>"; }).join("") +
        a2.map(function (x) { return '<p class="pr-a"><span>Aufgabe</span>' + esc(x.titel) + ' <i>' + esc(wer(x)) + "</i>" + (x.status === "erledigt" ? " ✓" : "") + "</p>"; }).join("") + "</div></li>";
    }).join("") + "</ol>" + (ere.length > 6 ? '<button type="button" class="kt3-klapp" data-klapp-knopf aria-expanded="false">Alle zeigen</button>' : "") + "</section>";
    // Beteiligte
    function seite(s) {
      var l = bet.filter(function (b) { return b.seite === s; });
      return l.length ? '<ul class="pr-bet">' + l.map(function (b) {
        return "<li>" + (b.kontakte ? '<a href="/strategie/kontakte.html#k=' + b.kontakte.id + '">' + esc(name(b.kontakte)) + "</a>" : esc(b.name)) +
          '<span class="kt3-leise">' + esc(b.rolle || (b.kontakte && b.kontakte.position) || "") + "</span></li>"; }).join("") + "</ul>" : '<p class="kt3-leise">–</p>';
    }
    h += '<section class="kt3-box"><h3>Beteiligte beim Kunden</h3>' + seite("Kunde") + '</section><section class="kt3-box"><h3>Team</h3>' + seite("empiria") + seite("Partner").replace('<p class="kt3-leise">–</p>', "") + "</section>";
    wurzel.innerHTML = h + "</div>";
    verdrahten(p);
  }

  function verdrahten(p) {
    var ta = wurzel.querySelector("[data-ueb]"), sp = wurzel.querySelector("[data-ueb-speichern]");
    ta.oninput = function () { sp.hidden = false; };
    sp.onclick = function () { sp.disabled = true; db.from("projekte").update({ ueberlegungen: ta.value }).eq("id", p.id).then(function (r) { sp.disabled = false; if (r.error) alert(r.error.message); else sp.hidden = true; }); };
    wurzel.querySelectorAll("[data-a] .st-haken").forEach(function (b) {
      b.onclick = function () { var li = b.closest("li"); li.classList.add("st-weg");
        db.from("aufgaben").update({ status: "erledigt", erledigt_am: new Date().toISOString() }).eq("id", +li.getAttribute("data-a")).then(function (r) { if (r.error) { li.classList.remove("st-weg"); alert(r.error.message); } }); };
    });
    var f = wurzel.querySelector("[data-neu]");
    f.onsubmit = function (e) {
      e.preventDefault();
      var t = f.querySelector("[data-titel]").value.trim(), w = f.querySelector("[data-wer]").value.trim(); if (!t) return;
      f.classList.add("laedt");
      db.from("aufgaben").insert({ titel: t, projekt_id: p.id, zustaendig_name: w || "Daniel", bereich: "Projekt" }).then(function (r) { if (r.error) { f.classList.remove("laedt"); alert(r.error.message); } else projekt(p.id); });
    };
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-klapp-knopf]"); if (!b || !wurzel.contains(b)) return;
    var auf = b.getAttribute("aria-expanded") !== "true";
    b.closest(".kt3-box").querySelectorAll("[data-mehr]").forEach(function (x) { x.hidden = !auf; });
    b.setAttribute("aria-expanded", String(auf)); b.textContent = auf ? "Weniger zeigen" : "Alle zeigen";
  });
})();
