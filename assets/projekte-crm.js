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
      db.from("projekt_ereignisse").select("id, datum, art, titel, quelle, format, ort, teilnehmer, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("datum", { ascending: false }),
      db.from("projekt_punkte").select("id, ereignis_id, art, text, angelegt_am, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am", { ascending: false }),
      db.from("aufgaben").select("id, titel, beschreibung, status, faellig_am, ereignis_id, zustaendig_name, kontakte:zustaendig_kontakt_id(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am")
    ]).then(function (r) {
      if (r[0].error) { wurzel.innerHTML = '<p class="kb-leer">Fehler: ' + esc(r[0].error.message) + "</p>"; return; }
      zeichnen(r[0].data, r[1].data || [], r[2].data || [], r[3].data || [], r[4].data || []);
    });
  }

  function wer(a) { return a.zustaendig_name || name(a.kontakte) || ""; }
  function format(e) { return e.format === "vor Ort" ? "vor Ort" + (e.ort ? ": " + e.ort : "") : e.format === "offen" ? e.art + " · Ort offen" : e.art + (e.format ? " · " + e.format : ""); }
  function teiln(e) { return (e.teilnehmer || []).length ? "mit " + e.teilnehmer.join(", ") : (e.kontakte ? "mit " + name(e.kontakte) : ""); }
  var STAND = {};
  function detailEreignis(id) {
    var e = STAND.ere.filter(function (x) { return x.id === id; })[0], ziel = wurzel.querySelector("[data-ev-detail]");
    if (!e || !ziel) return;
    var p2 = STAND.pkt.filter(function (x) { return x.ereignis_id === id; }), a2 = STAND.auf.filter(function (x) { return x.ereignis_id === id; });
    function block(t, l) { return l.length ? '<h4>' + t + '</h4><ul>' + l.join("") + "</ul>" : ""; }
    ziel.innerHTML = '<p class="pr-d">' + datum(e.datum) + " · " + new Date(e.datum).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + '</p><h3 class="pr-det-titel">' + esc(e.titel) + "</h3>" +
      '<p class="pr-det-meta">' + esc(format(e)) + (teiln(e) ? "<br>" + esc(teiln(e)) : "") + "</p>" +
      (p2.length || a2.length ?
        block("Notizen", p2.filter(function (x) { return x.art === "Protokoll"; }).map(function (x) { return "<li>" + esc(x.text) + "</li>"; })) +
        block("Entscheidungen", p2.filter(function (x) { return x.art === "Entscheidung"; }).map(function (x) { return "<li>" + esc(x.text) + "</li>"; })) +
        block("Aufgaben", a2.map(function (x) { return "<li>" + esc(x.titel) + ' <span class="kt3-leise">· ' + esc(wer(x)) + (x.faellig_am ? ", bis " + kurz(x.faellig_am) : "") + "</span>" + (x.status === "erledigt" ? " ✓" : "") + "</li>"; }))
        : '<p class="kt3-leise">Noch kein Protokoll. Diktiere mir einfach, was besprochen wurde.</p>');
  }
  function zeichnen(p, bet, ere, pkt, auf) {
    STAND = { ere: ere, pkt: pkt, auf: auf };
    var h = '<a class="kb-zurueck" href="#"><span aria-hidden="true">&larr;</span> Projekte</a>';
    h += '<div class="kt3-kopf"><div><h2 class="kt3-name">' + esc(p.name) + '</h2><p class="kt3-sub">' +
      [p.organisationen ? '<a href="/strategie/kontakte.html#f=' + p.organisationen.id + '">' + esc(p.organisationen.name) + "</a>" : "", esc(p.marke || ""), esc(p.phase || ""),
       '<span class="pr-st ' + STATUS[p.status] + '">' + esc(p.status) + "</span>"].filter(Boolean).join(" · ") + "</p>" +
      (p.thema ? '<p class="pr-thema">' + esc(p.thema) + "</p>" : "") + "</div></div>";
    h += '<div class="kt3-raster">';
    // Links: Stoßrichtung (Gesamtblick über alle Termine) – rechts: Aufgaben
    var punkte = (p.ueberlegungen || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    h += '<section class="kt3-box pr-kurs"><h3>Stoßrichtung</h3>' + (punkte.length ? '<ul data-ueb-text>' + punkte.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"
        : '<p class="kt3-leise" data-ueb-text>Noch keine Stoßrichtung – diktiere sie mir oder trage sie ein.</p>') +
      '<textarea class="pr-ueb" data-ueb hidden placeholder="Ein Punkt pro Zeile">' + esc(p.ueberlegungen || "") + '</textarea><div class="pr-ueb-knoepfe"><button type="button" class="kt3-klapp" data-ueb-bearbeiten>Bearbeiten</button>' +
      '<button type="button" class="pr-speichern" data-ueb-speichern hidden>Speichern</button></div></section>';
    // Aufgaben: immer mit Frist, nach Datum
    var offen = auf.filter(function (a) { return a.status === "offen"; }).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
    var namen = ["Daniel"].concat(bet.map(function (b) { return b.name || name(b.kontakte); })).filter(function (x, i, l) { return x && l.indexOf(x) === i; });
    h += '<section class="kt3-box pr-aufgaben"><h3>Aufgaben</h3>' + (offen.length ? '<ul class="pr-auf2">' + offen.map(function (a) {
      var ueber = a.faellig_am && new Date(a.faellig_am) < new Date(new Date().toDateString());
      return '<li data-a="' + a.id + '"><div class="pr-auf-zeile"><button type="button" class="st-haken" aria-label="Erledigt"></button>' +
        '<span class="pr-frist' + (ueber ? " pr-ueber" : "") + '">' + (a.faellig_am ? kurz(a.faellig_am) : "ohne Termin") + "</span>" +
        '<button type="button" class="pr-auf-titel" data-auf-auf aria-expanded="false"><span>' + esc(a.titel) + "</span>" + (a.beschreibung ? '<i class="pr-hat-details" title="Details vorhanden"></i>' : "") + "</button>" +
        '<span class="pr-wer">' + esc(wer(a) || "offen") + "</span></div>" +
        '<div class="pr-auf-details" hidden><textarea data-det placeholder="Details, Hintergrund, Links …">' + esc(a.beschreibung || "") + '</textarea><button type="button" class="pr-speichern" data-det-speichern hidden>Speichern</button></div></li>';
      }).join("") + "</ul>" : '<p class="kt3-leise">Nichts offen.</p>') +
      '<form class="kt3-neu pr-neu" data-neu><input type="text" placeholder="Neue Aufgabe …" data-titel><input type="text" list="pr-namen" placeholder="Wer?" data-wer class="pr-wer-feld"><input type="date" data-frist class="pr-frist-feld" aria-label="Frist">' +
      '<datalist id="pr-namen">' + namen.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + '</datalist><button type="submit">+</button></form></section>';
    // Timeline: links durchscrollbar, rechts die Details zum gewählten Termin
    var jetzt = Date.now();
    var start = ere.filter(function (e) { return new Date(e.datum) <= jetzt; })[0] || ere[0];
    h += '<section class="kt3-box kt3-breit"><h3>Timeline</h3><div class="pr-tl2"><ol class="pr-tl2-liste">' + ere.map(function (e) {
      var zuk = new Date(e.datum) > jetzt, hat = pkt.some(function (x) { return x.ereignis_id === e.id; }) || auf.some(function (x) { return x.ereignis_id === e.id; });
      return '<li><button type="button" data-ev="' + e.id + '" class="' + (zuk ? "pr-zuk " : "") + (start && e.id === start.id ? "an" : "") + '"><span class="pr-d">' + (zuk ? "geplant · " : "") + kurz(e.datum) + " · " +
        new Date(e.datum).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + (hat ? ' <i class="pr-hat-details" title="Protokoll vorhanden"></i>' : "") + "</span><b>" + esc(e.titel) + "</b>" +
        '<small>' + esc(format(e)) + "</small>" + (teiln(e) ? "<small>" + esc(teiln(e)) + "</small>" : "") + "</button></li>";
    }).join("") + '</ol><div class="pr-tl2-detail" data-ev-detail></div></div></section>';
    // Beteiligte
    function seite(s) {
      var l = bet.filter(function (b) { return b.seite === s; });
      return l.length ? '<ul class="pr-bet">' + l.map(function (b) {
        return "<li>" + (b.kontakte ? '<a href="/strategie/kontakte.html#k=' + b.kontakte.id + '">' + esc(name(b.kontakte)) + "</a>" : esc(b.name)) +
          '<span class="kt3-leise">' + esc(b.rolle || (b.kontakte && b.kontakte.position) || "") + "</span></li>"; }).join("") + "</ul>" : '<p class="kt3-leise">–</p>';
    }
    h += '<div class="kt3-breit pr-bet-zeile"><section class="kt3-box"><h3>Beteiligte beim Kunden</h3>' + seite("Kunde") + '</section><section class="kt3-box"><h3>Team empiria</h3>' + seite("empiria") + seite("Partner").replace('<p class="kt3-leise">–</p>', "") + "</section></div>";
    wurzel.innerHTML = h + "</div>";
    verdrahten(p);
  }

  function verdrahten(p) {
    var knoepfe = wurzel.querySelectorAll("[data-ev]");
    knoepfe.forEach(function (b) { b.onclick = function () { knoepfe.forEach(function (x) { x.classList.toggle("an", x === b); }); detailEreignis(+b.getAttribute("data-ev")); }; });
    var an = wurzel.querySelector("[data-ev].an"); if (an) detailEreignis(+an.getAttribute("data-ev"));
    wurzel.querySelectorAll("[data-auf-auf]").forEach(function (b) {
      var li = b.closest("li"), det = li.querySelector(".pr-auf-details"), ta = det.querySelector("textarea"), sp = det.querySelector("[data-det-speichern]");
      b.onclick = function () { det.hidden = !det.hidden; b.setAttribute("aria-expanded", String(!det.hidden)); };
      ta.oninput = function () { sp.hidden = false; };
      sp.onclick = function () { sp.disabled = true; db.from("aufgaben").update({ beschreibung: ta.value }).eq("id", +li.getAttribute("data-a")).then(function (r) { sp.disabled = false; if (r.error) alert(r.error.message); else sp.hidden = true; }); };
    });
    var ta = wurzel.querySelector("[data-ueb]"), sp = wurzel.querySelector("[data-ueb-speichern]"), bt = wurzel.querySelector("[data-ueb-bearbeiten]"), tx = wurzel.querySelector("[data-ueb-text]");
    bt.onclick = function () { ta.hidden = false; tx.hidden = true; bt.hidden = true; sp.hidden = false; ta.focus(); };
    sp.onclick = function () { sp.disabled = true; db.from("projekte").update({ ueberlegungen: ta.value }).eq("id", p.id).then(function (r) { sp.disabled = false; if (r.error) alert(r.error.message); else projekt(p.id); }); };
    wurzel.querySelectorAll("[data-a] .st-haken").forEach(function (b) {
      b.onclick = function () { var li = b.closest("li"); li.classList.add("st-weg");
        db.from("aufgaben").update({ status: "erledigt", erledigt_am: new Date().toISOString() }).eq("id", +li.getAttribute("data-a")).then(function (r) { if (r.error) { li.classList.remove("st-weg"); alert(r.error.message); } }); };
    });
    var f = wurzel.querySelector("[data-neu]");
    f.onsubmit = function (e) {
      e.preventDefault();
      var t = f.querySelector("[data-titel]").value.trim(), w = f.querySelector("[data-wer]").value.trim(); if (!t) return;
      f.classList.add("laedt");
      var fr = f.querySelector("[data-frist]").value || null;
      db.from("aufgaben").insert({ titel: t, projekt_id: p.id, zustaendig_name: w || "Daniel", faellig_am: fr, bereich: "Projekt" }).then(function (r) { if (r.error) { f.classList.remove("laedt"); alert(r.error.message); } else projekt(p.id); });
    };
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-klapp-knopf]"); if (!b || !wurzel.contains(b)) return;
    var auf = b.getAttribute("aria-expanded") !== "true";
    b.closest(".kt3-box").querySelectorAll("[data-mehr]").forEach(function (x) { x.hidden = !auf; });
    b.setAttribute("aria-expanded", String(auf)); b.textContent = auf ? "Weniger zeigen" : "Alle zeigen";
  });
})();
